/**
 * Portage phase 2 · P11 : recette de bout en bout SANS appel payant (plan § 8). Les six réglages éteints (écrans et réponses
 * de master, routes en 404, aucun appel), puis allumés DANS LE DOUBLE seulement : retouche comprise et montrée sans rien
 * lancer, document validé sans rien envoyer, relevés lus par un lecteur double. `fetch` interdit, aucun fournisseur réel.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { ReponseAppelEcriture } from "@/moteurs/montage-cas-concret/outils";
import type { MoteurVideo, ResultatFabrication } from "@/moteurs/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const auth = await import("@/services/auth");
const modifications = await import("@/services/modifications");
const document = await import("@/services/cas-concret-document");
const suivi = await import("@/services/cas-concret-suivi");
const porteB = await import("@/services/cas-concret-porte-b");
const { REGLAGES_CAS_CONCRET, reglageAllume } = await import("@/services/cas-concret-reglages");
const pageDocument = (await import("@/app/(studio)/cas-concret/document/[videoId]/page")).default;
const pageEcranFourni = (await import("@/app/(studio)/cas-concret/ecran-fourni/[casId]/page")).default;
const { BlocDocument } = await import("@/components/formats/cas-concret/document/BlocDocument");
const { BlocReleves } = await import("@/components/formats/cas-concret/releves/BlocReleves");
const { banc } = await import("../moteur/doubles");

const MDP = "cas-concret-recette-phase-2";
const VIDEO = "v-03";
const T0 = Date.UTC(2026, 9, 12, 9, 0, 0);
let fetchEspion: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  process.env.SESSION_SECRET = "r".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  fetchEspion = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("Aucun appel réseau dans la recette.");
  });
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  await videoDuFormat();
});
afterEach(() => {
  expect(fetchEspion).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

async function avancerJusqua(moteur: MoteurVideo, commande: CommandeFabrication, depart: Travail) {
  let t = depart;
  let resultat: ResultatFabrication | undefined;
  for (let n = 0; n < 200; n++) {
    const r = await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, T0 + n * 1000);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (t.statut === "termine" || t.statut === "echec") return { travail: t, resultat };
  }
  throw new Error(`Bloqué (${t.statut}).`);
}

/** v-03 devient une vraie vidéo du format, fabriquée en simulation (numéro de version 42). */
async function videoDuFormat() {
  const b = banc({ motSur: ["facebook", "instagram"] });
  const commande = b.commande();
  const fin = await avancerJusqua(b.moteur, commande, await b.moteur.lancer(commande, { travailId: "t-1", versionId: "ver-t-1", titre: "Essai", maintenant: T0 }));
  expect(fin.travail.statut).toBe("termine");
  const projetMontage = JSON.parse(JSON.stringify(fin.resultat!.projetMontage)) as Record<string, unknown>;
  const d = depots();
  const video = (await d.videos.obtenir(VIDEO))!;
  await d.videos.modifier(VIDEO, { formatId: "cas-concret", estDemo: false, entrees: { casConcret: { casId: "recrutement-apporteurs", codeSuivi: "cc-abc123", reseaux: ["instagram"], essai: false } } });
  await d.versions.modifier(video.versionChoisieId!, { estDemo: false, numero: 42, commande: { ...commande, videoId: VIDEO }, projetMontage });
}

function doubles() {
  const enAttente = new Map<string, () => Promise<ReponseAppelEcriture>>();
  const reponses = new Map<string, ReponseAppelEcriture>();
  const executer = vi.fn(async (_v: string, role: DefinitionRole, entree: EntreeRole) => ({ ok: true as const, simule: true, donnees: role.simuler(entree) }));
  const lancerRetouche = vi.fn(async () => ({ travailId: "t-retouche" }));
  return {
    executer,
    lancerRetouche,
    repondre: async () => {
      for (const [cle, appel] of enAttente) reponses.set(cle, await appel());
      enAttente.clear();
    },
    dep: { appels: { lancer: (cle: string, appel: () => Promise<ReponseAppelEcriture>) => void enAttente.set(cle, appel), lire: async (cle: string) => reponses.get(cle) ?? null }, executer, claudeActif: async () => false, lancerRetouche },
  };
}

const compteurs = async () => ({ publications: (await depots().publications.lister()).length, notifications: (await depots().notifications.lister()).length });

describe("recette · les six réglages éteints (défaut) : master, inchangé", () => {
  it("les six réglages sont éteints ; routes en 404, blocs vides, aucune lecture du site", async () => {
    for (const id of Object.values(REGLAGES_CAS_CONCRET)) expect(await reglageAllume(id), id).toBe(false);
    await expect(pageDocument({ params: Promise.resolve({ videoId: VIDEO }) })).rejects.toThrow("NOT_FOUND");
    await expect(pageEcranFourni({ params: Promise.resolve({ casId: "recrutement-apporteurs" }) })).rejects.toThrow("NOT_FOUND");
    expect(await BlocDocument({ videoId: VIDEO })).toBeNull();
    expect(await BlocReleves({ videoId: VIDEO })).toBeNull();
    const lire = vi.fn(async () => []);
    await expect(suivi.suiviDesVideos({ videoId: VIDEO, visites: { mode: "reel", lire } })).rejects.toMatchObject({ code: "FONCTION_FERMEE" });
    expect(lire).not.toHaveBeenCalled();
  });

  it("« Demander une modification » garde la réponse commune ; la porte B refuse sans appel", async () => {
    const x = doubles();
    const p = await modifications.proposerModification(VIDEO, "Faites-la sans le mot.", x.dep);
    expect(p.statut).toBe("hors-capacite");
    expect(p.resume).toContain("il faut refaire la vidéo");
    expect(p.horsCapacite!.prixVideo.centimes).toBeGreaterThan(0);
    const r = await porteB.demarrerPorteB("Un cabinet comptable qui reçoit deux cents factures par mois et les saisit à la main, une par une.", x.dep);
    expect(r.statut).toBe("refusee");
    expect(x.executer).not.toHaveBeenCalled();
    expect(x.lancerRetouche).not.toHaveBeenCalled();
  });
});

describe("recette · réglages allumés dans le double : rien ne part sans accord, rien n'est envoyé", () => {
  beforeEach(async () => {
    for (const id of Object.values(REGLAGES_CAS_CONCRET)) await ecrireParametre(id, true);
  });

  it("retouche : lue sans être attendue, montrée avec son prix, rien lancé avant « Confirmer »", async () => {
    const x = doubles();
    const p0 = await modifications.proposerModification(VIDEO, "Faites-la sans le mot.", x.dep);
    expect(p0.statut).toBe("en-cours");
    await x.repondre();
    const p = await modifications.suivreModification(VIDEO, p0.id, x.dep);
    expect(p.statut).toBe("proposee");
    expect(p.cout.centimes).toBeGreaterThanOrEqual(0);
    expect(x.lancerRetouche).not.toHaveBeenCalled();
  });

  it("document : validé par une date, aucune publication ni notification ; relevés : lecteur double, par réseau", async () => {
    const avant = await compteurs();
    const v = await document.validerDocument(VIDEO);
    expect(v.valideLe).toBeTruthy();
    expect(await compteurs()).toEqual(avant);
    const s = await suivi.suiviDesVideos({ videoId: VIDEO, visites: { mode: "reel", lire: async () => [{ campagne: "0042-CC-IG", source: "instagram", visites: 7, rendezVous: 0 }] } });
    expect(s.lignes).toHaveLength(1);
    expect(s.lignes[0]).toMatchObject({ reseau: "instagram", codeSuivi: "0042-CC-IG", visites: 7, mesure: true });
    expect(Object.keys(s.lignes[0])).not.toContain("prospect");
    expect(await BlocDocument({ videoId: VIDEO })).not.toBeNull();
    expect(await BlocReleves({ videoId: VIDEO })).not.toBeNull();
    expect(await compteurs()).toEqual(avant);
  });

  it("porte B : une description trop courte donne une phrase, 0 appel", async () => {
    const x = doubles();
    const r = await porteB.demarrerPorteB("trop court", x.dep);
    expect(r.statut).toBe("refusee");
    expect(x.executer).not.toHaveBeenCalled();
  });
});
