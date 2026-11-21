/**
 * UI-3 · lancement de la vidéo longue : dépôts en mémoire, vraie garde de fabrication (`construireCommande`) via `lancer`
 * injecté, aucun appel réel. Sans voix : distribution vide, aucun accord, 0 appel HeyGen / ElevenLabs / branchementsReels.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const appels = { branchementsReels: 0, heygen: 0, elevenlabs: 0 };
vi.mock("@/services/tableau-outils", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/services/tableau-outils")>();
  return {
    ...reel,
    branchementsReels: async () => {
      appels.branchementsReels++;
      throw new Error("branchementsReels ne doit pas être appelé");
    },
  };
});

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { depots, ecrireParametre } = await import("@/services/_commun");
const auth = await import("@/services/auth");
const { construireCommande } = await import("@/services/fabrication");
const { lancerVideoLongue, PHRASE_VIDEO_LONGUE_ETEINTE, PHRASE_CHAPITRES_VIDES } = await import("@/services/video-longue-creation");
type Dep = import("@/services/video-longue-creation").DependancesVideoLongueCreation;

const MDP = "essai-lancement-video-longue-ui3";
const chapitres = [
  { id: "c1", titre: "Le problème", texte: "Voici le problème. Il est simple." },
  { id: "c2", titre: "La solution", texte: "Voici la solution. Elle marche." },
];

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  appels.branchementsReels = appels.heygen = appels.elevenlabs = 0;
  await auth.seConnecter(MDP, false);
});

function banc(actif: unknown = true) {
  const compte = { gardes: 0, abandons: [] as string[] };
  const dep: Dep = {
    lire: async (cle) => (cle === "videoLongue.actif" ? actif : false),
    lancer: async (id) => {
      compte.gardes++;
      await construireCommande(id);
      return { statut: "lancee", travailId: "t-simule" };
    },
    abandonner: async (id) => void compte.abandons.push(id),
  };
  return { compte, dep };
}

describe("lancer une vidéo longue", () => {
  it("sans voix : distribution vide, sansVoix rangé, aucun accord, la garde passe, 0 appel voix", async () => {
    const { compte, dep } = banc();
    const r = await lancerVideoLongue({ question: "Pourquoi ?", chapitres, sansVoix: true, accordVoix: false }, dep);
    expect(r.statut).toBe("lancee");
    if (r.statut !== "lancee") return;
    const v = await depots().videos.obtenir(r.videoId);
    expect(v?.distribution).toEqual([]);
    const vl = (v?.entrees as { videoLongue: Record<string, unknown> }).videoLongue;
    expect(vl.sansVoix).toBe(true);
    expect(vl.accord).toBeUndefined();
    expect(v?.ratios).toEqual(["16:9"]);
    expect(v?.scriptId).toBeTruthy();
    const script = await depots().scripts.obtenir(v!.scriptId!);
    expect(script?.blocs).toHaveLength(2);
    expect(compte.gardes).toBe(1);
    expect(compte.abandons).toEqual([]);
    expect((await construireCommande(r.videoId)).distribution).toEqual([]);
    expect(appels).toEqual({ branchementsReels: 0, heygen: 0, elevenlabs: 0 });
  });

  it("défaut (sans le champ) : avec voix, double exigé, accord de cette vidéo rangé si donné", async () => {
    const { dep } = banc();
    const r = await lancerVideoLongue({ question: "Pourquoi ?", chapitres, accordVoix: true }, dep);
    expect(r.statut).toBe("lancee");
    if (r.statut !== "lancee") return;
    const v = await depots().videos.obtenir(r.videoId);
    expect(v?.distribution.length).toBeGreaterThanOrEqual(1);
    const vl = (v?.entrees as { videoLongue: { sansVoix?: unknown; accord?: Record<string, unknown> } }).videoLongue;
    expect(vl.sansVoix).toBeUndefined();
    expect(vl.accord).toMatchObject({ donne: true, videoId: r.videoId });
    expect(vl.accord!.caracteres).toBeGreaterThan(0);
    expect(vl.accord!.morceaux).toBeGreaterThan(0);
  });

  it("avec voix sans accord donné : aucun accord rangé (le moteur refusera)", async () => {
    const { dep } = banc();
    const r = await lancerVideoLongue({ question: "Q", chapitres }, dep);
    if (r.statut !== "lancee") throw new Error("attendu : lancée");
    const v = await depots().videos.obtenir(r.videoId);
    expect((v?.entrees as { videoLongue: { accord?: unknown } }).videoLongue.accord).toBeUndefined();
  });

  it("avec voix, personne pour parler : refus, rien n'est créé", async () => {
    const { compte, dep } = banc();
    for (const p of await depots().personnages.lister()) await depots().personnages.supprimer(p.id);
    const avant = (await depots().videos.lister()).length;
    const r = await lancerVideoLongue({ question: "Q", chapitres, accordVoix: true }, dep);
    expect(r.statut).toBe("refusee");
    expect(compte.gardes).toBe(0);
    expect((await depots().videos.lister()).length).toBe(avant);
  });

  it.each([false, "true", 1, null])("réglage éteint (%s) : refus, rien de créé", async (valeur) => {
    const { compte, dep } = banc(valeur);
    const avant = (await depots().videos.lister()).length;
    const r = await lancerVideoLongue({ question: "Q", chapitres, sansVoix: true }, dep);
    expect(r).toEqual({ statut: "refusee", phrase: PHRASE_VIDEO_LONGUE_ETEINTE });
    expect(compte.gardes).toBe(0);
    expect((await depots().videos.lister()).length).toBe(avant);
  });

  it("réglage lu dans la base : éteint par défaut, allumé par true exact", async () => {
    const eteint = await lancerVideoLongue({ question: "Q", chapitres, sansVoix: true }, { lancer: banc().dep.lancer });
    expect(eteint.statut).toBe("refusee");
    await ecrireParametre("videoLongue.actif", true);
    const allume = await lancerVideoLongue({ question: "Q", chapitres, sansVoix: true }, { lancer: banc().dep.lancer });
    expect(allume.statut).toBe("lancee");
  });

  it("options payantes coupées : refus", async () => {
    const { dep } = banc();
    const r = await lancerVideoLongue({ question: "Q", chapitres, sansVoix: true }, { ...dep, lire: async () => true });
    expect(r.statut).toBe("refusee");
  });

  it("chapitres vides, sans texte, en double ou trop longs : refus, rien de créé", async () => {
    const { compte, dep } = banc();
    const avant = (await depots().videos.lister()).length;
    const vide = await lancerVideoLongue({ question: "Q", chapitres: [], sansVoix: true }, dep);
    expect(vide).toEqual({ statut: "refusee", phrase: PHRASE_CHAPITRES_VIDES });
    expect((await lancerVideoLongue({ question: "Q", chapitres: [{ id: "c1", titre: "", texte: "  " }], sansVoix: true }, dep)).statut).toBe("refusee");
    expect((await lancerVideoLongue({ question: "Q", chapitres: [chapitres[0]!, { ...chapitres[1]!, id: "c1" }], sansVoix: true }, dep)).statut).toBe("refusee");
    expect((await lancerVideoLongue({ question: "Q", chapitres: [{ id: "c1", titre: "", texte: "a".repeat(60_001) }], sansVoix: true }, dep)).statut).toBe("refusee");
    expect(compte.gardes).toBe(0);
    expect((await depots().videos.lister()).length).toBe(avant);
  });

  it("lancement refusé : le brouillon est abandonné", async () => {
    const { compte, dep } = banc();
    const r = await lancerVideoLongue({ question: "Q", chapitres, sansVoix: true }, { ...dep, lancer: async () => ({ statut: "accord-requis", centimes: 1, phrase: "x" }) });
    expect(r.statut).toBe("refusee");
    expect(compte.abandons).toHaveLength(1);
  });
});
