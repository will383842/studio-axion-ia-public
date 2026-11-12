/**
 * GV-EC-01e — une réservation n'attend jamais un travail qui ne partira plus. Trois cas d'attente de validation :
 *  (i) une nouvelle fabrication remplace l'ancien travail en attente (sa réservation est libérée) ;
 *  (ii) une reprise refusée (cas retiré) libère la réservation ;
 *  (iii) « Nettoyer » ne propose jamais une vidéo en attente ; la corbeille libère tout de suite la réservation.
 * Faux dépôts, horloge simulée, aucun réseau.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { Travail } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const travaux = await import("@/services/travaux");
const credits = await import("@/services/credits");
const corbeille = await import("@/services/corbeille");
const annulation = await import("@/services/annulation-video");
const relance = await import("@/services/cas-concret-relance");
const { moteurDeCommande } = await import("@/moteurs");
const { horodatage } = await import("@/services/_commun");

const MDP = "gv-ec-01e";
const HEURE = 3_600_000;

beforeAll(async () => {
  process.env.SESSION_SECRET = "e".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  credits.injecterLecteursPourEssai(null);
  await auth.seConnecter(MDP, false);
  for (const x of await depots().travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
  for (const p of await depots().publications.lister((x) => x.statut === "programmee")) await depots().publications.supprimer(p.id);
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  vi.useRealTimers();
});

/** Lance une vidéo puis la range en attente de validation, avec une réservation active posée (le lancement simulé n'en pose pas). */
async function mettreEnAttente(videoId = "v-03", code = "IV_SCRIPT_A_VALIDER"): Promise<string> {
  const { travailId } = await fabrication.lancerFabrication(videoId, { confirme: true });
  const t = (await depots().travaux.obtenir(travailId))!;
  const version = (await depots().versions.obtenir(t.versionId!))!;
  await depots().reservations.enregistrer({ id: `res-${travailId}`, fournisseur: "fal", videoId: t.cibleId, travailId, centimes: 120, devise: "USD", statut: "active", ...horodatage() });
  const sortie: Travail = {
    ...t,
    statut: "echec",
    erreur: { code, reessayable: true, messagePourWill: "Cette étape attend votre décision.", detailTechnique: "pause" },
    etapes: t.etapes.map((e, i) => (i === 0 ? { ...e, statut: "echec" as const } : e)),
    modifieLe: new Date().toISOString(),
  };
  const r = await travaux.ecrireAvancement({ travail: t, commande: version.commande, moteur: moteurDeCommande(version.commande) }, { travail: sortie });
  expect(r.ecrit).toBe(true);
  return travailId;
}
const actives = (travailId: string) => depots().reservations.compter((r) => r.travailId === travailId && r.statut === "active");

describe("(i) nouvelle fabrication sur une vidéo dont l'ancien travail attend", () => {
  it("l'ancien travail en attente rend sa réservation, une seule fois", async () => {
    const ancien = await mettreEnAttente();
    expect(await actives(ancien)).toBe(1);
    const { travailId: nouveau } = await fabrication.lancerFabrication("v-03", { confirme: true });
    expect(nouveau).not.toBe(ancien);
    expect(await actives(ancien)).toBe(0);
    expect(await depots().reservations.compter((r) => r.travailId === ancien && r.statut === "liberee")).toBe(1);
  });

  it("si le lancement du nouveau est refusé avant la réservation, l'ancien garde la sienne", async () => {
    const ancien = await mettreEnAttente();
    await expect(fabrication.lancerFabrication("v-introuvable", { confirme: true })).rejects.toBeTruthy();
    const video = (await depots().travaux.obtenir(ancien))!.cibleId;
    // Refus après lecture de la vidéo : un cas concret retiré n'est pas utilisable ici, on force un refus par l'estimation.
    vi.spyOn(await import("@/moteurs"), "moteurDeCommande").mockImplementationOnce(() => {
      throw new Error("refus avant réservation");
    });
    await expect(fabrication.lancerFabrication(video, { confirme: true })).rejects.toBeTruthy();
    expect(await actives(ancien)).toBe(1);
  });

  it("un travail d'une autre vidéo n'est pas touché, et un vrai échec de la même vidéo non plus", async () => {
    const autre = await mettreEnAttente("v-04");
    const vrai = await mettreEnAttente("v-03", "IV_CONTROLES");
    await fabrication.lancerFabrication("v-03", { confirme: true });
    expect(await actives(autre)).toBe(1);
    // Le vrai échec n'avait déjà aucune réservation active (rendue à l'échec) : rien n'est ni créé ni réactivé.
    expect(await actives(vrai)).toBe(0);
    expect((await depots().travaux.obtenir(vrai))!.statut).toBe("echec");
  });

  it("si la création de la fabrication échoue APRÈS la réservation du nouveau, l'ancien garde la sienne", async () => {
    const ancien = await mettreEnAttente();
    const video = (await depots().travaux.obtenir(ancien))!.cibleId;
    const avant = await depots().reservations.compter(() => true);
    vi.spyOn(depots().versions, "enregistrer").mockRejectedValueOnce(new Error("panne d'écriture"));
    await expect(fabrication.lancerFabrication(video, { confirme: true })).rejects.toBeTruthy();
    expect(await actives(ancien)).toBe(1);
    // Le nouveau travail a bien été libéré par le retour arrière : aucune réservation active en trop.
    expect(await depots().reservations.compter((r) => r.statut === "active")).toBe(1);
    expect(await depots().reservations.compter(() => true)).toBeGreaterThanOrEqual(avant);
  });

  it("libération de l'ancien en panne : le lancement du nouveau réussit quand même", async () => {
    const ancien = await mettreEnAttente();
    const video = (await depots().travaux.obtenir(ancien))!.cibleId;
    const credits2 = await import("@/services/credits");
    const vraie = credits2.libererReservation;
    vi.spyOn(credits2, "libererReservation").mockImplementation(async (id, ...reste) => {
      if (id === ancien) throw new Error("panne de libération");
      return vraie(id, ...reste);
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await fabrication.lancerFabrication(video, { confirme: true });
    expect(r.travailId).toBeTruthy();
    expect(r.travailId).not.toBe(ancien);
    expect(await actives(ancien)).toBe(1); // rattrapée plus tard par la suppression ou la corbeille
  });
});

describe("(i bis) un retour arrière ne réactive jamais une réservation déjà rendue", () => {
  it("corbeille puis purge avec l'effacement en panne : 0 réservation active", async () => {
    const id = await mettreEnAttente();
    const video = (await depots().travaux.obtenir(id))!.cibleId;
    await corbeille.mettreALaCorbeille([video]);
    expect(await actives(id)).toBe(0);
    vi.spyOn(depots().videos, "supprimer").mockRejectedValue(new Error("effacement en panne"));
    await expect(corbeille.viderCorbeille([video])).rejects.toBeTruthy();
    expect(await actives(id)).toBe(0);
  });

  it("ancien travail remplacé puis suppression en panne : 0 réservation active", async () => {
    const ancien = await mettreEnAttente();
    const video = (await depots().travaux.obtenir(ancien))!.cibleId;
    const { travailId: nouveau } = await fabrication.lancerFabrication(video, { confirme: true });
    await depots().travaux.enregistrer({ ...(await depots().travaux.obtenir(nouveau))!, statut: "termine" });
    await depots().videos.modifier(video, { statut: "brouillon" });
    expect(await actives(ancien)).toBe(0);
    vi.spyOn(depots().videos, "supprimer").mockRejectedValue(new Error("effacement en panne"));
    const { supprimerVideosSansSession } = await import("@/services/videos");
    await expect(supprimerVideosSansSession([video])).rejects.toThrow("effacement en panne");
    expect(await actives(ancien)).toBe(0);
  });

  it("corbeille de nouveau en panne après une première libération : 0 réservation active", async () => {
    const id = await mettreEnAttente();
    const video = (await depots().travaux.obtenir(id))!.cibleId;
    await corbeille.mettreALaCorbeille([video]);
    await corbeille.restaurerDeLaCorbeille([video]);
    vi.spyOn(depots().videos, "modifier").mockRejectedValueOnce(new Error("écriture en panne"));
    await expect(corbeille.mettreALaCorbeille([video])).rejects.toBeTruthy();
    expect(await actives(id)).toBe(0);
  });
});

describe("(i ter) reprise d'une attente qui ne doit plus repartir", () => {
  it("ancien travail remplacé : reprise refusée, une seule réservation active", async () => {
    const ancien = await mettreEnAttente();
    const video = (await depots().travaux.obtenir(ancien))!.cibleId;
    const { travailId: nouveau } = await fabrication.lancerFabrication(video, { confirme: true });
    await depots().reservations.enregistrer({ id: `res-${nouveau}`, fournisseur: "fal", videoId: video, travailId: nouveau, centimes: 120, devise: "USD", statut: "active", ...horodatage() });
    await expect(travaux.reessayerTravail(ancien)).rejects.toMatchObject({ message: "Ce travail a été remplacé. Rouvrez la page." });
    expect(await actives(ancien)).toBe(0);
    expect(await depots().reservations.compter((r) => r.statut === "active" && r.videoId === video)).toBe(1);
  });

  it("vidéo à la corbeille : reprise refusée, aucune réservation réactivée", async () => {
    const id = await mettreEnAttente();
    const video = (await depots().travaux.obtenir(id))!.cibleId;
    await corbeille.mettreALaCorbeille([video]);
    await expect(travaux.reessayerTravail(id)).rejects.toMatchObject({ message: "Cette vidéo est dans la corbeille. Restaurez-la d'abord." });
    expect(await actives(id)).toBe(0);
  });
});

describe("(ii) reprise d'une attente refusée", () => {
  it("cas retiré : la reprise est refusée ET la réservation est libérée (une fois)", async () => {
    const id = await mettreEnAttente();
    const t = (await depots().travaux.obtenir(id))!;
    const refus = await import("@/services/cas-concret-retires");
    vi.spyOn(refus, "refusCasRetire").mockResolvedValue("Ce cas a été retiré.");
    // La vidéo devient un cas concret pour que les garde-fous de la reprise s'appliquent.
    const version = (await depots().versions.obtenir(t.versionId!))!;
    await depots().versions.modifier(version.id, { commande: { ...version.commande, formatId: "cas-concret" } });
    await depots().videos.modifier(t.cibleId, { estDemo: false, sourceVideoId: undefined, typeDerive: undefined });
    await expect(travaux.reessayerTravail(id)).rejects.toMatchObject({ code: "CAS_RETIRE" });
    expect(await actives(id)).toBe(0);
    expect(await depots().reservations.compter((r) => r.travailId === id && r.statut === "liberee")).toBe(1);
  });

  it("relance du cas concret refusée (cas retiré) : réservation libérée", async () => {
    const id = await mettreEnAttente("v-03", "CAS_CONCRET_SCRIPT_A_VALIDER");
    const t = (await depots().travaux.obtenir(id))!;
    const version = (await depots().versions.obtenir(t.versionId!))!;
    const { ID_MOTEUR_CAS_CONCRET } = await import("@/moteurs/montage-cas-concret");
    await depots().versions.modifier(version.id, { commande: { ...version.commande, moteurId: ID_MOTEUR_CAS_CONCRET, entrees: { ...version.commande.entrees, casConcret: { porte: "porte-a", casId: "cas-test" } } } });
    const retires = await import("@/services/cas-concret-retires");
    vi.spyOn(retires, "lireCasRetires").mockResolvedValue(new Set(["cas-test"]));
    const r = await relance.relancerEtapeCasConcret(id, true, { stockMetiersAllume: async () => true });
    expect(r.statut).toBe("refusee");
    expect(await actives(id)).toBe(0);
  });

  it("un vrai échec refusé n'a aucune réservation à libérer (rien ne change)", async () => {
    const id = await mettreEnAttente("v-03", "IV_CONTROLES");
    expect(await actives(id)).toBe(0);
  });
});

describe("(iii) Nettoyer et corbeille", () => {
  async function vieillir(videoId: string) {
    const v = (await depots().videos.obtenir(videoId))!;
    // Une vidéo jamais terminée n'a pas de version choisie (sinon elle n'est de toute façon jamais nettoyable).
    await depots().videos.enregistrer({ ...v, versionChoisieId: undefined, modifieLe: new Date(Date.now() - 48 * HEURE).toISOString() });
  }

  it("une vidéo en attente depuis plus de 24 h n'est jamais proposée au nettoyage", async () => {
    const id = await mettreEnAttente();
    const video = (await depots().travaux.obtenir(id))!.cibleId;
    await vieillir(video);
    expect((await annulation.listerANettoyer()).map((v) => v.id)).not.toContain(video);
    const r = await annulation.nettoyerVideos([video]);
    expect(r.mises).toBe(0);
    expect(await actives(id)).toBe(1);
  });

  it("témoin : une vidéo en vrai échec depuis plus de 24 h reste proposée", async () => {
    const id = await mettreEnAttente("v-03", "IV_CONTROLES");
    const video = (await depots().travaux.obtenir(id))!.cibleId;
    await vieillir(video);
    expect((await annulation.listerANettoyer()).map((v) => v.id)).toContain(video);
  });

  it("vidéo en attente mise à la corbeille : réservation libérée aussitôt", async () => {
    const id = await mettreEnAttente();
    const video = (await depots().travaux.obtenir(id))!.cibleId;
    const r = await corbeille.mettreALaCorbeille([video]);
    expect(r.mises).toBe(1);
    expect(await actives(id)).toBe(0);
  });

  it("restaurée de la corbeille : la reprise réactive la réservation", async () => {
    const id = await mettreEnAttente();
    const video = (await depots().travaux.obtenir(id))!.cibleId;
    await corbeille.mettreALaCorbeille([video]);
    await corbeille.restaurerDeLaCorbeille([video]);
    expect(await actives(id)).toBe(0);
    await travaux.reessayerTravail(id);
    expect(await actives(id)).toBe(1);
  });
});
