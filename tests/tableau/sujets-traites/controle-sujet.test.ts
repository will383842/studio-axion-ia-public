/**
 * LOT L4 · SUJET DÉJÀ TRAITÉ DANS LE TABLEAU ANIMÉ. Le contrôle `verifierSujet` joue dans `ecrireScriptTableau`, SEULEMENT
 * pour une nouvelle vidéo (sans `videoId`), AVANT la demande d'accord sur le prix et avant tout brouillon ou dépense.
 * Dépôts en mémoire, double de Claude (aucun réseau, rien de payé).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { preparerMotDePasse } from "../../helpers/g1a";
import type { Video } from "@/domaine/types";
import { DEMANDE_MODELE } from "../../tableau-scripts/modele-valide";
import { accordApresRefus, controleServeurAvantPrix, prixRedemandable, RELANCES_PRIX_MAX } from "@/components/formats/tableau-anime/sujet-deja-traite";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ replace() {}, push() {}, refresh() {} }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

// Petite banque de l'Usine : jamais d'import à froid du fichier de 2,8 Mo dans ces tests.
vi.mock("@/donnees/bases-usine", () => {
  const ligne = (code: string, titre: string) => ({ code, titre, cible: "m1", etat: "valide", probleme: "", ceQueCaChange: "", accroche: "", sujet: "" });
  return { metiers: () => [{ code: "m1" }], casUsage: () => [ligne("c1", "Trier les CV reçus"), ligne("c2", "Compte rendu de visio"), ligne("c3", "Facturer les formateurs"), ligne("c4", "Agenda des rendez-vous")] };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const creation = await import("@/services/tableau-creation");
const taches = await import("@/services/tableau-taches");
const { ecrireParametre } = await import("@/services/_commun");

const MDP = "tableau-sujets-traites";
const DEMANDE = { ...DEMANDE_MODELE, vraiCas: null, sujet: "Relancer les devis non signés automatiquement" };
/** Même thème, autres mots : « proche », pas identique. */
const SUJET_PROCHE = "Relancer automatiquement les devis non signés";
const client = { simule: true, appeler: async () => { throw new Error("Aucun appel attendu."); } } as never;

function video(id: string, extra: Partial<Video> = {}): Video {
  const maintenant = new Date().toISOString();
  return { id, titre: "Relance des devis", sujet: DEMANDE.sujet, formatId: "tableau-anime", statut: "prete", entrees: {}, creeLe: maintenant, modifieLe: maintenant, ...extra } as unknown as Video;
}
async function prix(): Promise<number> {
  return (await creation.ecranCreationTableau()).ecriture.coutCentimes;
}
async function nombre(collection: "videos" | "depenses"): Promise<number> {
  return depots()[collection].compter();
}
async function ecrire(sujet: string, options: Parameters<typeof creation.ecrireScriptTableau>[1] = {}) {
  return creation.ecrireScriptTableau({ ...DEMANDE, sujet }, options, { client });
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  taches.tachesEnCours().clear();
  await auth.seConnecter(MDP, false);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("nouvelle vidéo : un sujet proche d'un tableau prêt est refusé, rien n'est enregistré", () => {
  it("refus AVANT le prix : ni accord demandé, ni brouillon, ni dépense", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    const avant = { videos: await nombre("videos"), depenses: await nombre("depenses") };
    const r = await ecrire(SUJET_PROCHE);
    expect(r.statut).toBe("sujet-deja-traite");
    if (r.statut !== "sujet-deja-traite") return;
    expect(r.niveau).toBe("proche");
    expect(r.precedents.map((p) => p.videoId)).toEqual(["v-prete"]);
    expect(r.precedents[0]!.lien).toBe("/videos/v-prete");
    expect(r.jeton).toMatch(/^[0-9a-f]{16}$/);
    expect(r.suggestions.length).toBeLessThanOrEqual(3);
    expect({ videos: await nombre("videos"), depenses: await nombre("depenses") }).toEqual(avant);
    expect(taches.tachesEnCours().size).toBe(0);
    expect(r.suggestions.map((x) => x.titre).length).toBeGreaterThan(0);
  });

  it("retaper le TITRE affiché d'une vidéo (le sujet interne est un geste) : refus avant le prix", async () => {
    await depots().videos.enregistrer(video("v-prete", { sujet: "Rédiger un devis à partir d'un modèle", titre: "Combien de temps perdez-vous sur chaque devis ?" }));
    const avant = { videos: await nombre("videos"), depenses: await nombre("depenses") };
    const r = await ecrire("Combien de temps perdez-vous sur chaque devis ?");
    expect(r.statut).toBe("sujet-deja-traite");
    if (r.statut !== "sujet-deja-traite") return;
    expect(r.niveau).toBe("proche");
    expect(r.precedents.map((p) => p.videoId)).toEqual(["v-prete"]);
    expect({ videos: await nombre("videos"), depenses: await nombre("depenses") }).toEqual(avant);
    expect(taches.tachesEnCours().size).toBe(0);
  });

  it("même sujet mot pour mot : toujours « proche » côté tableau (pas de clé exacte), et refusé", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    const r = await ecrire(DEMANDE.sujet);
    expect(r.statut).toBe("sujet-deja-traite");
    if (r.statut === "sujet-deja-traite") expect(r.niveau).toBe("proche");
  });

  it("« Refaire quand même » avec le bon jeton : l'écriture part (après le prix)", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    const base = await nombre("videos");
    const refus = await ecrire(SUJET_PROCHE);
    if (refus.statut !== "sujet-deja-traite") throw new Error(JSON.stringify(refus));
    const sansPrix = await ecrire(SUJET_PROCHE, { sujet: { choix: "refaire", jeton: refus.jeton } });
    expect(sansPrix.statut).toBe("accord-requis");
    const r = await ecrire(SUJET_PROCHE, { accord: await prix(), sujet: { choix: "refaire", jeton: refus.jeton } });
    expect(r.statut).toBe("en-cours");
    expect(await nombre("videos")).toBe(base + 1);
    if (r.statut === "en-cours") {
      const journal = await depots().evenements.lister((e) => e.entiteId === r.videoId);
      expect(journal.some((e) => /sujet déjà traité.*choix « refaire »/.test(e.message))).toBe(true);
    }
  });

  it("jeton périmé : refus de nouveau, rien d'enregistré", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    const refus = await ecrire(SUJET_PROCHE);
    if (refus.statut !== "sujet-deja-traite") throw new Error(JSON.stringify(refus));
    await depots().videos.enregistrer(video("v-autre", { titre: "Autre" }));
    const base = await nombre("videos");
    const r = await ecrire(SUJET_PROCHE, { accord: await prix(), sujet: { choix: "nouvel-angle", jeton: refus.jeton } });
    expect(r.statut).toBe("sujet-deja-traite");
    if (r.statut === "sujet-deja-traite") expect(r.jetonPerime).toBe(true);
    expect(await nombre("videos")).toBe(base);
  });

  it("un sujet sans rapport passe : on arrive au prix", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    const r = await ecrire("Préparer le planning des formateurs de la semaine");
    expect(r.statut).toBe("accord-requis");
  });
});

describe("pas de contrôle hors nouvelle vidéo, ni pour un échec", () => {
  it("échec puis relance : un sujet dont la vidéo a échoué est libre", async () => {
    await depots().videos.enregistrer(video("v-echec", { statut: "echec" }));
    const r = await ecrire(SUJET_PROCHE, { accord: await prix() });
    expect(r.statut).toBe("en-cours");
  });

  it("« autre accroche » sur un brouillon existant (videoId) : aucun contrôle", async () => {
    const premiere = await ecrire("Préparer le planning des formateurs de la semaine", { accord: await prix() });
    if (premiere.statut !== "en-cours") throw new Error(JSON.stringify(premiere));
    // Pendant que la tâche court : refusée (double clic), et sans contrôle de sujet.
    await depots().videos.enregistrer(video("v-prete"));
    const doublon = await ecrire(SUJET_PROCHE, { accord: await prix(), videoId: premiere.videoId });
    expect(doublon.statut).toBe("refusee");
    // Tâche finie : la même vidéo peut être réécrite, même avec un sujet proche d'une vidéo prête.
    const v = (await depots().videos.obtenir(premiere.videoId))!;
    const entrees = { ...v.entrees } as Record<string, { tache?: unknown } & Record<string, unknown>>;
    for (const cle of Object.keys(entrees)) if (entrees[cle] && typeof entrees[cle] === "object" && "tache" in entrees[cle]!) delete entrees[cle]!.tache;
    await depots().videos.modifier(premiere.videoId, { entrees });
    const r = await ecrire(SUJET_PROCHE, { accord: await prix(), videoId: premiere.videoId });
    expect(r.statut).toBe("en-cours");
  });
});

describe("réglage sujets.garde", () => {
  it("« eteint » : exactement comme avant (même issue, mêmes champs), avec ou sans vidéo proche", async () => {
    await ecrireParametre("sujets.garde", "eteint");
    const sans = await ecrire(SUJET_PROCHE, { accord: await prix() });
    reinitialiserDepots();
    await auth.seConnecter(MDP, false);
    await ecrireParametre("sujets.garde", "eteint");
    await depots().videos.enregistrer(video("v-prete"));
    const avec = await ecrire(SUJET_PROCHE, { accord: await prix() });
    expect(sans.statut).toBe("en-cours");
    expect(avec.statut).toBe("en-cours");
    expect(Object.keys(avec).sort()).toEqual(Object.keys(sans).sort());
    expect(avec).not.toHaveProperty("avertissement");
  });

  it("« avertissement » : le sujet proche passe, avec l'avertissement", async () => {
    await ecrireParametre("sujets.garde", "avertissement");
    await depots().videos.enregistrer(video("v-prete"));
    const r = await ecrire(SUJET_PROCHE, { accord: await prix() });
    expect(r.statut).toBe("en-cours");
    if (r.statut === "en-cours") expect(r.avertissement?.precedents.map((p) => p.videoId)).toEqual(["v-prete"]);
  });
});

describe("D1 : un autre générateur prévient, sans bloquer", () => {
  it("sujet déjà traité en avocat : écriture lancée, avertissement avec la liste", async () => {
    await depots().videos.enregistrer(video("v-avocat", { formatId: "avocat" }));
    const r = await ecrire(SUJET_PROCHE, { accord: await prix() });
    expect(r.statut).toBe("en-cours");
    if (r.statut === "en-cours") expect(r.avertissement).toMatchObject({ precedents: [{ videoId: "v-avocat", generateur: "avocat" }] });
  });
});

describe("ordre de l'écran : le contrôle du sujet passe avant le prix", () => {
  it("nouvelle vidéo : le serveur contrôle d'abord ; brouillon existant ou autre accroche : le prix d'abord, comme avant", () => {
    expect(controleServeurAvantPrix({})).toBe(true);
    expect(controleServeurAvantPrix({ videoId: "v1" })).toBe(false);
    expect(controleServeurAvantPrix({ accroche: 2 })).toBe(false);
    expect(RELANCES_PRIX_MAX).toBeGreaterThan(0);
  });

  it("jeton périmé : le prix déjà confirmé n'est pas gardé (il est redemandé) ; sinon il l'est", () => {
    expect(accordApresRefus({ jetonPerime: true }, 132)).toBeUndefined();
    expect(accordApresRefus({}, 132)).toBe(132);
    expect(accordApresRefus({}, undefined)).toBeUndefined();
  });

  it("prix redemandé : trois fenêtres au plus (le premier « accord requis » passe toujours), puis arrêt", () => {
    const fenetres = [0, 1, 2, 3].filter((essai) => prixRedemandable(essai)).length;
    expect(prixRedemandable(0)).toBe(true);
    expect(fenetres).toBe(RELANCES_PRIX_MAX);
    expect(fenetres + 1).toBe(3);
    expect(prixRedemandable(RELANCES_PRIX_MAX)).toBe(false);
  });

  it("sans accord, un sujet en double est refusé AVANT « accord requis » (l'écran n'ouvre donc pas le prix)", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    expect((await ecrire(SUJET_PROCHE)).statut).toBe("sujet-deja-traite");
    expect((await ecrire("Préparer le planning des formateurs de la semaine")).statut).toBe("accord-requis");
  });

  it("la confirmation survit à un prix redemandé : même jeton, sans accord, on reçoit « accord requis », puis l'écriture part avec le prix", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    const refus = await ecrire(SUJET_PROCHE);
    if (refus.statut !== "sujet-deja-traite") throw new Error(JSON.stringify(refus));
    const sujet = { choix: "refaire" as const, jeton: refus.jeton };
    const prixDemande = await ecrire(SUJET_PROCHE, { sujet });
    expect(prixDemande.statut).toBe("accord-requis");
    expect((await ecrire(SUJET_PROCHE, { sujet, accord: await prix() })).statut).toBe("en-cours");
  });
});
