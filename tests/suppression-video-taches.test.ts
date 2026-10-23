/**
 * Suppression définitive · tâches de fond sans travail en cours (relecture PR #334, défaut bloquant n° 2).
 *  - une tâche du tableau animé active (écriture, découpage) ou des finitions encore à faire (miniatures, kit) refusent
 *    la suppression : « … est en cours de préparation : attendez la fin. » ;
 *  - un appel déjà parti qui revient APRÈS la suppression n'écrit rien, ne plante pas, ne recrée aucun document.
 * Dépôts en mémoire, doubles de Claude (aucun réseau réel), rien de payé.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { repereTexte } from "@/domaine/relecture-tableau";
import { AUJOURDHUI_EXEMPLES, ficheErreurCorrigee, texteScriptDe } from "./tableau/regles/exemples";
import type { Video } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots, prendreBail, rendreBail } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const videos = await import("@/services/videos");
const creation = await import("@/services/tableau-creation");
const taches = await import("@/services/tableau-taches");
const { executerSuppression } = await import("@/services/suppression-video");
const { executerSuites } = await import("@/services/travaux");

const MDP = "essai-suppression-taches";
const ID = "v-01";
const H = { creeLe: "2026-10-01T00:00:00.000Z", modifieLe: "2026-10-01T00:00:00.000Z" };
const fetchInterdit = () => Promise.reject(new Error("fetch interdit dans les tests"));

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  taches.tachesEnCours().clear();
  await auth.seConnecter(MDP, false);
  vi.stubGlobal("fetch", fetchInterdit);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Un brouillon du tableau animé avec une tâche de découpage en attente (prix confirmé). */
async function brouillonEnDecoupage(): Promise<string> {
  const fiche = ficheErreurCorrigee;
  const donnees = { texte: texteScriptDe(fiche), serieCode: "formation", structure: fiche.structure, douleur: fiche.douleur, gesteMinute: fiche.gesteMinute, finId: null, reseaux: ["verticaux"] };
  const relu = repereTexte(donnees.texte);
  const p = await creation.decouperScriptTableau(donnees, { relu }, { aujourdhui: AUJOURDHUI_EXEMPLES });
  if (p.statut !== "accord-requis") throw new Error(JSON.stringify(p));
  const r = await creation.decouperScriptTableau(donnees, { accord: p.centimes, relu }, { aujourdhui: AUJOURDHUI_EXEMPLES });
  if (r.statut !== "en-cours") throw new Error(JSON.stringify(r));
  return r.videoId;
}

const PREPARATION = /est en cours de préparation : attendez la fin\./;

describe("suppression définitive · refus pendant une tâche de fond", () => {
  // 2e relecture, défaut B : une tâche EN ATTENTE ne refuse plus (brouillon abandonné bloqué à vie) ; seul l'appel en
  // cours refuse (`suppression-video-issues`).
  it("tableau animé : tâche en cours → refusée, rien n'est effacé ; tâche terminée → acceptée", async () => {
    const videoId = await brouillonEnDecoupage();
    const tache = (await taches.lireTache(videoId))!;
    await taches.modifierTache(videoId, tache.id, (t) => t && { ...t, statut: "en-cours", enVol: { etape: "decoupage", le: H.creeLe } });
    await expect(videos.supprimerVideoDefinitivement(videoId)).rejects.toMatchObject({ code: "EN_FABRICATION", message: expect.stringMatching(PREPARATION) });
    expect(await depots().videos.obtenir(videoId)).not.toBeNull();
    await taches.modifierTache(videoId, tache.id, (t) => t && { ...t, statut: "terminee", enVol: undefined });
    expect(await videos.supprimerVideoDefinitivement(videoId)).toBe(true);
  });

  // 2e relecture, défaut A : la NOTE de finition ne refuse plus (une finition ratée à chaque fois bloquait à vie) ; seul
  // le passage en cours refuse (`suppression-video-issues`). La note part avec la vidéo.
  it("finitions notées sur un travail terminé (miniatures, kit) → acceptée, la note part avec la vidéo", async () => {
    const d = depots();
    const suite = { type: "finition" as const, videoId: ID, titre: "t", ratio: "9:16" as const, travailId: "trv-fin" };
    await d.travaux.enregistrer({ id: "trv-fin", type: "fabrication", cibleId: ID, titre: "t", etapes: [], statut: "termine", progression: 100, tentatives: 1, cleIdempotence: "k", fournisseurUtilise: "simulation", finitionAFaire: [suite], ...H });
    expect(await videos.supprimerVideoDefinitivement(ID)).toBe(true);
    expect(await d.travaux.obtenir("trv-fin")).toBeNull();
  });

  it("finitions notées dans les réglages (lancées hors du tour) → acceptée, la note part avec la vidéo", async () => {
    await depots().parametres.enregistrer({ id: "fabrication.finitionAFaire.trv-hors", valeur: { le: H.creeLe, suites: [{ type: "finition", videoId: ID, titre: "t", ratio: "9:16", travailId: "trv-hors" }] }, ...H });
    expect(await videos.supprimerVideoDefinitivement(ID)).toBe(true);
    expect(await depots().parametres.obtenir("fabrication.finitionAFaire.trv-hors")).toBeNull();
  });

  it("lanceur image → vidéo vivant (bail tenu, même sans travail en cours) → refusée ; bail rendu → acceptée", async () => {
    expect(await prendreBail(`lanceur-image-video:${ID}`, "lanceur-x", 60_000)).toBe(true);
    await expect(videos.supprimerVideoDefinitivement(ID)).rejects.toMatchObject({ code: "EN_FABRICATION", message: expect.stringMatching(PREPARATION) });
    await rendreBail(`lanceur-image-video:${ID}`, "lanceur-x");
    expect(await videos.supprimerVideoDefinitivement(ID)).toBe(true);
  });

  it("« Arrêter » puis supprimer : l'appel du moteur encore en vol (travail annulé) → refusée ; revenu → acceptée", async () => {
    const d = depots();
    await d.travaux.enregistrer({ id: "trv-arrete", type: "fabrication", cibleId: ID, titre: "t", etapes: [], statut: "annule", progression: 40, tentatives: 1, cleIdempotence: "k", fournisseurUtilise: "simulation", ...H });
    const { avancementsEnVol } = await import("@/services/boucle");
    avancementsEnVol().set("trv-arrete", Promise.resolve());
    try {
      await expect(videos.supprimerVideoDefinitivement(ID)).rejects.toMatchObject({ code: "EN_FABRICATION", message: expect.stringMatching(PREPARATION) });
    } finally {
      avancementsEnVol().delete("trv-arrete");
    }
    expect(await videos.supprimerVideoDefinitivement(ID)).toBe(true);
  });

  it("finitions d'une AUTRE vidéo : la suppression passe", async () => {
    await depots().parametres.enregistrer({ id: "fabrication.finitionAFaire.trv-autre", valeur: { le: H.creeLe, suites: [{ type: "finition", videoId: "v-03", titre: "t", ratio: "9:16" }] }, ...H });
    expect(await videos.supprimerVideoDefinitivement(ID)).toBe(true);
  });
});

describe("suppression définitive · retour tardif d'un appel", () => {
  it("découpage du tableau : la vidéo supprimée pendant l'appel → rien n'est écrit ni recréé, aucune erreur", async () => {
    const videoId = await brouillonEnDecoupage();
    const d = depots();
    const journal = vi.spyOn(console, "error").mockImplementation(() => undefined);
    // Le journal de la vidéo est GARDÉ à la suppression (D2) : on vérifie qu'aucune entrée de plus n'est écrite après.
    let gardes = -1;
    await creation.travaillerTachesTableau({
      aujourdhui: AUJOURDHUI_EXEMPLES,
      appeler: async () => {
        // Suppression arrivée pendant l'appel (le refus a été contourné : course entre deux processus).
        gardes = await d.evenements.compter((e) => e.entiteId === videoId);
        await executerSuppression((await d.videos.obtenir(videoId)) as Video);
        return { ok: false as const, arret: "appel", message: "réponse arrivée après la suppression" };
      },
    });
    expect(await d.videos.obtenir(videoId)).toBeNull();
    expect(await d.evenements.compter((e) => e.entiteId === videoId && e.type !== "video_supprimee")).toBe(gardes);
    expect(await d.tracesTableau.compter((x) => x.videoId === videoId)).toBe(0);
    expect(journal.mock.calls.filter((c) => String(c[0]).includes("[tableau]") && !String(c[0]).includes("supprimée"))).toEqual([]);
  });

  it("finitions d'une vidéo supprimée : aucune miniature, aucun kit, aucun réglage recréé, aucune erreur", async () => {
    const d = depots();
    const v = (await d.videos.obtenir(ID))!;
    await executerSuppression(v);
    const journal = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await executerSuites([{ type: "finition", videoId: ID, titre: "t", ratio: "9:16", textes: true, travailId: "trv-parti" }]);
    expect(await d.miniatures.compter((m) => m.videoId === ID)).toBe(0);
    expect(await d.kits.compter((k) => k.videoId === ID)).toBe(0);
    expect(await d.parametres.obtenir("fabrication.finitionAFaire.trv-parti")).toBeNull();
    expect(journal).not.toHaveBeenCalled();
  });

  it("vitrine du lanceur image → vidéo publiée après la suppression : ni version ni travail recréés", async () => {
    const { publierVitrineIV } = await import("@/services/image-video-lanceur");
    const d = depots();
    await executerSuppression((await d.videos.obtenir(ID))!);
    const r = await publierVitrineIV({ videoId: ID, titre: "t", etat: { journal: [] } as never, entrees: {} });
    expect(r.attendWill).toBeNull();
    expect(await d.versions.obtenir(`ver-${ID}-lanceur`)).toBeNull();
    expect(await d.travaux.obtenir(`iv-lanceur-${ID}`)).toBeNull();
  });

  it("cas concret : la réponse d'un appel détaché revenue après la suppression n'est pas gardée", async () => {
    const { appelsDetaches } = await import("@/services/cas-concret-branchements");
    const d = depots();
    await executerSuppression((await d.videos.obtenir(ID))!);
    let fini!: () => void;
    const termine = new Promise<void>((ok) => (fini = ok));
    const c = `ccecr-${ID}-ver-1-0.abc.1`;
    appelsDetaches().lancer(c, async () => {
      setTimeout(fini, 0);
      return { ok: false, arret: "panne", message: "x" } as never;
    });
    await termine;
    await new Promise((ok) => setTimeout(ok, 20));
    expect(await d.parametres.obtenir(`casConcret.appel.${c}`)).toBeNull();
    // Une vidéo qui existe garde bien sa réponse.
    const c2 = "ccecr-v-03-ver-1-0.abc.1";
    appelsDetaches().lancer(c2, async () => ({ ok: false, arret: "panne", message: "x" }) as never);
    await vi.waitFor(async () => expect(await d.parametres.obtenir(`casConcret.appel.${c2}`)).not.toBeNull());
  });

  it("facecam : le monteur revenu après la suppression n'écrit rien sur la vidéo, aucune erreur", async () => {
    vi.doMock("@/services/monteur-facecam", () => ({
      monteurPourFabrication: async (videoId: string) => {
        await executerSuppression((await depots().videos.obtenir(videoId))!);
        return { entrees: { facecam: {}, facecamMonteur: {} }, resultat: { etat: { facecam: { passages: [] } } } };
      },
    }));
    await import("@/services/facecam-branchements");
    const { servicesFacecam } = await import("@/moteurs/montage-facecam/dependances");
    const monteur = servicesFacecam().monteur!({ videoId: ID } as never, "trv-x");
    await expect(monteur!({ entrees: {}, mots: [], dureePriseSec: 1 } as never)).resolves.toBeTruthy();
    expect(await depots().videos.obtenir(ID)).toBeNull();
    vi.doUnmock("@/services/monteur-facecam");
  });
});
