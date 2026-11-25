import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FAMILLE_CSS, PALETTE } from "../../../src/briques/charte/axion-2026";
import {
  EFFETS_TEXTE,
  appliquerEffet,
  type EffetTexte,
  effetAparteFantome,
  effetContourMarque,
  effetDegradeBalaye,
  effetFlouMot,
  effetInterlettrageSerre,
  effetIntonation,
  effetNoirBlancMot,
  effetRetrogradation,
  effetTitreSurvit,
} from "../../../src/briques/motion/texte-effets/effets";

const IPS = 30;
const DERNIERE = 60;
const nombre = (s: string | undefined, re: RegExp) => Number((s ?? "").match(re)?.[1]);

describe("effets de texte : liste fermée", () => {
  it("9 valeurs exactement, sans mème ni légende native", () => {
    expect([...EFFETS_TEXTE].sort()).toEqual(
      ["flou-mot", "noir-blanc-mot", "degrade-balaye", "retrogradation", "aparte-fantome", "titre-survit", "interlettrage-serre", "intonation", "contour-marque"].sort(),
    );
    expect(EFFETS_TEXTE).toHaveLength(9);
    const joint = EFFETS_TEXTE.join(" ");
    expect(joint).not.toMatch(/meme|mème|legende-native|native/);
  });

  it("appliquerEffet couvre chaque valeur et reste déterministe", () => {
    for (const e of EFFETS_TEXTE as readonly EffetTexte[]) {
      const a = appliquerEffet(e, 10, IPS, {});
      expect(a).toEqual(appliquerEffet(e, 10, IPS, {}));
      expect(Object.keys(a).length).toBeGreaterThan(0);
    }
  });

  it("aucune fonction ne prend une zone du cadre : image, ips, options seulement", () => {
    const src = readFileSync(join(process.cwd(), "src/briques/motion/texte-effets/effets.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\b(zone|visage|boite|cadre)\s*:/i);
  });
});

describe("flou-mot", () => {
  it("6 px au plus, du flou au net, monotone décroissant", () => {
    const px = (i: number) => nombre(effetFlouMot(i, IPS).filtre, /blur\(([\d.]+)px\)/);
    expect(px(0)).toBe(6);
    expect(px(DERNIERE)).toBe(0);
    for (let i = 1; i <= DERNIERE; i++) expect(px(i)).toBeLessThanOrEqual(px(i - 1));
  });
  it("refuse de dépasser 6 px même si on le demande", () => {
    expect(nombre(effetFlouMot(0, IPS, { flouMaxPx: 40 }).filtre, /blur\(([\d.]+)px\)/)).toBe(6);
  });
  it("même entrée = même style", () => {
    expect(effetFlouMot(7, IPS)).toEqual(effetFlouMot(7, IPS));
  });
});

describe("noir-blanc-mot", () => {
  it("niveaux de gris 1 → 0, monotone, sur le mot seul", () => {
    const g = (i: number) => nombre(effetNoirBlancMot(i, IPS).filtre, /grayscale\(([\d.]+)\)/);
    expect(g(0)).toBe(1);
    expect(g(DERNIERE)).toBe(0);
    for (let i = 1; i <= DERNIERE; i++) expect(g(i)).toBeLessThanOrEqual(g(i - 1));
    expect(effetNoirBlancMot(0, IPS).filtre).not.toMatch(/blur|brightness|sepia/);
  });
});

describe("degrade-balaye", () => {
  const hex = (c: string) => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16));
  it("part de terracotta, finit à ivoire, balayage de 0 à 1 monotone", () => {
    expect(effetDegradeBalaye(0, IPS).couleur.toUpperCase()).toBe(PALETTE.terracotta.toUpperCase());
    expect(effetDegradeBalaye(DERNIERE, IPS).couleur.toUpperCase()).toBe(PALETTE.ivoire.toUpperCase());
    let prec = -1;
    for (let i = 0; i <= DERNIERE; i++) {
      const b = effetDegradeBalaye(i, IPS).balayage;
      expect(b).toBeGreaterThanOrEqual(prec);
      prec = b;
    }
    expect(effetDegradeBalaye(0, IPS).balayage).toBe(0);
    expect(effetDegradeBalaye(DERNIERE, IPS).balayage).toBe(1);
  });
  it("la couleur reste entre terracotta et ivoire (canal rouge monotone)", () => {
    const [a, b] = [hex(PALETTE.terracotta)[0], hex(PALETTE.ivoire)[0]];
    for (let i = 0; i <= DERNIERE; i++) {
      const r = hex(effetDegradeBalaye(i, IPS).couleur)[0];
      expect(r).toBeGreaterThanOrEqual(Math.min(a, b));
      expect(r).toBeLessThanOrEqual(Math.max(a, b));
    }
  });
});

describe("retrogradation", () => {
  it("le mot est barré, puis remplacé", () => {
    const debut = effetRetrogradation(0, IPS);
    const fin = effetRetrogradation(DERNIERE, IPS);
    expect(debut.mot).toBe("ancien");
    expect(debut.decoration).toBe("line-through");
    expect(fin.mot).toBe("nouveau");
    expect(fin.decoration).toBe("none");
    const ordre = Array.from({ length: DERNIERE + 1 }, (_, i) => effetRetrogradation(i, IPS).mot);
    const bascule = ordre.indexOf("nouveau");
    expect(bascule).toBeGreaterThan(0);
    expect(ordre.slice(bascule).every((m) => m === "nouveau")).toBe(true);
  });
});

describe("aparte-fantome", () => {
  it("opacité 0,35 au plus, à toutes les images, et atteint 0,35", () => {
    for (let i = 0; i <= DERNIERE; i++) expect(effetAparteFantome(i, IPS).opacite).toBeLessThanOrEqual(0.35);
    expect(effetAparteFantome(0, IPS).opacite).toBe(0);
    expect(effetAparteFantome(DERNIERE, IPS).opacite).toBe(0.35);
    expect(effetAparteFantome(DERNIERE, IPS, { opaciteMax: 1 }).opacite).toBe(0.35);
  });
});

describe("titre-survit", () => {
  it("plein jusqu'à la coupe + 0,3 s, puis 0", () => {
    const coupe = 20;
    const fin = coupe + Math.round(0.3 * IPS);
    expect(effetTitreSurvit(0, IPS, { coupeImage: coupe }).opacite).toBe(1);
    expect(effetTitreSurvit(coupe, IPS, { coupeImage: coupe }).opacite).toBe(1);
    expect(effetTitreSurvit(fin - 1, IPS, { coupeImage: coupe }).opacite).toBe(1);
    expect(effetTitreSurvit(fin, IPS, { coupeImage: coupe }).opacite).toBe(0);
    expect(effetTitreSurvit(DERNIERE, IPS, { coupeImage: coupe }).opacite).toBe(0);
  });
  it("suit la cadence : à 60 ips, 0,3 s = 18 images", () => {
    expect(effetTitreSurvit(17, 60, { coupeImage: 0 }).opacite).toBe(1);
    expect(effetTitreSurvit(18, 60, { coupeImage: 0 }).opacite).toBe(0);
  });
});

describe("interlettrage-serre", () => {
  const em = (i: number) => nombre(effetInterlettrageSerre(i, IPS).interlettrage, /(-?[\d.]+)em/);
  it("de +0,2 em à 0 en 0,4 s, monotone", () => {
    expect(em(0)).toBeCloseTo(0.2, 6);
    expect(em(Math.round(0.4 * IPS))).toBeCloseTo(0, 6);
    expect(em(DERNIERE)).toBeCloseTo(0, 6);
    for (let i = 1; i <= DERNIERE; i++) expect(em(i)).toBeLessThanOrEqual(em(i - 1) + 1e-9);
  });
});

describe("intonation", () => {
  it("graisses 300 et 800 seulement, Manrope, jamais d'italique", () => {
    const vus = new Set<number>();
    for (let i = 0; i <= DERNIERE; i++) {
      const s = effetIntonation(i, IPS);
      vus.add(s.graisse);
      expect(s.famille).toBe(FAMILLE_CSS);
      expect(s.italique).toBe(false);
    }
    expect([...vus].sort()).toEqual([300, 800]);
    expect(effetIntonation(0, IPS).graisse).toBe(300);
    expect(effetIntonation(DERNIERE, IPS).graisse).toBe(800);
  });
});

describe("contour-marque", () => {
  it("contour dans la couleur de la charte, de 0 à l'épaisseur voulue", () => {
    const debut = effetContourMarque(0, IPS);
    const fin = effetContourMarque(DERNIERE, IPS);
    expect(debut.contourPx).toBe(0);
    expect(fin.contourPx).toBeGreaterThan(0);
    expect(Object.values(PALETTE).map((c) => c.toUpperCase())).toContain(fin.couleurContour.toUpperCase());
    expect(fin.couleurContour).toBe(PALETTE.orange);
  });
  it("une couleur de la charte peut être choisie par son nom", () => {
    expect(effetContourMarque(DERNIERE, IPS, { couleur: "terracotta" }).couleurContour).toBe(PALETTE.terracotta);
  });
});

describe("garde statique : rien n'appelle le code neuf", () => {
  const racines = ["src", "studio-rendu"];
  const marche = (d: string): string[] =>
    !existsSync(d)
      ? []
      : readdirSync(d).flatMap((n) => {
          if (n === "node_modules" || n === ".next" || n === "out") return [];
          const c = join(d, n);
          return statSync(c).isDirectory() ? marche(c) : /\.(ts|tsx|js|mjs)$/.test(n) ? [c] : [];
        });
  it("aucun fichier de src ou studio-rendu n'importe texte-effets/effets", () => {
    const fautes = racines
      .flatMap((r) => marche(join(process.cwd(), r)))
      .filter((f) => !f.endsWith("texte-effets/effets.ts"))
      .filter((f) => !f.endsWith("studio-rendu/compositions/commune/texte-effets/TexteEffets.tsx"))
      .filter((f) => /texte-effets\/effets/.test(readFileSync(f, "utf8")));
    // MAJ 25/11 (FIX-ROUGES-ECRAN-EFFETS-v21s, voulue, à relire) : `src/briques/sous-titres/apparition.ts` (C11-T4-a #1256) lit la seule constante `FLOU_MAX_PX` ; il n'appelle aucun effet.
    expect(fautes).toEqual([join(process.cwd(), "src/briques/sous-titres/apparition.ts")]);
    const lignes = readFileSync(fautes[0], "utf8").split("\n").filter((l) => /texte-effets\/effets/.test(l));
    expect(lignes).toEqual(['import { FLOU_MAX_PX } from "../motion/texte-effets/effets";']);
  });
});
