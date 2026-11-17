/** X1-08 — style croquis (roughjs en SVG) : pièces neuves, non inscrites, graine de la vidéo obligatoire. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Croquis, type ProprietesCroquis } from "../../studio-rendu/compositions/petits-objets/croquis/Croquis";
import { FORMES_CROQUIS, RUGOSITE_MAX, reglagesCroquis, validerCroquis } from "../../src/briques/motion/petits-objets/croquis";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";
import { PALETTE } from "../../src/briques/charte/axion-2026";
import type { TonObjet } from "../../src/briques/motion/petits-objets/contrat";

const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const FONDS: FondAxion[] = ["ivoire", "noir"];
const P = { x: 10, y: 20, largeur: 60, hauteur: 40 };

function rendre(forme: (typeof FORMES_CROQUIS)[number], graine: number, o: Partial<ProprietesCroquis> = {}) {
  return renderToStaticMarkup(createElement(Croquis, { forme, parametres: P, graine, ton: "neutre", fond: "ivoire", ...o }));
}

afterEach(() => vi.restoreAllMocks());

describe("X1-08 croquis", () => {
  for (const forme of FORMES_CROQUIS) {
    it(`${forme} : même graine = même balisage, graine différente = balisage différent`, () => {
      const a = rendre(forme, 1234);
      expect(a).toContain("<path");
      expect(rendre(forme, 1234)).toBe(a);
      expect(rendre(forme, 99)).not.toBe(a);
    });
  }

  it("aucun Math.random atteint, même avec une graine nulle", () => {
    const espion = vi.spyOn(Math, "random");
    for (const forme of FORMES_CROQUIS) for (const g of [0, 1, 4294967295]) rendre(forme, g);
    expect(espion).not.toHaveBeenCalled();
  });

  it("la graine est obligatoire : absente ou non entière, rien n'est dessiné", () => {
    for (const g of [undefined, Number.NaN, 1.5, -3, Infinity]) {
      const m = renderToStaticMarkup(createElement(Croquis, { forme: "ligne", parametres: P, graine: g as unknown as number, ton: "neutre", fond: "ivoire" }));
      expect(m).not.toContain("<path");
    }
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

  it("éteint : seul Croquis.tsx touche croquis et roughjs, rien d'autre ne les importe", async () => {
    expect(readFileSync("src/briques/motion/petits-objets/croquis.ts", "utf8")).not.toMatch(/roughjs/);
    const { execSync } = await import("node:child_process");
    const sortie = execSync(`grep -rEl \"from ['\\\"][^'\\\"]*(croquis/Croquis|petits-objets/croquis|roughjs)\" src studio-rendu/compositions studio-rendu/src --include=*.ts --include=*.tsx | grep -v "^src/briques/droits/" || true`, { encoding: "utf8" });
    expect(sortie.trim().split("\n").filter(Boolean).sort()).toEqual(["studio-rendu/compositions/petits-objets/croquis/Croquis.tsx"]);
  });
});
