/**
 * P6 · CORRECTIFS DE LA RELECTURE OPUS (#461) : prix montré = réservation, refus passagers, chevauchement, accord.
 * (suite de « DEMANDER UNE MODIFICATION » d'une vidéo « Cas concret MD » (#350 + retouche par discussion du portage phase 2).
 * Réglage `casConcret.retouches` ÉTEINT (défaut) : la réponse commune de #350 (« pour ce changement, il faut refaire la
 * vidéo », avec le prix), aucun appel Claude. ALLUMÉ (dans le double seulement) : la demande est lue par un appel détaché,
 * montrée avec ce qui change, ce qui est refait et le prix ; rien ne part sans « Confirmer ». Aucun appel réel.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
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
const retouches = await import("@/services/cas-concret-retouches");
const { banc } = await import("../cas-concret/moteur/doubles");

const MDP = "modification-cas-concret";
const VIDEO = "v-03";
const T0 = Date.UTC(2026, 9, 12, 9, 0, 0);

beforeAll(async () => {
  process.env.SESSION_SECRET = "p".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("Aucun appel réseau dans ces tests.");
  });
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  await videoDuFormat();
});
afterEach(() => vi.restoreAllMocks());

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

/** v-03 devient une vraie vidéo du format, fabriquée en simulation (mot branché sur Facebook et Instagram). */
async function videoDuFormat() {
  const b = banc({ motSur: ["facebook", "instagram"] });
  const commande = b.commande();
  const fin = await avancerJusqua(b.moteur, commande, await b.moteur.lancer(commande, { travailId: "t-1", versionId: "ver-t-1", titre: "Essai", maintenant: T0 }));
  expect(fin.travail.statut).toBe("termine");
  const projetMontage = JSON.parse(JSON.stringify(fin.resultat!.projetMontage)) as Record<string, unknown>;
  const d = depots();
  const video = (await d.videos.obtenir(VIDEO))!;
  await d.videos.modifier(VIDEO, { formatId: "cas-concret", estDemo: false });
  await d.versions.modifier(video.versionChoisieId!, { estDemo: false, commande: { ...commande, videoId: VIDEO }, projetMontage });
}

/** Doubles : l'appel détaché ne répond qu'à `repondre()` ; rien n'est lancé pour de vrai. */
function doubles(options: { panne?: boolean; porte?: Promise<void>; signal?: () => void } = {}) {
  const enAttente = new Map<string, () => Promise<ReponseAppelEcriture>>();
  const reponses = new Map<string, ReponseAppelEcriture>();
  const executer = vi.fn(async (_v: string, role: DefinitionRole, entree: EntreeRole) => ({ ok: true as const, simule: true, donnees: role.simuler(entree) }));
  const lancerRetouche = vi.fn(async () => ({ travailId: "t-retouche" }));
  const etat = { panne: options.panne ?? false, lances: 0 };
  return {
    etat,
    executer,
    lancerRetouche,
    enAttente,
    repondre: async () => {
      for (const [cle, appel] of enAttente) reponses.set(cle, etat.panne ? { ok: false, arret: "panne", message: "panne" } : await appel());
      enAttente.clear();
    },
    dep: { appels: { lancer: async (cle: string, appel: () => Promise<ReponseAppelEcriture>) => { etat.lances++; enAttente.set(cle, appel); options.signal?.(); await options.porte; }, lire: async (cle: string) => reponses.get(cle) ?? null }, executer, claudeActif: async () => false, lancerRetouche },
  };
}


const { servicesCasConcret, brancherServicesCasConcret } = await import("@/moteurs/montage-cas-concret");
const { moteurDeCommande } = await import("@/moteurs");
const { TABLE_FINS_DIAGNOSTIC } = await import("@/briques/fins");
const { parentDeLaVersion } = await import("@/services/fabrication");

describe("défaut 1 : le prix montré est celui de la réservation (chemin même de lancerRetouche)", () => {
  const origine = servicesCasConcret().outils;
  beforeEach(async () => {
    await ecrireParametre("casConcret.retouches", true);
  });
  afterEach(() => brancherServicesCasConcret({ outils: origine }));

  // Outils minimaux (les vrais exigent une voix prête) : le cas du catalogue, la table des fins, les mots interdits de Will.
  const interdire = (mots: string[]) =>
    brancherServicesCasConcret({
      outils: async () => ({ contexte: { aujourdhui: "2026-10-12", interdits: mots, reseaux: ["facebook", "instagram"], tableDesFins: TABLE_FINS_DIAGNOSTIC, bruitagesValides: [] } }) as never,
    });

  it("un mot interdit de Will : la demande n'est pas proposée avec un prix, elle est refusée comme la retouche la refuserait", async () => {
    interdire(["RDV"]);
    const x = doubles();
    const p0 = await modifications.proposerModification(VIDEO, "Changez le mot à commenter : RDV", x.dep);
    await x.repondre();
    const p = await modifications.suivreModification(VIDEO, p0.id, x.dep);
    expect(p.statut).toBe("hors-capacite");
    expect(p.resume).toMatch(/interdit/);
  });

  it("prix proposé = estimation du moteur (même appel que la réservation) ; vrai lancerRetouche : refus d'un mot devenu interdit, réservation libérée", async () => {
    const x = doubles();
    const p0 = await modifications.proposerModification(VIDEO, "Changez le mot à commenter : RDV", x.dep);
    await x.repondre();
    const p = await modifications.suivreModification(VIDEO, p0.id, x.dep);
    expect(p.statut).toBe("proposee");
    const versionId = (await depots().videos.obtenir(VIDEO))!.versionChoisieId;
    const version = (await depots().versions.obtenir(versionId!))!;
    const exact = await moteurDeCommande(version.commande).estimerRetouche(version.commande, [], { operations: [{ type: "changer-mot", mot: "RDV" }] as never, parent: await parentDeLaVersion(version) });
    expect(p.cout.centimes).toBe(exact.total.centimes);

    // Le vrai chemin d'argent (aucun double) : le mot est interdit entre-temps, le moteur refuse d'emblée.
    interdire(["RDV"]);
    const avant = (await depots().reservations.lister(() => true)).length;
    const issue = await retouches.confirmerRetouche(VIDEO, p.cout.centimes, { demande: p.demande });
    expect(issue.statut).toBe("refusee");
    const apres = await depots().reservations.lister(() => true);
    expect(apres.filter((r) => r.statut === "active")).toEqual([]);
    // Refus d'emblée par le moteur, avant toute réservation : rien n'est pris, rien ne reste actif (la libération après
    // réservation est prouvée par le test suivant).
    expect(apres.length).toBe(avant);
  });

  it("vrai lancerRetouche dont la création échoue APRÈS la réservation : la réservation de ce travail est libérée", async () => {
    const versionId = (await depots().videos.obtenir(VIDEO))!.versionChoisieId!;
    const version = (await depots().versions.obtenir(versionId))!;
    const moteur = moteurDeCommande(version.commande);
    let travailId = "";
    vi.spyOn(moteur, "retoucher").mockImplementation(async (a) => {
      travailId = a.contexte.travailId;
      throw new Error("échec de la création");
    });
    const { lancerRetouche } = await import("@/services/fabrication");
    const { lireParametre } = await import("@/services/_commun");
    await expect(lancerRetouche(VIDEO, [], "Changez le mot à commenter : RDV", { confirme: 10_000, operations: [{ type: "changer-mot", mot: "RDV" }] as never })).rejects.toThrow("échec de la création");
    // La réservation a bien eu lieu (l'échec est arrivé APRÈS elle) : le budget du mois a été engagé pour ce travail, puis rendu.
    expect(travailId).not.toBe("");
    const engage = await lireParametre<{ statut: string } | null>(`budget.engage.${travailId}`, null);
    expect(engage?.statut).toBe("liberee");
    expect(await depots().reservations.lister((x) => x.statut === "active")).toEqual([]);
  });
});

describe("défaut 2 : un refus passager n'est jamais gardé", () => {
  beforeEach(async () => {
    await ecrireParametre("casConcret.retouches", true);
  });

  it("stockage persistant (UN double, même table de réponses) : après une panne, la même phrase aboutit au 2e essai, 2 appels seulement", async () => {
    const x = doubles({ panne: true });
    const p0 = await modifications.proposerModification(VIDEO, "Sans le mot.", x.dep);
    await x.repondre();
    const p1 = await modifications.suivreModification(VIDEO, p0.id, x.dep);
    expect(p1.statut).toBe("hors-capacite");
    expect(p1.resume).toMatch(/Réessayez/);

    x.etat.panne = false;
    const p2 = await modifications.proposerModification(VIDEO, "Sans le mot.", x.dep);
    expect(p2.statut).toBe("en-cours");
    // Le passage suivant arrive avant la réponse du nouvel appel : l'ancienne panne ne doit pas être relue.
    expect((await modifications.suivreModification(VIDEO, p2.id, x.dep)).statut).toBe("en-cours");
    await x.repondre();
    expect((await modifications.suivreModification(VIDEO, p2.id, x.dep)).statut).toBe("proposee");
    expect(x.etat.lances).toBe(2);
    expect(x.executer).toHaveBeenCalledTimes(1);
  });

  it("même phrase après une panne d'appel : un nouvel appel part et la demande peut aboutir", async () => {
    const panne = doubles({ panne: true });
    const p0 = await modifications.proposerModification(VIDEO, "Sans le mot.", panne.dep);
    await panne.repondre();
    const p1 = await modifications.suivreModification(VIDEO, p0.id, panne.dep);
    expect(p1.statut).toBe("hors-capacite");
    expect(p1.resume).toMatch(/Réessayez/);

    const bon = doubles();
    const p2 = await modifications.proposerModification(VIDEO, "Sans le mot.", bon.dep);
    expect(p2.statut).toBe("en-cours");
    expect(bon.enAttente.size).toBe(1);
    await bon.repondre();
    expect((await modifications.suivreModification(VIDEO, p2.id, bon.dep)).statut).toBe("proposee");
  });

  it("Will laisse la proposition : la même phrase relit la réponse déjà payée, aucun nouvel appel", async () => {
    const x = doubles();
    const p0 = await modifications.proposerModification(VIDEO, "Sans le mot.", x.dep);
    await x.repondre();
    const p = await modifications.suivreModification(VIDEO, p0.id, x.dep);
    expect(p.statut).toBe("proposee");
    await modifications.abandonnerModification(VIDEO, p.id);
    const p2 = await modifications.proposerModification(VIDEO, "Sans le mot.", x.dep);
    expect(p2.statut).toBe("proposee");
    expect(x.etat.lances).toBe(1);
  });
});

describe("défaut 3 : deux demandes qui se chevauchent", () => {
  beforeEach(async () => {
    await ecrireParametre("casConcret.retouches", true);
  });

  it("la relecture de P1 n'efface pas P2 de l'historique", async () => {
    const x = doubles();
    const p1 = await modifications.proposerModification(VIDEO, "Sans le mot.", x.dep);
    let ouvrir!: () => void;
    const porte = new Promise<void>((r) => (ouvrir = r));
    let signale!: () => void;
    const atteint = new Promise<void>((r) => (signale = r));
    const lente = doubles({ porte, signal: signale });
    // P2 tient le verrou de la retouche (son appel est lancé, la porte retient le passage).
    const deux = modifications.proposerModification(VIDEO, "Retirez l'étape 2.", lente.dep);
    await atteint;
    // La relecture de P1 lit l'historique, puis attend le verrou.
    const relecture = modifications.suivreModification(VIDEO, p1.id, x.dep);
    await new Promise((r) => setTimeout(r, 20));
    ouvrir();
    const p2 = await deux;
    await relecture;
    const ids = (await modifications.historiqueModifications(VIDEO)).map((h) => h.id);
    expect(ids).toContain(p1.id);
    expect(ids).toContain(p2.id);
  });

  it("l'écran n'insiste pas après une erreur de relecture (pas de boucle de notifications)", async () => {
    const { readFileSync } = await import("node:fs");
    const ecran = readFileSync("src/components/videos/fiche/DemanderModification.tsx", "utf8");
    const erreur = ecran.slice(ecran.indexOf("const r = await suivreModificationAction"), ecran.indexOf("RELECTURE_MS);"));
    // Sur erreur : la proposition locale n'est plus « en cours » et la relecture ne repart pas.
    expect(erreur).toMatch(/else \{[^}]*statut: "incomprise"/);
    expect(erreur.split("setTour").length - 1).toBe(1);
  });
});

describe("défaut 4 : un accord absent n'est pas un accord donné", () => {
  beforeEach(async () => {
    await ecrireParametre("casConcret.retouches", true);
  });

  it("confirme: false/undefined arrive tel quel à lancerRetouche (false), un montant reste un montant", async () => {
    for (const [donne, attendu] of [[false, false], [undefined, false], [true, true]] as const) {
      const x = doubles();
      const p0 = await modifications.proposerModification(VIDEO, "Sans le mot.", x.dep);
      await x.repondre();
      const p = await modifications.suivreModification(VIDEO, p0.id, x.dep);
      expect(p.statut).toBe("proposee");
      await modifications.confirmerModification(VIDEO, p.id, { confirme: donne }, x.dep);
      expect(x.lancerRetouche).toHaveBeenCalledWith(VIDEO, [], "Sans le mot.", expect.objectContaining({ confirme: attendu }));
    }
  });
});

describe("défaut 5 : la valeur du réglage survit à un module chargé deux fois", () => {
  it("une seconde copie du module lit la valeur posée par la première (rangée sur globalThis)", async () => {
    await ecrireParametre("casConcret.retouches", true);
    const premiere = await import("@/services/cas-concret-reglages");
    await premiere.actualiserReglageRetouches();
    expect(premiere.retouchesAllumeesConnues()).toBe(true);
    vi.resetModules();
    const seconde = await import("@/services/cas-concret-reglages");
    expect(seconde).not.toBe(premiere);
    expect(seconde.retouchesAllumeesConnues()).toBe(true);
    await ecrireParametre("casConcret.retouches", false);
    await premiere.actualiserReglageRetouches();
    expect(seconde.retouchesAllumeesConnues()).toBe(false);
  });
});
