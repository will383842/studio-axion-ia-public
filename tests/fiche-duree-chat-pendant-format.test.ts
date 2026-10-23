/**
 * Constats prod 10/10 (vidéo face caméra) :
 *  1. la durée affichée est la durée RÉELLE de la version choisie (sortie montée), l'estimation du script seulement
 *     avant le montage (« environ ») ;
 *  2. un « Nouveau format » qui se fabrique ne bloque pas la vidéo : un geste (fil du monteur, Coupes, Image, Cartes)
 *     part en nouvelle version, qui reprend le format en cours ; l'ancien travail de format est arrêté.
 * Dépôts en mémoire, aucun réseau.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

/** `lancerRetouche` remplacé : une nouvelle version (entrées données) et son travail, sans moteur. */
const retouches: { videoId: string; consigne: string; entrees?: Record<string, unknown> }[] = [];
vi.mock("@/services/fabrication", async (original) => {
  const vrai = await original<typeof import("@/services/fabrication")>();
  return {
    ...vrai,
    lancerRetouche: async (videoId: string, _plans: string[], consigne: string, options: { entrees?: Record<string, unknown> } = {}) => {
      const { depots } = await import("@/donnees/memoire");
      const v = (await depots().videos.obtenir(videoId))!;
      const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
      const n = retouches.push({ videoId, consigne, entrees: options.entrees });
      const versionId = `ver-f-${n}`;
      const travailId = `trav-f-${n}`;
      await depots().versions.enregistrer({ ...ver, id: versionId, numero: 100 + n, parentVersionId: ver.id, choisie: false, travailId, commande: { ...ver.commande, entrees: options.entrees ?? {} } });
      await depots().travaux.enregistrer({ id: travailId, type: "retouche", cibleId: videoId, versionId, titre: "Retouche", etapes: [], statut: "en_cours", progression: 0, tentatives: 0, cleIdempotence: travailId, fournisseurUtilise: "simulation", creeLe: ver.creeLe, modifieLe: ver.creeLe } as never);
      return { retoucheId: `ret-${n}`, travailId };
    },
  };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { dureeDeLaVideo, libelleDureeVideo } = await import("@/domaine/duree-video");
const { versCarte } = await import("@/services/presentation");
const { obtenirVideo } = await import("@/services/videos");
const { retoucherImage } = await import("@/services/monteur-facecam");
const { reprendreFormatsEnCours } = await import("@/services/formats-facecam");

const MDP = "essai-fiche-duree";
const VIDEO = "v-04";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  retouches.length = 0;
  vi.stubGlobal("fetch", (async () => {
    throw new Error("réseau interdit");
  }) as typeof fetch);
  await auth.seConnecter(MDP, false);
  const v = (await depots().videos.obtenir(VIDEO))!;
  const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
  await depots().videos.modifier(VIDEO, { formatId: "facecam", statut: "prete", ratios: ["9:16", "4:5"] });
  await depots().versions.modifier(ver.id, { commande: { ...ver.commande, formatId: "facecam", ratios: ["9:16"], entrees: {} }, statut: "prete" });
});
afterEach(() => vi.unstubAllGlobals());

async function versionCourante() {
  return (await depots().videos.obtenir(VIDEO))!.versionChoisieId!;
}

/** Un « Nouveau format » 4:5 en cours sur la version choisie. */
async function formatEnCours(id = "trav-format-45") {
  const maintenant = new Date().toISOString();
  await depots().travaux.enregistrer({ id, type: "reexport", cibleId: VIDEO, versionId: await versionCourante(), titre: "Nouveau format", etapes: [], statut: "en_cours", progression: 40, tentatives: 0, cleIdempotence: id, fournisseurUtilise: "simulation", parametres: { ratio: "4:5" }, creeLe: maintenant, modifieLe: maintenant } as never);
  return id;
}

describe("constat 1 · durée réelle de la version choisie", () => {
  it("sortie montée : sa durée mesurée (82,76 s → « 1 min 23 ») ; sans sortie : l'estimation, « environ »", () => {
    expect(dureeDeLaVideo(113, { dureeSec: 82.76 })).toEqual({ sec: 82.76, estimee: false });
    expect(libelleDureeVideo(dureeDeLaVideo(113, { dureeSec: 82.76 }))).toBe("1 min 23");
    expect(dureeDeLaVideo(113, null)).toEqual({ sec: 113, estimee: true });
    expect(dureeDeLaVideo(113, { dureeSec: 0 })).toEqual({ sec: 113, estimee: true });
    expect(libelleDureeVideo(dureeDeLaVideo(113, undefined))).toBe("environ 1 min 53");
    expect(libelleDureeVideo({ sec: 45.4, estimee: false })).toBe("45 s");
  });

  it("cartes (listes, calendrier) : la durée de la sortie principale de la version choisie, pas celle du script", async () => {
    const ver = await versionCourante();
    const sorties = await depots().sorties.lister((s) => s.versionId === ver);
    expect(sorties.length).toBeGreaterThan(0);
    for (const s of sorties) await depots().sorties.modifier(s.id, { dureeSec: 82.76 });
    await depots().videos.modifier(VIDEO, { dureeCibleSec: 113 });
    const carte = await versCarte((await depots().videos.obtenir(VIDEO))!);
    expect(carte.dureeCibleSec).toBe(113);
    expect(carte.dureeSec).toBe(82.76);
    expect(carte.dureeEstimee).toBe(false);
  });
});

describe("constat 2 · fil du monteur pendant un format secondaire", () => {
  it("fiche : la fabrication de la vidéo passe avant le format ajouté ; seul, le format reste le travail suivi", async () => {
    const f = await formatEnCours();
    expect((await obtenirVideo(VIDEO))!.travail?.id).toBe(f);
    const maintenant = new Date(Date.now() + 1000).toISOString();
    await depots().travaux.enregistrer({ id: "trav-retouche", type: "retouche", cibleId: VIDEO, versionId: await versionCourante(), titre: "Retouche", etapes: [], statut: "en_cours", progression: 10, tentatives: 0, cleIdempotence: "trav-retouche", fournisseurUtilise: "simulation", creeLe: maintenant, modifieLe: maintenant } as never);
    // Le format, plus récent, ne passe pas devant la retouche.
    await depots().travaux.modifier(f, { creeLe: new Date(Date.now() + 5000).toISOString() });
    expect((await obtenirVideo(VIDEO))!.travail?.id).toBe("trav-retouche");
  });

  it("un geste pendant le format : nouvelle version qui reprend le 4:5, l'ancien travail de format est arrêté", async () => {
    const f = await formatEnCours();
    const avant = await versionCourante();
    const r = await retoucherImage(VIDEO, { lumiere: "plus" });
    expect(r.travailId).toBe("trav-f-1");
    expect(retouches).toHaveLength(1);
    expect((retouches[0].entrees?.facecamFormats as { ratios: string[] }).ratios).toEqual(["4:5"]);
    expect((await depots().travaux.obtenir(f))!.statut).toBe("annule");
    // La vidéo reste prête sur sa version, avec ses formats ; rien n'est écrit sur la version d'avant par la retouche.
    const v = (await depots().videos.obtenir(VIDEO))!;
    expect(v.versionChoisieId).toBe(avant);
    expect(v.ratios).toEqual(["9:16", "4:5"]);
    expect(v.statut).not.toBe("annulee");
  });

  it("sans format en cours : entrées inchangées, rien n'est arrêté", async () => {
    const e = { facecam: { passages: [] } };
    expect(await reprendreFormatsEnCours(VIDEO, e)).toEqual({ entrees: e, travaux: [], noms: [] });
    await retoucherImage(VIDEO, { lumiere: "plus" });
    expect(retouches[0].entrees?.facecamFormats).toBeUndefined();
  });

  it("formats déjà voulus gardés, le format en cours ajouté une seule fois, nommé pour le fil (« Portrait »)", async () => {
    await formatEnCours();
    const r = await reprendreFormatsEnCours(VIDEO, { facecamFormats: { version: 1, ratios: ["16:9", "4:5"] } });
    expect((r.entrees.facecamFormats as { ratios: string[] }).ratios).toEqual(["4:5", "16:9"]);
    expect(r.noms).toEqual(["Portrait"]);
  });
});
