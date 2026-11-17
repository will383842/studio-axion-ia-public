/**
 * X1-08 — style croquis : pièces neuves, non inscrites, graine de la vidéo obligatoire.
 * La CI n'installe que la racine : roughjs (déclaré dans studio-rendu seulement) est REMPLACÉ ici par un faux qui enregistre les appels.
 * Croquis.tsx est chargé par un chemin calculé (PIEGE-REMOTION-TSC.md) ; la partie pure (planCroquis) est testée directement.
 */
import { createElement, type JSX } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FORMES_CROQUIS, RUGOSITE_MAX, planCroquis, reglagesCroquis, validerCroquis } from "../../src/briques/motion/petits-objets/croquis";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";
import { PALETTE } from "../../src/briques/charte/axion-2026";
import type { TonObjet } from "../../src/briques/motion/petits-objets/contrat";

interface Appel { methode: string; nombres: number[]; options: Record<string, unknown> }
const appels: Appel[] = [];

vi.mock("roughjs/bin/generator", () => ({
  RoughGenerator: class {
    private enregistrer(methode: string, nombres: number[], options: Record<string, unknown>) {
      appels.push({ methode, nombres, options });
      return { methode, nombres, options };
    }
    rectangle(...a: unknown[]) { return this.enregistrer("rectangle", a.slice(0, 4) as number[], a[4] as Record<string, unknown>); }
    ellipse(...a: unknown[]) { return this.enregistrer("ellipse", a.slice(0, 4) as number[], a[4] as Record<string, unknown>); }
    line(...a: unknown[]) { return this.enregistrer("line", a.slice(0, 4) as number[], a[4] as Record<string, unknown>); }
    /** Déterministe : le tracé dépend uniquement de la graine, des nombres et de la rugosité (comme la vraie bibliothèque). */
    toPaths(d: Appel) {
      return [{ d: `M ${d.nombres.map((n) => n + (d.options.seed as number) * (d.options.roughness as number)).join(" ")}` }];
    }
  },
}));

type FormeC = (typeof FORMES_CROQUIS)[number];
interface Props { forme: FormeC; parametres: unknown; graine: unknown; ton: TonObjet; fond: FondAxion }
let Croquis: (p: Props) => JSX.Element | null;

const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const FONDS: FondAxion[] = ["ivoire", "noir"];
const P = { x: 10, y: 20, largeur: 60, hauteur: 40 };

beforeAll(async () => {
  const chemin = ["..", "..", "studio-rendu", "compositions", "petits-objets", "croquis", "Croquis"].join("/");
  Croquis = ((await import(/* @vite-ignore */ chemin)) as { Croquis: typeof Croquis }).Croquis;
});
beforeEach(() => { appels.length = 0; });

function rendre(forme: FormeC, graine: unknown, o: Partial<Props> = {}) {
  return renderToStaticMarkup(createElement(Croquis, { forme, parametres: P, graine, ton: "neutre", fond: "ivoire", ...o }));
}

afterEach(() => vi.restoreAllMocks());

describe("X1-08 croquis — partie pure (planCroquis, sans roughjs)", () => {
  it("nombre et nature des traits : rectangle 1, ellipse 1, ligne 1, flèche 3 (tige + 2 barbes)", () => {
    const attendu: Record<FormeC, string[]> = { rectangle: ["rectangle"], ellipse: ["ellipse"], ligne: ["ligne"], fleche: ["ligne", "ligne", "ligne"] };
    for (const forme of FORMES_CROQUIS) expect(planCroquis(forme, P, "neutre", "ivoire", 7)!.traits.map((t) => t.genre), forme).toEqual(attendu[forme]);
  });

  it("déterminisme : même graine = même plan, graine différente = graines de traits différentes", () => {
    for (const forme of FORMES_CROQUIS) {
      const a = planCroquis(forme, P, "neutre", "ivoire", 1234);
      expect(planCroquis(forme, P, "neutre", "ivoire", 1234)).toEqual(a);
      expect(planCroquis(forme, P, "neutre", "ivoire", 99)!.traits.map((t) => t.seed)).not.toEqual(a!.traits.map((t) => t.seed));
    }
  });

  it("graines des traits : toutes ≥ 1, distinctes pour la flèche, la première dérivée de celle de la vidéo", () => {
    for (const g of [0, 1, 4294967295]) {
      const seeds = planCroquis("fleche", P, "neutre", "ivoire", g)!.traits.map((t) => t.seed);
      expect(new Set(seeds).size).toBe(3);
      for (const sd of seeds) expect(sd).toBeGreaterThanOrEqual(1);
      expect(seeds[0]).toBe(reglagesCroquis(P, "neutre", "ivoire", g).seed);
    }
  });

  it("bornes : nombres exacts, barbes de flèche à 46 de la pointe au plus", () => {
    expect(planCroquis("rectangle", P, "neutre", "ivoire", 1)!.traits[0].nombres).toEqual([100, 200, 600, 400]);
    expect(planCroquis("ellipse", P, "neutre", "ivoire", 1)!.traits[0].nombres).toEqual([400, 400, 600, 400]);
    expect(planCroquis("ligne", P, "neutre", "ivoire", 1)!.traits[0].nombres).toEqual([100, 200, 700, 600]);
    const [tige, b1, b2] = planCroquis("fleche", P, "neutre", "ivoire", 1)!.traits;
    expect(tige.nombres).toEqual([100, 200, 700, 600]);
    for (const b of [b1, b2]) {
      expect(b.nombres.slice(0, 2)).toEqual([700, 600]);
      expect(Math.hypot(b.nombres[2] - 700, b.nombres[3] - 600)).toBeLessThanOrEqual(46.1);
    }
  });

  it("aucun Math.random atteint, même avec une graine nulle ; paramètres ou graine invalides : null", () => {
    const espion = vi.spyOn(Math, "random");
    for (const forme of FORMES_CROQUIS) for (const g of [0, 1, 4294967295]) planCroquis(forme, P, "neutre", "ivoire", g);
    expect(espion).not.toHaveBeenCalled();
    for (const g of [undefined, Number.NaN, 1.5, -3, Infinity]) expect(planCroquis("ligne", P, "neutre", "ivoire", g)).toBeNull();
    expect(planCroquis("ligne", { ...P, largeur: 0 }, "neutre", "ivoire", 1)).toBeNull();
  });

  it("rugosité plafonnée à 1,5 ; paramètres invalides refusés sans exception", () => {
    expect(RUGOSITE_MAX).toBe(1.5);
    expect(reglagesCroquis({ ...P, rugosite: 9 }, "neutre", "ivoire", 3).roughness).toBe(1.5);
    expect(reglagesCroquis(P, "neutre", "ivoire", 3).roughness).toBeLessThanOrEqual(1.5);
    expect(reglagesCroquis(P, "neutre", "ivoire", 0).seed).toBeGreaterThanOrEqual(1);
    expect(validerCroquis(P)).not.toBeNull();
    for (const mauvais of [null, 3, {}, { ...P, x: -1 }, { ...P, largeur: 0 }, { ...P, hauteur: Number.NaN }, { ...P, rugosite: -1 }, { ...P, largeur: 150 }]) {
      expect(validerCroquis(mauvais)).toBeNull();
    }
  });
});

describe("X1-08 croquis — composition avec une bibliothèque simulée", () => {
  for (const forme of FORMES_CROQUIS) {
    it(`${forme} : même graine = même balisage, graine différente = balisage différent`, () => {
      const a = rendre(forme, 1234);
      expect(a).toContain("<path");
      expect(rendre(forme, 1234)).toBe(a);
      expect(rendre(forme, 99)).not.toBe(a);
    });
  }

  it("la composition demande exactement ce que le plan prévoit : méthode, nombres, graine, rugosité, couleur", () => {
    for (const forme of FORMES_CROQUIS) {
      appels.length = 0;
      rendre(forme, 4321, { ton: "accent", fond: "noir" });
      const plan = planCroquis(forme, P, "accent", "noir", 4321)!;
      expect(appels.length, forme).toBe(plan.traits.length);
      plan.traits.forEach((t, i) => {
        expect(appels[i].methode).toBe(t.genre === "ligne" ? "line" : t.genre);
        expect(appels[i].nombres).toEqual(t.nombres);
        expect(appels[i].options).toEqual({ seed: t.seed, roughness: plan.reglages.roughness, stroke: couleurDuTon("accent", "noir"), strokeWidth: plan.reglages.strokeWidth, fill: "none" });
        expect(appels[i].options.seed as number).toBeGreaterThanOrEqual(1);
        expect(appels[i].options.roughness as number).toBeLessThanOrEqual(1.5);
      });
    }
  });

  it("aucun Math.random atteint par le rendu", () => {
    const espion = vi.spyOn(Math, "random");
    for (const forme of FORMES_CROQUIS) for (const g of [0, 1, 4294967295]) rendre(forme, g);
    expect(espion).not.toHaveBeenCalled();
  });

  it("la graine est obligatoire : absente ou non entière, rien n'est dessiné et la bibliothèque n'est pas appelée", () => {
    for (const g of [undefined, Number.NaN, 1.5, -3, Infinity]) expect(rendre("ligne", g)).not.toContain("<path");
    expect(appels.length).toBe(0);
  });

  it("aucune couleur hors charte (pas d'hexadécimal écrit, seulement couleurDuTon)", () => {
    const permises = new Set<string>();
    for (const fond of FONDS) {
      for (const ton of TONS) permises.add(couleurDuTon(ton, fond).toLowerCase());
      permises.add(couleursSur(fond).texte.toLowerCase());
    }
    permises.add(PALETTE.reussite.toLowerCase());
    for (const fond of FONDS) for (const ton of TONS) for (const forme of FORMES_CROQUIS) {
      const m = rendre(forme, 5, { ton, fond });
      const couleurs = [...m.matchAll(/(?:stroke|fill)="(#[0-9a-fA-F]{3,8})"/g)].map((r) => r[1].toLowerCase());
      expect(couleurs.length).toBeGreaterThan(0);
      for (const c of couleurs) expect(permises.has(c), `${forme} ${ton} ${fond} ${c}`).toBe(true);
      expect(m).toContain(couleurDuTon(ton, fond));
    }
    for (const f of ["src/briques/motion/petits-objets/croquis.ts", "studio-rendu/compositions/petits-objets/croquis/Croquis.tsx"]) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(s, f).not.toMatch(/from ["']@\//);
      expect(s, f).not.toMatch(/Math\.random/);
      expect(s, f).not.toMatch(/\bany\b|require\(/);
    }
  });

  it("éteint : seul Croquis.tsx touche croquis et roughjs, rien d'autre ne les importe", async () => {
    expect(readFileSync("src/briques/motion/petits-objets/croquis.ts", "utf8")).not.toMatch(/roughjs/);
    const { execSync } = await import("node:child_process");
    const sortie = execSync(`grep -rEl "from ['\\"][^'\\"]*(croquis/Croquis|petits-objets/croquis|roughjs)" src studio-rendu/compositions studio-rendu/src --include=*.ts --include=*.tsx | grep -v "^src/briques/droits/" || true`, { encoding: "utf8" });
    expect(sortie.trim().split("\n").filter(Boolean).sort()).toEqual(["studio-rendu/compositions/petits-objets/croquis/Croquis.tsx"]);
  });
});
