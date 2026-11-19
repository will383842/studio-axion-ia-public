/**
 * T-EXT-35 : écran « Scènes gardées » (vue, gestes, présentation). Éteint par défaut ; dépôts et réglages en mémoire,
 * aucun appel payant, aucun rendu, aucun navigateur, `fetch` interdit.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOGUE_BRIQUES } from "@/briques/plan-scenes/catalogue";
import { avecEmpreintes } from "@/briques/plan-scenes/empreinte";
import type { PlanDeScenes } from "@/briques/plan-scenes/schema";
import { outilsDoubles, type Journal } from "./doubles";
import { decouperEnMorceaux, type MorceauPlan } from "@/moteurs/montage-tutoriel-outil/decoupage-scenes";
import type { MetaRangement } from "@/moteurs/montage-tutoriel-outil/index-scenes";

const etat = vi.hoisted(() => ({
  params: new Map<string, unknown>(),
  ecritures: [] as string[],
  journal: [] as string[],
  session: true,
  erreurSession: null as Error | null,
  urls: [] as string[],
  videos: new Map<string, { titre: string }>(),
  versions: new Map<string, { projetMontage?: Record<string, unknown> }>(),
  sorties: [] as { id: string; versionId: string; ratio: string; fichierId: string }[],
}));

vi.mock("@/services/_commun", async (importOriginal) => {
  const vrai = await importOriginal<typeof import("@/services/_commun")>();
  return {
    ...vrai,
    lireParametre: async (id: string, defaut: unknown) => (etat.params.has(id) ? etat.params.get(id) : defaut),
    ecrireParametre: async (id: string, valeur: unknown) => {
      etat.ecritures.push(id);
      etat.params.set(id, structuredClone(valeur));
    },
    journaliser: async (_t: string, message: string) => void etat.journal.push(message),
    depots: () => ({
      videos: { obtenir: async (id: string) => etat.videos.get(id) ?? null },
      versions: { obtenir: async (id: string) => etat.versions.get(id) ?? null },
      sorties: {
        obtenir: async (id: string) => etat.sorties.find((s) => s.id === id) ?? null,
        lister: async (f: (s: unknown) => boolean) => etat.sorties.filter(f),
      },
    }),
  };
});
vi.mock("@/services/auth", () => ({
  exigerSession: async () => {
    if (etat.erreurSession) throw etat.erreurSession;
    if (!etat.session) throw new Error("pas de session");
    return {};
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/services/fichiers", () => ({
  urlFichier: async (id: string | null) => {
    etat.urls.push(String(id));
    return id ? `https://exemple.invalid/${id}.mp4` : null;
  },
}));

const ok = async () => ({ ok: true as const });
const ecran = (ouverte: boolean) => createElement(ui.ScenesGardees, { scenes: [], ouverte, onRetirer: ok, onGarder: ok });
const carte = (scene: import("@/services/scenes-gardees").VueScene, plus: object = {}) => createElement(ui.CarteScene, { scene, ...plus });

const vue = await import("@/services/scenes-gardees");
const svc = await import("@/services/scenes-tutoriel");
const ui = await import("@/components/tutoriel-outil/ScenesGardees");

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
const allumer = () => etat.params.set(svc.PARAM_SCENES_TUTORIEL, true);
const planSource = (debutMs: number) => ({ tutoriel: { plan: { plan: { scenes: [{ id: "s1", debutMs }, { id: "s2", debutMs: debutMs + 5000 }] } } } });
function poserVideo(id: string, debutMs = 12400) {
  etat.videos.set(id, { titre: `Vidéo ${id}` });
  etat.versions.set(`${id}@1`, { projetMontage: planSource(debutMs) });
  etat.sorties.push({ id: `so-${id}`, versionId: `${id}@1`, ratio: "4:5", fichierId: `f-${id}` });
}
const CLE = (v: string, s: string) => `scene:${v}:${s}:v1`;

beforeEach(() => {
  etat.params.clear();
  etat.ecritures.length = 0;
  etat.journal.length = 0;
  etat.urls.length = 0;
  etat.videos.clear();
  etat.versions.clear();
  etat.sorties.length = 0;
  etat.session = true;
  etat.erreurSession = null;
  vi.stubGlobal("fetch", () => {
    throw new Error("fetch interdit");
  });
});

describe("éteint par défaut", () => {
  it("réglage absent : liste vide, écran « pas ouverte », aucun bouton, aucune écriture", async () => {
    expect(await vue.lireListeScenes()).toEqual({ ouverte: false, scenes: [] });
    expect(await vue.listerScenesGardees()).toEqual([]);
    const html = renderToStaticMarkup(ecran(false));
    expect(html).toContain("La bibliothèque de scènes n&#x27;est pas ouverte pour le moment.");
    expect(html).not.toContain("<button");
    await expect(vue.retirer(CLE("v1", "s1"))).rejects.toMatchObject({ code: "FONCTION_FERMEE" });
    await expect(vue.garder(CLE("v1", "s1"))).rejects.toMatchObject({ code: "FONCTION_FERMEE" });
    expect(etat.ecritures).toEqual([]);
  });

  it('"true" en texte n\'allume pas', async () => {
    etat.params.set(svc.PARAM_SCENES_TUTORIEL, "true");
    expect((await vue.lireListeScenes()).ouverte).toBe(false);
  });
});

describe("allumé", () => {
  it("index vide : liste vide mais écran ouvert", async () => {
    allumer();
    expect(await vue.lireListeScenes()).toEqual({ ouverte: true, scenes: [] });
  });

  async function troisScenes() {
    allumer();
    poserVideo("v1");
    poserVideo("v2");
    await svc.rangerScenesDeVideo({ morceaux: morceaux(), meta: meta("v1") });
    await svc.rangerScenesDeVideo({ morceaux: morceaux(), meta: meta("v2") });
    // 4 scènes rangées ; on en garde 2 en brouillon + 2 validées, puis on n'en retient que 3 : la 4e est retirée.
    await svc.validerSceneGardee(CLE("v1", "s1"));
    await svc.validerSceneGardee(CLE("v2", "s1"));
    await svc.retirerSceneGardee(CLE("v2", "s2"));
    etat.ecritures.length = 0;
  }

  it("3 vues utiles (2 validées, 1 brouillon) et filtres corrects ; la retirée reste listée", async () => {
    await troisScenes();
    const { scenes } = await vue.lireListeScenes();
    expect(scenes).toHaveLength(4);
    expect(scenes.filter((s) => s.etat === "validee")).toHaveLength(2);
    expect(scenes.filter((s) => s.etat === "brouillon")).toHaveLength(1);
    expect(ui.filtrerScenes(scenes, "toutes")).toHaveLength(4);
    expect(ui.filtrerScenes(scenes, "validees").map((s) => s.cle)).toEqual([CLE("v1", "s1"), CLE("v2", "s1")]);
    expect(ui.filtrerScenes(scenes, "retirees").map((s) => s.cle)).toEqual([CLE("v2", "s2")]);
  });

  it("aperçu : début lu dans le plan source (12,4 s), fin = début + durée, aucun rendu, une seule adresse lue par scène", async () => {
    await troisScenes();
    const { scenes } = await vue.lireListeScenes();
    const s = scenes.find((x) => x.cle === CLE("v1", "s1"))!;
    expect(s.apercu).toEqual({ url: "https://exemple.invalid/f-v1.mp4", debutSec: 12.4, finSec: 12.4 + s.dureeSec });
    expect(s.titreVideo).toBe("Vidéo v1");
    expect(s.licence).toEqual({ utilisable: true, copieeLe: "2026-11-18T10:00:00.000Z" });
    const html = renderToStaticMarkup(carte(s));
    expect(html).toContain(`#t=12.4,${Number((12.4 + s.dureeSec).toFixed(3))}`);
    expect(html).toContain("muted");
    expect(etat.urls).toHaveLength(4);
  });

  it("vidéo source supprimée : aperçu nul et phrase claire ; plan illisible : « Aperçu indisponible »", async () => {
    await troisScenes();
    etat.videos.delete("v1");
    etat.versions.set("v2@1", { projetMontage: {} });
    const { scenes } = await vue.lireListeScenes();
    const v1 = scenes.find((x) => x.cle === CLE("v1", "s1"))!;
    expect(v1.apercu).toBeNull();
    expect(v1.motifApercu).toBe("Vidéo d'origine supprimée");
    const v2 = scenes.find((x) => x.cle === CLE("v2", "s1"))!;
    expect(v2.apercu).toBeNull();
    expect(v2.motifApercu).toBe("Aperçu indisponible");
    expect(renderToStaticMarkup(carte(v1))).toContain("Vidéo d&#x27;origine supprimée");
  });

  it("licence copiée expirée : « Plus utilisable : droits à vérifier »", async () => {
    allumer();
    poserVideo("v1");
    await svc.rangerScenesDeVideo({ morceaux: morceaux(), meta: { ...meta("v1"), licence: { type: "propriete", usageCommercial: true, reseaux: [], expireLe: "2020-01-01T00:00:00.000Z" } } });
    const s = (await vue.listerScenesGardees())[0]!;
    expect(s.licence.utilisable).toBe(false);
    expect(renderToStaticMarkup(carte(s))).toContain("Plus utilisable : droits à vérifier");
  });

  it("« Garder pour d'autres vidéos » : brouillon → validée, une seule écriture ; refus sur validée et retirée", async () => {
    allumer();
    poserVideo("v1");
    await svc.rangerScenesDeVideo({ morceaux: morceaux(), meta: meta("v1") });
    etat.ecritures.length = 0;
    await vue.garder(CLE("v1", "s1"));
    expect(etat.ecritures).toEqual([svc.PARAM_INDEX_SCENES]);
    expect((await svc.lireScenesGardees()).entrees.find((e) => e.cle === CLE("v1", "s1"))!.etat).toBe("validee");
    await expect(vue.garder(CLE("v1", "s1"))).rejects.toThrow("déjà gardée");
    await vue.retirer(CLE("v1", "s2"));
    await expect(vue.garder(CLE("v1", "s2"))).rejects.toThrow("retirée");
  });

  it("boutons : brouillon = Garder + Retirer ; validée = Retirer ; retirée = aucun", async () => {
    await troisScenes();
    const { scenes } = await vue.lireListeScenes();
    const rendu = (etatScene: string) => renderToStaticMarkup(carte(scenes.find((s) => s.etat === etatScene)!));
    expect(rendu("brouillon")).toContain("Garder pour d&#x27;autres vidéos");
    expect(rendu("brouillon")).toContain("Retirer");
    expect(rendu("validee")).not.toContain("Garder pour");
    expect(rendu("validee")).toContain("Retirer");
    expect(rendu("retiree")).not.toContain("<button");
  });

  it("« Retirer » : état retirée, jamais supprimée ; retirer une retirée = refus clair ; confirmation affichée", async () => {
    allumer();
    poserVideo("v1");
    await svc.rangerScenesDeVideo({ morceaux: morceaux(), meta: meta("v1") });
    await vue.retirer(CLE("v1", "s1"));
    const index = await svc.lireScenesGardees();
    expect(index.entrees).toHaveLength(2);
    expect(index.entrees.find((e) => e.cle === CLE("v1", "s1"))!.etat).toBe("retiree");
    await expect(vue.retirer(CLE("v1", "s1"))).rejects.toThrow("Cette scène est déjà retirée.");
    const s = (await vue.listerScenesGardees()).find((x) => x.etat === "retiree")!;
    expect(ui.filtrerScenes(await vue.listerScenesGardees(), "retirees")).toEqual([s]);
    const html = renderToStaticMarkup(carte(s, { confirmation: true }));
    expect(html).toContain("Cette scène ne sera plus proposée aux autres vidéos. Elle reste visible ici.");
  });

  it("clé inconnue : « Cette scène n'existe plus. »", async () => {
    allumer();
    await expect(vue.retirer("scene:zz:s1:v1")).rejects.toMatchObject({ message: "Cette scène n'existe plus." });
    await expect(vue.garder("scene:zz:s1:v1")).rejects.toMatchObject({ message: "Cette scène n'existe plus." });
  });

  it("sans session : tout est refusé, rien n'est écrit", async () => {
    allumer();
    poserVideo("v1");
    await svc.rangerScenesDeVideo({ morceaux: morceaux(), meta: meta("v1") });
    etat.ecritures.length = 0;
    etat.session = false;
    await expect(vue.lireListeScenes()).rejects.toThrow();
    await expect(vue.retirer(CLE("v1", "s1"))).rejects.toThrow();
    await expect(vue.garder(CLE("v1", "s1"))).rejects.toThrow();
    expect(etat.ecritures).toEqual([]);
  });

  it("aucune clé de réglage écrite par ce code (seul le service de T-EXT-15 écrit) et aucun mot technique à l'écran", async () => {
    await troisScenes();
    await vue.garder(CLE("v1", "s2"));
    expect(new Set(etat.ecritures)).toEqual(new Set([svc.PARAM_INDEX_SCENES]));
    const { scenes } = await vue.lireListeScenes();
    const html = scenes.map((s) => renderToStaticMarkup(carte(s))).join("");
    for (const mot of ["scene:", "empreinte", "JSON", "clé", "Douleur", "Solution", "Exemple", "À vous", "€"]) expect(html).not.toContain(mot);
    expect(etat.journal.join(" ")).not.toContain("parole");
  });

  it("filtres affichés : Toutes, Validées, Retirées", () => {
    const html = renderToStaticMarkup(ecran(true));
    for (const l of ["Toutes", "Validées", "Retirées"]) expect(html).toContain(l);
  });
});

describe("actions serveur (enveloppes)", () => {
  async function actions() {
    return await import("@/app/(studio)/tutoriel-outil/scenes/actions");
  }
  const redirection = () => Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/connexion;307;" });

  it("sans session : la redirection remonte de l'action (pas transformée en refus) et rien n'est écrit", async () => {
    allumer();
    poserVideo("v1");
    await svc.rangerScenesDeVideo({ morceaux: morceaux(), meta: meta("v1") });
    etat.ecritures.length = 0;
    const redir = redirection();
    etat.erreurSession = redir;
    const a = await actions();
    await expect(a.retirerSceneAction(CLE("v1", "s1"))).rejects.toBe(redir);
    await expect(a.garderSceneAction(CLE("v1", "s1"))).rejects.toBe(redir);
    expect(etat.ecritures).toEqual([]);
  });

  it("clé inconnue : « Cette scène n'existe plus. » (ErreurStudio rendue en refus clair)", async () => {
    allumer();
    const a = await actions();
    expect(await a.retirerSceneAction("scene:zz:s1:v1")).toEqual({ ok: false, message: "Cette scène n'existe plus." });
    expect(await a.garderSceneAction("scene:zz:s1:v1")).toEqual({ ok: false, message: "Cette scène n'existe plus." });
  });
});

describe("aucun service de rendu", () => {
  it("l'aperçu n'appelle le fournisseur de rendu (double) aucune fois : 0 soumission, 0 rendu", async () => {
    const journal: Journal = { voix: [], claude: [], rendus: [] };
    const outils = outilsDoubles(journal);
    const rendu = outils.rendu.service() as unknown as Record<string, unknown>;
    const espions = Object.keys(rendu)
      .filter((k) => typeof rendu[k] === "function")
      .map((k) => vi.spyOn(rendu as Record<string, (...a: unknown[]) => unknown>, k));
    expect(espions.length).toBeGreaterThan(0);
    allumer();
    poserVideo("v1");
    await svc.rangerScenesDeVideo({ morceaux: morceaux(), meta: meta("v1") });
    const { scenes } = await vue.lireListeScenes();
    expect(scenes.length).toBeGreaterThan(0);
    renderToStaticMarkup(carte(scenes[0]!));
    for (const e of espions) expect(e).not.toHaveBeenCalled();
    expect(journal.rendus).toHaveLength(0);
    expect(journal.voix).toHaveLength(0);
    expect(journal.claude).toHaveLength(0);
  });
});
