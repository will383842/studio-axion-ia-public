import { describe, expect, it } from "vitest";
import { avecEmpreintes } from "../../../src/briques/plan-scenes/empreinte";
import type { PlanDeScenes, ScenePlan } from "../../../src/briques/plan-scenes/schema";
import { VERSION_PLAN_SCENES } from "../../../src/briques/plan-scenes/schema";
import {
  empreinteEffetsFilm,
  empreinteFormat,
  filmReutilisable,
  formatsARefaire,
  plagesARerendre,
} from "../../../src/moteurs/montage-tutoriel-outil/rendu-partiel";
import type { Ratio } from "../../../src/domaine/types";

const transition = { entree: "fondu", sortie: "fondu", dureeMs: 400 } as const;

/** 10 scènes de 2 s (50 images chacune) : film de 20 s = 500 images. */
function plan(): ReturnType<typeof avecEmpreintes> {
  const scenes: ScenePlan[] = [];
  for (let k = 0; k < 10; k++) {
    scenes.push({
      id: `s${k + 1}`, version: 1, mots: { premier: k, dernier: k }, debutMs: k * 2000, finMs: (k + 1) * 2000, niveau: 1, position: "centre", transition,
      piece: "carte-kpi",
      parametres: { libelle: "Devis (exemple)", valeur: 38, prefixe: "+", suffixe: " %", decimales: 0, tendance: "hausse", variation: "exemple" },
    } as ScenePlan);
  }
  const p: PlanDeScenes = {
    version: VERSION_PLAN_SCENES, format: { largeur: 1080, hauteur: 1920, fps: 25 }, facecam: false, dureeMs: 20000,
    habillage: { fond: "ivoire", accent: "terracotta" }, mots: [], scenes,
  };
  return avecEmpreintes(p);
}

const E = { fps: 25 as const, dureeTotaleImages: 500, transitionMaxMs: 800 };
const TRANS_IMG = 20; // 800 ms à 25 i/s

describe("filmReutilisable", () => {
  it("mêmes empreintes → vrai", () => expect(filmReutilisable({ videoCle: "a", empreinte: "x1" }, { videoCle: "b", empreinte: "x1" })).toBe(true));
  it("différentes, absentes ou « inconnu » → faux", () => {
    expect(filmReutilisable({ videoCle: "a", empreinte: "x1" }, { videoCle: "a", empreinte: "x2" })).toBe(false);
    expect(filmReutilisable(undefined, { videoCle: "a", empreinte: "x1" })).toBe(false);
    expect(filmReutilisable({ videoCle: "a", empreinte: "x1" }, undefined)).toBe(false);
    expect(filmReutilisable({ videoCle: "a", empreinte: "" }, { videoCle: "a", empreinte: "" })).toBe(false);
    expect(filmReutilisable({ videoCle: "a", empreinte: "inconnu" }, { videoCle: "a", empreinte: "inconnu" })).toBe(false);
  });
});

describe("empreinteEffetsFilm", () => {
  it("rien = chaîne vide", () => expect(empreinteEffetsFilm({})).toBe(""));
  it("stable et indépendante de l'ordre des clés", () => {
    const a = empreinteEffetsFilm({ reglagesFilm: { etapes: [{ zoom: 1.2, x: 1 }] }, cran: "doux", basculeMs: 300 });
    const b = empreinteEffetsFilm({ basculeMs: 300, cran: "doux", reglagesFilm: { etapes: [{ x: 1, zoom: 1.2 }] } });
    expect(a).toBe(b);
    expect(a).not.toBe("");
  });
  it("change si un zoom d'étape change", () => {
    const a = empreinteEffetsFilm({ reglagesFilm: { etapes: [{ zoom: 1.2 }, { zoom: 1.5 }] } });
    const b = empreinteEffetsFilm({ reglagesFilm: { etapes: [{ zoom: 1.2 }, { zoom: 1.3 }] } });
    expect(a).not.toBe(b);
  });
});

describe("empreinteFormat / formatsARefaire", () => {
  const ratios: Ratio[] = ["4:5", "9:16", "1:1"];
  const base = { voix: "v1", effetsFilm: "", fin: "" };
  const calcul = (p: ReturnType<typeof plan>, par: Partial<Record<Ratio, ReturnType<typeof plan>>> = {}, e = base) =>
    Object.fromEntries(ratios.map((r) => [r, empreinteFormat(par[r] ?? p, r, e)])) as Record<Ratio, string>;

  it("sans avant → les 3", () => {
    const r = formatsARefaire(undefined, calcul(plan()), ratios);
    expect(r.aRefaire).toEqual(ratios);
    expect(r.gardes).toEqual([]);
  });
  it("carte retirée seulement en 9:16 → seul 9:16 est refait", () => {
    const p = plan();
    const sans = avecEmpreintes({ ...p, scenes: p.scenes.slice(1) });
    const r = formatsARefaire(calcul(p), calcul(p, { "9:16": sans }), ratios);
    expect(r.aRefaire).toEqual(["9:16"]);
    expect(r.gardes).toEqual(["4:5", "1:1"]);
    expect(r.phrase).toBe("Le format 9:16 sera refait ; 4:5 et 1:1 sont repris tels quels.");
  });
  it("effet du film changé → les 3", () => {
    const p = plan();
    const r = formatsARefaire(calcul(p), calcul(p, {}, { ...base, effetsFilm: empreinteEffetsFilm({ cran: "fort" }) }), ratios);
    expect(r.aRefaire).toEqual(ratios);
  });
  it("fin commune changée → les 3 ; voix changée → les 3", () => {
    const p = plan();
    expect(formatsARefaire(calcul(p), calcul(p, {}, { ...base, fin: "carte" }), ratios).aRefaire).toEqual(ratios);
    expect(formatsARefaire(calcul(p), calcul(p, {}, { ...base, voix: "v2" }), ratios).aRefaire).toEqual(ratios);
  });
  it("rien ne change → rien refait", () => {
    const p = plan();
    const r = formatsARefaire(calcul(p), calcul(p), ratios);
    expect(r.aRefaire).toEqual([]);
    expect(r.gardes).toEqual(ratios);
  });
  it("phrase sans chiffre d'argent ni « € »", () => {
    const p = plan();
    const sans = avecEmpreintes({ ...p, scenes: p.scenes.slice(1) });
    for (const r of [formatsARefaire(undefined, calcul(p), ratios), formatsARefaire(calcul(p), calcul(p, { "9:16": sans }), ratios), formatsARefaire(calcul(p), calcul(p), ratios)]) {
      expect(r.phrase).not.toMatch(/€|euro|\$|prix|coût/i);
    }
  });
});

describe("plagesARerendre", () => {
  const p = plan();
  it("aucune scène → aucun", () => expect(plagesARerendre(p, [], E)).toEqual({ mode: "aucun", plages: [] }));
  it("une scène au milieu → une plage élargie de la transition", () => {
    // s5 : 8000–10000 ms = images 200–250
    expect(plagesARerendre(p, ["s5"], E)).toEqual({ mode: "plages", plages: [{ debut: 200 - TRANS_IMG, fin: 250 + TRANS_IMG }] });
  });
  it("deux scènes voisines → une plage fusionnée", () => {
    const r = plagesARerendre(p, ["s5", "s6"], E);
    expect(r.plages).toEqual([{ debut: 200 - TRANS_IMG, fin: 300 + TRANS_IMG }]);
  });
  it("deux scènes éloignées → deux plages", () => {
    expect(plagesARerendre(p, ["s2", "s8"], E).plages).toHaveLength(2);
  });
  it("scène au début → bornée à 0 ; à la fin → bornée à la dernière image", () => {
    expect(plagesARerendre(p, ["s1"], E).plages[0]).toEqual({ debut: 0, fin: 50 + TRANS_IMG });
    expect(plagesARerendre(p, ["s10"], E).plages[0]).toEqual({ debut: 450 - TRANS_IMG, fin: 499 });
  });
  it("70 % du film → entier", () => {
    const r = plagesARerendre(p, ["s1", "s2", "s3", "s4", "s5", "s6", "s7"], E);
    expect(r).toEqual({ mode: "entier", plages: [] });
  });
  it("images clés toutes les 25 images → bornes multiples de 25", () => {
    const cles = Array.from({ length: 20 }, (_, i) => i * 25);
    const r = plagesARerendre(p, ["s5"], { ...E, imagesCle: cles });
    expect(r.mode).toBe("plages");
    for (const pl of r.plages) {
      expect(pl.debut % 25).toBe(0);
      expect(pl.fin % 25).toBe(0);
      expect(pl.debut).toBeLessThanOrEqual(200 - TRANS_IMG);
      expect(pl.fin).toBeGreaterThanOrEqual(250 + TRANS_IMG);
    }
  });
  it("transition plafonnée à TRANSITION_MAX_MS", () => {
    expect(plagesARerendre(p, ["s5"], { ...E, transitionMaxMs: 5000 }).plages[0]).toEqual({ debut: 200 - TRANS_IMG, fin: 250 + TRANS_IMG });
  });
  it("même entrée = même sortie", () => {
    expect(plagesARerendre(p, ["s3", "s4"], E)).toEqual(plagesARerendre(p, ["s3", "s4"], E));
  });
});
