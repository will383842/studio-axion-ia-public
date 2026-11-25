/**
 * FIN-7 : refus AVANT toute création (script de plus de 20 min, rendu non relié en production). Dépôts en mémoire, vraie
 * garde de fabrication ; modules HeyGen / ElevenLabs piégés : 0 appel sur tous les lancements sans voix.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const pieges = vi.hoisted(() => {
  const appels: string[] = [];
  const moduleEspion = (nom: string) => async (importOriginal: () => Promise<Record<string, unknown>>) => {
    const vrai = await importOriginal();
    return Object.fromEntries(
      Object.entries(vrai).map(([cle, v]) => [
        cle,
        typeof v === "function" && /^[a-z]/.test(cle)
          ? () => {
              appels.push(`${nom}.${cle}`);
              throw new Error(`${nom}.${cle} ne doit pas être appelé`);
            }
          : v,
      ]),
    );
  };
  return { appels, moduleEspion };
});

vi.mock("@/fournisseurs/heygen/voix", (o) => pieges.moduleEspion("heygen/voix")(o as never));
vi.mock("@/fournisseurs/heygen/client", (o) => pieges.moduleEspion("heygen/client")(o as never));
vi.mock("@/fournisseurs/heygen/rendus", (o) => pieges.moduleEspion("heygen/rendus")(o as never));
vi.mock("@/fournisseurs/credits/heygen", (o) => pieges.moduleEspion("credits/heygen")(o as never));
vi.mock("@/fournisseurs/credits/elevenlabs", (o) => pieges.moduleEspion("credits/elevenlabs")(o as never));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { depots, ecrireParametre } = await import("@/services/_commun");
const auth = await import("@/services/auth");
const { lancerVideoLongue, PHRASE_TROP_LONGUE_LECTURE, PHRASE_RENDU_NON_RELIE, PHRASE_DEPENSES_COUPEES } = await import("@/services/video-longue-creation");

const MDP = "essai-gardes-lancement-video-longue-fin7";
const MOTS_PAR_SEC = 2.6;
const script = (minutes: number) => [{ id: "c1", titre: "Tout", texte: Array.from({ length: Math.round(minutes * 60 * MOTS_PAR_SEC) }, () => "mot").join(" ") }];
const petit = [{ id: "c1", titre: "Le problème", texte: "Voici le problème. Il est simple." }];

let fetchPaye: string[] = [];
let lancements = 0;
const lancer = async () => {
  lancements++;
  return { statut: "lancee" as const, travailId: "t-simule" };
};
const nombreVideos = async () => (await depots().videos.lister()).length;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  pieges.appels.length = 0;
  fetchPaye = [];
  lancements = 0;
  const reel = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (entree, init) => {
    const url = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree.url;
    if (/heygen|elevenlabs/i.test(url)) {
      fetchPaye.push(url);
      throw new Error(`fetch vers ${url} interdit`);
    }
    return reel(entree, init);
  });
  await auth.seConnecter(MDP, false);
  await ecrireParametre("videoLongue.actif", true);
});

afterEach(() => {
  vi.restoreAllMocks();
  // Rien n'est payant : aucun test de ce fichier n'a le droit de toucher HeyGen ou ElevenLabs.
  expect(pieges.appels).toEqual([]);
  expect(fetchPaye).toEqual([]);
});

describe("B7 : durée de lecture bornée à 20 min avant création", () => {
  it("script de 21 min : refus, aucune vidéo créée, aucun lancement", async () => {
    const avant = await nombreVideos();
    const r = await lancerVideoLongue({ question: "Q", chapitres: script(21), sansVoix: true }, { montageRelie: true, lancer });
    expect(r).toEqual({ statut: "refusee", phrase: PHRASE_TROP_LONGUE_LECTURE });
    expect(await nombreVideos()).toBe(avant);
    expect(lancements).toBe(0);
  });
  it("script de 19 min : accepté", async () => {
    const r = await lancerVideoLongue({ question: "Q", chapitres: script(19), sansVoix: true }, { montageRelie: true, lancer });
    expect(r.statut).toBe("lancee");
    expect(lancements).toBe(1);
  }, 60_000);
});

describe("B9 : rendu non relié en production", () => {
  it("production avec rendu simulé (injecté) : refus, rien n'est créé", async () => {
    const avant = await nombreVideos();
    const r = await lancerVideoLongue({ question: "Q", chapitres: petit, sansVoix: true }, { montageRelie: true, renduRelie: () => false, lancer });
    expect(r).toEqual({ statut: "refusee", phrase: PHRASE_RENDU_NON_RELIE });
    expect(await nombreVideos()).toBe(avant);
    expect(lancements).toBe(0);
  });
  it("rendu relié (ou hors production) : accepté", async () => {
    const r = await lancerVideoLongue({ question: "Q", chapitres: petit, sansVoix: true }, { montageRelie: true, renduRelie: () => true, lancer });
    expect(r.statut).toBe("lancee");
    const horsProd = await lancerVideoLongue({ question: "Q", chapitres: petit, sansVoix: true }, { montageRelie: true, lancer });
    expect(horsProd.statut).toBe("lancee");
  }, 60_000);
  it("en production, sans injection : un rendu simulé refuse avant toute création", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STUDIO_RENDU_URL", "");
    try {
      const avant = await nombreVideos();
      const r = await lancerVideoLongue({ question: "Q", chapitres: petit, sansVoix: true }, { montageRelie: true, lancer });
      expect(r).toEqual({ statut: "refusee", phrase: PHRASE_RENDU_NON_RELIE });
      expect(await nombreVideos()).toBe(avant);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("témoin : aucune garde relâchée", () => {
  it("options payantes coupées : le refus existant est inchangé", async () => {
    const avant = await nombreVideos();
    const r = await lancerVideoLongue(
      { question: "Q", chapitres: petit, sansVoix: true },
      { montageRelie: true, renduRelie: () => true, lancer, lire: async (cle) => cle === "videoLongue.actif" || cle === "optionsPayantes.coupees" },
    );
    expect(r).toEqual({ statut: "refusee", phrase: PHRASE_DEPENSES_COUPEES });
    expect(await nombreVideos()).toBe(avant);
    expect(lancements).toBe(0);
  });
});
