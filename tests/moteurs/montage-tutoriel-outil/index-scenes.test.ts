/** T-EXT-15 : index des scènes gardées (pur, aucun appel, aucune horloge). */
import { describe, expect, it } from "vitest";
import { CATALOGUE_BRIQUES } from "@/briques/plan-scenes/catalogue";
import { avecEmpreintes } from "@/briques/plan-scenes/empreinte";
import type { PlanDeScenes } from "@/briques/plan-scenes/schema";
import type { Licence } from "@/domaine/types";
import { decouperEnMorceaux, type MorceauPlan } from "@/moteurs/montage-tutoriel-outil/decoupage-scenes";
import {
  cleScene,
  estCleScene,
  INDEX_VIDE,
  lireIndexScenes,
  rangerScenes,
  retirerScene,
  scenesReutilisables,
  validerScene,
  VERSION_INDEX_SCENES,
  type IndexScenes,
  type MetaRangement,
} from "@/moteurs/montage-tutoriel-outil/index-scenes";

const TRANSITION = { entree: "fondu", sortie: "fondu", dureeMs: 400 } as const;
const MOTS = Array.from({ length: 15 }, (_, i) => ({ texte: `mot${i}`, debutMs: 1000 + i * 400, finMs: 1000 + i * 400 + 400 }));
const bornes = (i: number) => ({ mots: { premier: i * 3, dernier: i * 3 + 2 }, debutMs: MOTS[i * 3]!.debutMs, finMs: MOTS[i * 3 + 2]!.finMs });
const base = { version: 1, niveau: 1, position: "centre", transition: TRANSITION } as const;

function morceauxFictifs(titre = "Le devis part tout seul"): MorceauPlan[] {
  const plan = avecEmpreintes({
    version: "plan-scenes-1",
    format: { largeur: 1080, hauteur: 1350, fps: 25 },
    facecam: true,
    dureeMs: 8000,
    habillage: { fond: "ivoire", accent: "terracotta" },
    mots: MOTS,
    scenes: [0, 1, 2, 3, 4].map((i) =>
      i % 2 === 1
        ? { ...base, id: `s${i + 1}`, ...bornes(i), piece: "legende", parametres: CATALOGUE_BRIQUES["legende"].exemple, texte: titre }
        : { ...base, id: `s${i + 1}`, ...bornes(i), piece: "fenetre-app", parametres: CATALOGUE_BRIQUES["fenetre-app"].exemple },
    ),
  } as unknown as PlanDeScenes);
  const r = decouperEnMorceaux({ plan });
  if (!r.ok) throw new Error("découpage fictif refusé");
  return r.morceaux;
}

const licence = (): Licence => ({ type: "propriete", usageCommercial: true, reseaux: ["linkedin"], creditObligatoire: "Exemple" });
const META = (le = "2026-11-18T10:00:00.000Z", extra: Partial<MetaRangement> = {}): MetaRangement => ({
  videoId: "v-1",
  versionVideoId: "v-1@1",
  sortieId: "sortie-1",
  maquette: "maquette-exemple",
  sujet: null,
  licence: licence(),
  famille: [],
  le,
  ...extra,
});

function gelProfond<T>(v: T): T {
  if (v && typeof v === "object") {
    for (const x of Object.values(v)) gelProfond(x);
    Object.freeze(v);
  }
  return v;
}

const rangee = (): IndexScenes => rangerScenes(INDEX_VIDE, morceauxFictifs(), META());

describe("clés et index vide", () => {
  it("l'index vide est valide", () => {
    const r = lireIndexScenes({ version: VERSION_INDEX_SCENES, entrees: [] });
    expect(r.ok).toBe(true);
    expect(lireIndexScenes(INDEX_VIDE).ok).toBe(true);
  });
  it("la clé a la forme scene:<vidéo>:<scène>:v<n>, distincte de extrait:", () => {
    expect(cleScene("v-1", "s2", 1)).toBe("scene:v-1:s2:v1");
    expect(estCleScene("scene:v-1:s2:v1")).toBe(true);
    expect(estCleScene("extrait:a:b")).toBe(false);
  });
  it("ne lève jamais sur une valeur quelconque", () => {
    for (const v of [null, undefined, 1, "x", [], {}, { version: "autre", entrees: [] }]) expect(lireIndexScenes(v).ok).toBe(false);
  });
});

describe("rangerScenes", () => {
  it("5 morceaux → 5 brouillons, licence copiée et datée, famille avec la vidéo source", () => {
    const index = rangee();
    expect(index.entrees).toHaveLength(5);
    for (const e of index.entrees) {
      expect(e.etat).toBe("brouillon");
      expect(e.cle).toBe(cleScene("v-1", e.sceneId, 1));
      expect(e.licence).toEqual(licence());
      expect(e.licenceCopieeLe).toBe("2026-11-18T10:00:00.000Z");
      expect(e.famille).toContain("v-1");
      expect(e.rangeeLe).toBe("2026-11-18T10:00:00.000Z");
    }
    expect(lireIndexScenes(index).ok).toBe(true);
  });

  it("une licence d'origine modifiée APRÈS le rangement ne change pas l'entrée", () => {
    const lic = licence();
    const index = rangerScenes(INDEX_VIDE, morceauxFictifs(), META(undefined, { licence: lic }));
    lic.usageCommercial = false;
    lic.reseaux.push("tiktok");
    expect(index.entrees[0]!.licence).toEqual(licence());
  });

  it("un rangement identique ne change rien", () => {
    const index = rangee();
    const encore = rangerScenes(index, morceauxFictifs(), META("2026-11-19T10:00:00.000Z"));
    expect(encore).toEqual(index);
  });

  it("une empreinte changée → v2, v1 intacte", () => {
    const index = rangee();
    const v1 = structuredClone(index.entrees.find((e) => e.sceneId === "s2")!);
    const apres = rangerScenes(index, morceauxFictifs("Un autre texte"), META("2026-11-19T10:00:00.000Z"));
    const s2 = apres.entrees.filter((e) => e.sceneId === "s2");
    expect(s2.map((e) => e.cle)).toEqual(["scene:v-1:s2:v1", "scene:v-1:s2:v2"]);
    expect(s2[0]).toEqual(v1);
    // s2 et s4 sont des légendes : leurs deux empreintes changent (+2) ; s1, s3, s5 restent à v1.
    expect(apres.entrees).toHaveLength(7);
    expect(apres.entrees.filter((e) => e.version === 1)).toHaveLength(5);
  });

  it("la famille garde toujours la vidéo source, même si l'appelant l'oublie", () => {
    const index = rangerScenes(INDEX_VIDE, morceauxFictifs(), META(undefined, { famille: ["v-9"] }));
    expect(index.entrees[0]!.famille.sort()).toEqual(["v-1", "v-9"]);
  });

  it("n'altère pas l'entrée (gel profond)", () => {
    const entree = gelProfond(rangee());
    const morceaux = gelProfond(morceauxFictifs("Autre"));
    const meta = gelProfond(META("2026-11-20T10:00:00.000Z"));
    expect(() => rangerScenes(entree, morceaux, meta)).not.toThrow();
    expect(entree.entrees).toHaveLength(5);
  });
});

describe("états", () => {
  it("valider un brouillon → validée ; valider une validée → refus", () => {
    const index = rangee();
    const cle = index.entrees[0]!.cle;
    const r = validerScene(index, cle, "2026-11-18T11:00:00.000Z");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.index.entrees[0]).toMatchObject({ etat: "validee", valideeLe: "2026-11-18T11:00:00.000Z" });
    expect(index.entrees[0]!.etat).toBe("brouillon");
    expect(validerScene(r.index, cle, "x").ok).toBe(false);
    expect(validerScene(index, "scene:inconnue:s:v1", "x").ok).toBe(false);
  });

  it("retirer → retirée, jamais supprimée ; une retirée ne se valide ni ne se retire", () => {
    const index = rangee();
    const cle = index.entrees[1]!.cle;
    const r = retirerScene(index, cle, "2026-11-18T12:00:00.000Z");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.index.entrees).toHaveLength(5);
    expect(r.index.entrees[1]).toMatchObject({ etat: "retiree", retireeLe: "2026-11-18T12:00:00.000Z" });
    expect(validerScene(r.index, cle, "x").ok).toBe(false);
    expect(retirerScene(r.index, cle, "x").ok).toBe(false);
  });

  it("une validée peut être retirée", () => {
    const index = rangee();
    const v = validerScene(index, index.entrees[0]!.cle, "t1");
    if (!v.ok) throw new Error("refus");
    expect(retirerScene(v.index, index.entrees[0]!.cle, "t2").ok).toBe(true);
  });

  it("scenesReutilisables ne rend que les validées", () => {
    const index = rangee();
    expect(scenesReutilisables(index)).toEqual([]);
    const v = validerScene(index, index.entrees[2]!.cle, "t1");
    if (!v.ok) throw new Error("refus");
    const r = retirerScene(v.index, index.entrees[3]!.cle, "t2");
    if (!r.ok) throw new Error("refus");
    expect(scenesReutilisables(r.index).map((e) => e.cle)).toEqual([index.entrees[2]!.cle]);
  });

  it("n'altère pas l'entrée (gel profond)", () => {
    const index = gelProfond(rangee());
    expect(validerScene(index, index.entrees[0]!.cle, "t").ok).toBe(true);
    expect(retirerScene(index, index.entrees[0]!.cle, "t").ok).toBe(true);
  });
});

describe("lireIndexScenes : refus", () => {
  const brut = () => structuredClone(rangee()) as unknown as { version: string; entrees: Record<string, unknown>[] };

  it("version inconnue, champ inconnu (racine et entrée)", () => {
    expect(lireIndexScenes({ ...brut(), version: "index-scenes.v0" }).ok).toBe(false);
    expect(lireIndexScenes({ ...brut(), en_trop: 1 }).ok).toBe(false);
    const b = brut();
    b.entrees[0]!.inconnu = 1;
    expect(lireIndexScenes(b).ok).toBe(false);
  });

  it("clé qui ne suit pas cleScene, clé en double", () => {
    const a = brut();
    a.entrees[0]!.cle = "scene:v-1:s1:v7";
    expect(lireIndexScenes(a).ok).toBe(false);
    const b = brut();
    b.entrees.push(structuredClone(b.entrees[0]!));
    expect(lireIndexScenes(b).ok).toBe(false);
  });

  it("famille sans la vidéo source", () => {
    const b = brut();
    b.entrees[0]!.famille = ["v-9"];
    expect(lireIndexScenes(b).ok).toBe(false);
  });

  it("morceau qui ne passe pas schemaPlanStrict, ou pas au format maître 4:5", () => {
    const a = brut();
    (a.entrees[0]!.morceau as { scenes: unknown[] }).scenes = [];
    expect(lireIndexScenes(a).ok).toBe(false);
    const b = brut();
    (b.entrees[0]!.morceau as { format: { largeur: number; hauteur: number } }).format = { largeur: 1080, hauteur: 1920 } as never;
    expect(lireIndexScenes(b).ok).toBe(false);
  });

  it("refuse toute référence à un fichier vidéo, sans citer de parole", () => {
    for (const valeur of ["https://exemple.invalid/a", "x.mp4", "clip.WEBM", "file:///a", "data:video/mp4;base64,AA", "film.mov"]) {
      const b = brut();
      b.entrees[0]!.maquette = valeur;
      const r = lireIndexScenes(b);
      expect(r.ok, valeur).toBe(false);
      if (!r.ok) expect(r.erreurs.join(" ")).toContain("aucun fichier vidéo");
    }
    const c = brut();
    (c.entrees[0]!.licence as Record<string, unknown>).cleStockage = "x";
    expect(lireIndexScenes(c).ok).toBe(false);
    const d = brut();
    (d.entrees[0]!.morceau as Record<string, unknown>).profond = { a: [{ url: "z" }] };
    const r = lireIndexScenes(d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs[0]).toContain("aucun fichier vidéo");
    for (const cle of ["fichier", "fichiers", "chemin", "adresse"]) {
      const e = brut();
      (e.entrees[0] as Record<string, unknown>)[cle] = "z";
      expect(lireIndexScenes(e).ok, cle).toBe(false);
    }
  });

  it("un titre comme « Ventes / mois » reste permis", () => {
    const index = rangerScenes(INDEX_VIDE, morceauxFictifs("Ventes / mois"), META());
    expect(lireIndexScenes(index).ok).toBe(true);
    const b = brut();
    b.entrees[0]!.maquette = "Ventes / mois";
    expect(lireIndexScenes(b).ok).toBe(true);
  });

  it("une entrée valide fait l'aller-retour JSON", () => {
    const index = rangee();
    const r = lireIndexScenes(JSON.parse(JSON.stringify(index)));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.index).toEqual(index);
  });
});
