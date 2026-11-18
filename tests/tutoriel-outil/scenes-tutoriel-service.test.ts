/**
 * T-EXT-15 : service des scènes gardées. Éteint par défaut ; dépôts en mémoire (réglages remplacés), aucun appel, `fetch` interdit.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOGUE_BRIQUES } from "@/briques/plan-scenes/catalogue";
import { avecEmpreintes } from "@/briques/plan-scenes/empreinte";
import type { PlanDeScenes } from "@/briques/plan-scenes/schema";
import { decouperEnMorceaux, type MorceauPlan } from "@/moteurs/montage-tutoriel-outil/decoupage-scenes";
import { INDEX_VIDE, type MetaRangement } from "@/moteurs/montage-tutoriel-outil/index-scenes";

const etat = vi.hoisted(() => ({
  params: new Map<string, unknown>(),
  ecritures: [] as string[],
  journal: [] as string[],
  leveALaLecture: false,
  session: true,
}));

vi.mock("@/services/_commun", async (importOriginal) => {
  const vrai = await importOriginal<typeof import("@/services/_commun")>();
  return {
    ...vrai,
    lireParametre: async (id: string, defaut: unknown) => {
      if (etat.leveALaLecture && id === "tutoriel.scenesGardees") throw new Error("lecture impossible");
      return etat.params.has(id) ? etat.params.get(id) : defaut;
    },
    ecrireParametre: async (id: string, valeur: unknown) => {
      etat.ecritures.push(id);
      // Écriture asynchrone : sans verrou, deux rangements concurrents perdraient une entrée.
      await new Promise((r) => setTimeout(r, 5));
      etat.params.set(id, structuredClone(valeur));
    },
    journaliser: async (_type: string, message: string) => void etat.journal.push(message),
  };
});
vi.mock("@/services/auth", () => ({
  exigerSession: async () => {
    if (!etat.session) throw new Error("pas de session");
    return {};
  },
}));

const s = await import("@/services/scenes-tutoriel");

const MOTS = Array.from({ length: 6 }, (_, i) => ({ texte: `parole${i}secrete`, debutMs: 1000 + i * 400, finMs: 1000 + i * 400 + 400 }));
function morceaux(): MorceauPlan[] {
  const plan = avecEmpreintes({
    version: "plan-scenes-1",
    format: { largeur: 1080, hauteur: 1350, fps: 25 },
    facecam: false,
    dureeMs: 4000,
    habillage: { fond: "ivoire", accent: "terracotta" },
    mots: MOTS,
    scenes: [0, 1].map((i) => ({
      version: 1,
      niveau: 1,
      position: "centre",
      transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 },
      id: `s${i + 1}`,
      mots: { premier: i * 3, dernier: i * 3 + 2 },
      debutMs: MOTS[i * 3]!.debutMs,
      finMs: MOTS[i * 3 + 2]!.finMs,
      piece: "fenetre-app",
      parametres: CATALOGUE_BRIQUES["fenetre-app"].exemple,
    })),
  } as unknown as PlanDeScenes);
  const r = decouperEnMorceaux({ plan });
  if (!r.ok) throw new Error("découpage fictif refusé");
  return r.morceaux;
}
const meta = (videoId: string): MetaRangement => ({
  videoId,
  versionVideoId: `${videoId}@1`,
  maquette: "maquette-exemple",
  sujet: null,
  licence: { type: "propriete", usageCommercial: true, reseaux: [] },
  famille: [],
  le: "2026-11-18T10:00:00.000Z",
});
const allumer = () => etat.params.set(s.PARAM_SCENES_TUTORIEL, true);

beforeEach(() => {
  etat.params.clear();
  etat.ecritures.length = 0;
  etat.journal.length = 0;
  etat.leveALaLecture = false;
  etat.session = true;
  vi.stubGlobal("fetch", () => {
    throw new Error("fetch interdit");
  });
});

describe("éteint par défaut", () => {
  const cas: [string, () => void][] = [
    ["absent", () => undefined],
    ['"true"', () => etat.params.set(s.PARAM_SCENES_TUTORIEL, "true")],
    ["1", () => etat.params.set(s.PARAM_SCENES_TUTORIEL, 1)],
    ["null", () => etat.params.set(s.PARAM_SCENES_TUTORIEL, null)],
    ["lecture qui lève", () => (etat.leveALaLecture = true)],
  ];
  it.each(cas)("réglage %s : index vide, gestes refusés, aucune écriture", async (_nom, preparer) => {
    preparer();
    expect(await s.lireScenesGardees()).toEqual(INDEX_VIDE);
    const attendu = { code: "FONCTION_FERMEE", message: "La bibliothèque de scènes n'est pas ouverte pour le moment." };
    await expect(s.rangerScenesDeVideo({ morceaux: morceaux(), meta: meta("v-1") })).rejects.toMatchObject(attendu);
    await expect(s.validerSceneGardee("scene:v-1:s1:v1")).rejects.toMatchObject(attendu);
    await expect(s.retirerSceneGardee("scene:v-1:s1:v1")).rejects.toMatchObject(attendu);
    expect(etat.ecritures).toEqual([]);
  });

  it("un index stocké n'est pas lu tant que c'est éteint", async () => {
    await (async () => {
      allumer();
      await s.rangerScenesDeVideo({ morceaux: morceaux(), meta: meta("v-1") });
      etat.params.delete(s.PARAM_SCENES_TUTORIEL);
    })();
    expect(await s.lireScenesGardees()).toEqual(INDEX_VIDE);
  });
});

describe("allumé", () => {
  it("le rangement s'écrit sous tutoriel.index-scenes et se relit identique", async () => {
    allumer();
    const retour = await s.rangerScenesDeVideo({ morceaux: morceaux(), meta: meta("v-1") });
    expect(etat.ecritures).toEqual([s.PARAM_INDEX_SCENES]);
    expect(s.PARAM_INDEX_SCENES).toBe("tutoriel.index-scenes");
    expect(await s.lireScenesGardees()).toEqual(retour);
    expect(retour.entrees.map((e) => e.etat)).toEqual(["brouillon", "brouillon"]);
  });

  it("un rangement identique n'écrit rien de plus", async () => {
    allumer();
    await s.rangerScenesDeVideo({ morceaux: morceaux(), meta: meta("v-1") });
    await s.rangerScenesDeVideo({ morceaux: morceaux(), meta: meta("v-1") });
    expect(etat.ecritures).toHaveLength(1);
  });

  it("valider puis retirer : la scène reste dans l'index", async () => {
    allumer();
    await s.rangerScenesDeVideo({ morceaux: morceaux(), meta: meta("v-1") });
    const v = await s.validerSceneGardee("scene:v-1:s1:v1");
    expect(v.entrees[0]!.etat).toBe("validee");
    await expect(s.validerSceneGardee("scene:v-1:s1:v1")).rejects.toMatchObject({ code: "SCENE_REFUSEE" });
    const r = await s.retirerSceneGardee("scene:v-1:s1:v1");
    expect(r.entrees).toHaveLength(2);
    expect(r.entrees[0]!.etat).toBe("retiree");
  });

  it("les gestes de Williams exigent une session ; le rangement n'en demande pas", async () => {
    allumer();
    await s.rangerScenesDeVideo({ morceaux: morceaux(), meta: meta("v-1") });
    etat.session = false;
    await expect(s.validerSceneGardee("scene:v-1:s1:v1")).rejects.toThrow("pas de session");
    await expect(s.retirerSceneGardee("scene:v-1:s1:v1")).rejects.toThrow("pas de session");
    await expect(s.rangerScenesDeVideo({ morceaux: morceaux(), meta: meta("v-2") })).resolves.toBeDefined();
  });

  it("deux rangements concurrents : aucune entrée perdue (verrou)", async () => {
    allumer();
    await Promise.all([
      s.rangerScenesDeVideo({ morceaux: morceaux(), meta: meta("v-1") }),
      s.rangerScenesDeVideo({ morceaux: morceaux(), meta: meta("v-2") }),
      s.rangerScenesDeVideo({ morceaux: morceaux(), meta: meta("v-3") }),
    ]);
    const index = await s.lireScenesGardees();
    expect(index.entrees.map((e) => e.videoId).sort()).toEqual(["v-1", "v-1", "v-2", "v-2", "v-3", "v-3"]);
  });

  it("un index stocké illisible : lecture vide, une ligne de journal sans parole, jamais écrasé", async () => {
    allumer();
    etat.params.set(s.PARAM_INDEX_SCENES, { version: "inconnue", entrees: [] });
    expect(await s.lireScenesGardees()).toEqual(INDEX_VIDE);
    expect(etat.journal).toHaveLength(1);
    await expect(s.rangerScenesDeVideo({ morceaux: morceaux(), meta: meta("v-1") })).rejects.toMatchObject({ code: "INDEX_ILLISIBLE" });
    expect(etat.ecritures).toEqual([]);
  });

  it("le journal et les erreurs ne contiennent jamais texteDit", async () => {
    allumer();
    await s.rangerScenesDeVideo({ morceaux: morceaux(), meta: meta("v-1") });
    await s.validerSceneGardee("scene:v-1:s1:v1");
    await s.retirerSceneGardee("scene:v-1:s1:v1");
    const erreurs: string[] = [];
    await s.validerSceneGardee("scene:v-1:s1:v1").catch((e: Error) => erreurs.push(e.message));
    await s.validerSceneGardee("scene:inconnue:s9:v1").catch((e: Error) => erreurs.push(e.message));
    etat.params.set(s.PARAM_INDEX_SCENES, { version: "x", entrees: [] });
    await s.lireScenesGardees();
    await s.rangerScenesDeVideo({ morceaux: morceaux(), meta: meta("v-2") }).catch((e: Error) => erreurs.push(e.message));
    expect(etat.journal.length).toBeGreaterThan(3);
    expect(erreurs.length).toBe(3);
    for (const ligne of [...etat.journal, ...erreurs]) expect(ligne).not.toMatch(/parole\d+secrete/);
  });
});
