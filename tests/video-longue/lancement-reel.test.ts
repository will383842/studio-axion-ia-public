/**
 * UI-3 · TEST « 0 appel payant » RÉEL : le vrai lancement commun (lancerAvecAccord -> lancerFabrication), dépôt et réglage
 * en mémoire, SANS `lancer` injecté. Les modules payants HeyGen / ElevenLabs lèvent et notent l'appel, `fetch` échoue sur
 * tout hôte heygen / elevenlabs. Sans voix : 0 appel, aucune réservation de voix. Avec voix (non reliée) : refus, rien créé.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const pieges = vi.hoisted(() => {
  const appels: string[] = [];
  /** Le vrai module, sauf que chaque FONCTION (nom en minuscule) lève et note l'appel ; classes et constantes restent. */
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
const { lancerVideoLongue, PHRASE_VOIX_NON_RELIEE } = await import("@/services/video-longue-creation");

const MDP = "essai-lancement-reel-video-longue-ui3";
const chapitres = [
  { id: "c1", titre: "Le problème", texte: "Voici le problème. Il est simple." },
  { id: "c2", titre: "La solution", texte: "Voici la solution. Elle marche." },
];
const HOTES_PAYANTS = /heygen|elevenlabs/i;
let fetchPaye: string[] = [];

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  pieges.appels.length = 0;
  fetchPaye = [];
  const reel = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (entree, init) => {
    const url = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree.url;
    if (HOTES_PAYANTS.test(url)) {
      fetchPaye.push(url);
      throw new Error(`fetch vers ${url} interdit`);
    }
    return reel(entree, init);
  });
  await auth.seConnecter(MDP, false);
  await ecrireParametre("videoLongue.actif", true);
});

afterEach(() => vi.restoreAllMocks());

describe("vidéo longue : aucun appel payant", () => {
  it("sans voix, par le VRAI lancement : 0 appel HeyGen / ElevenLabs, aucune réservation de voix", async () => {
    const r = await lancerVideoLongue({ question: "Pourquoi ?", chapitres, sansVoix: true });
    expect(r.statut).toBe("lancee");
    if (r.statut !== "lancee") return;
    const v = await depots().videos.obtenir(r.videoId);
    expect(v?.distribution).toEqual([]);
    expect((await depots().travaux.lister()).some((t) => t.cibleId === r.videoId)).toBe(true);
    expect(pieges.appels).toEqual([]);
    expect(fetchPaye).toEqual([]);
    // Aucune réservation de crédit voix : le crédit HeyGen / ElevenLabs n'est jamais lu ni débité (modules pièges ci-dessus).
    expect(pieges.appels.filter((x) => /credits\//.test(x))).toEqual([]);
  }, 60_000);

  it("avec voix (non reliée) : refus clair, rien créé, 0 appel", async () => {
    const avant = (await depots().videos.lister()).length;
    const r = await lancerVideoLongue({ question: "Q", chapitres, accordVoix: true });
    expect(r).toEqual({ statut: "refusee", phrase: PHRASE_VOIX_NON_RELIEE });
    expect((await depots().videos.lister()).length).toBe(avant);
    expect(pieges.appels).toEqual([]);
    expect(fetchPaye).toEqual([]);
  });
});
