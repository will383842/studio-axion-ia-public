import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const PALETTE = ["#faf9f5", "#e8e6dc", "#141413", "#b23f16", "#d97757", "#b0aea5"];
const SUR_NOIR_SEULEMENT = ["#d97757", "#b0aea5"];

const racine = CSS.slice(CSS.indexOf(":root {"), CSS.indexOf("}", CSS.indexOf(":root {")));
const jeton = (nom: string): string => {
  const m = racine.match(new RegExp(`--${nom}:\\s*([^;]+);`));
  if (!m) throw new Error(`jeton --${nom} absent`);
  return m[1].trim();
};

type Rvb = [number, number, number];
const versRvb = (h: string): Rvb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rvb;
/** Résout un jeton : un hex, ou `color-mix(in srgb, #A n%, #B)` (mélange dérivé de la palette). */
function resoudre(valeur: string): Rvb {
  const mix = valeur.match(/^color-mix\(in srgb,\s*(#[0-9a-fA-F]{6})\s+(\d+)%,\s*(#[0-9a-fA-F]{6})\)$/);
  if (mix) {
    const [a, b, p] = [versRvb(mix[1]), versRvb(mix[3]), Number(mix[2]) / 100];
    return a.map((v, i) => v * p + b[i] * (1 - p)) as Rvb;
  }
  if (/^#[0-9a-fA-F]{6}$/.test(valeur)) return versRvb(valeur);
  throw new Error(`valeur non résolue : ${valeur}`);
}
const lum = ([r, g, b]: Rvb) => {
  const c = [r, g, b].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contraste = (a: string, b: string) => {
  const [x, y] = [lum(resoudre(jeton(a))), lum(resoudre(jeton(b)))];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

describe("V7-10 : globals.css du Studio = palette Axion 2026", () => {
  it("aucun hex hors palette", () => {
    const hex = (CSS.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map((h) => h.toLowerCase());
    expect(hex.filter((h) => !PALETTE.includes(h))).toEqual([]);
  });
  it("le fond est le noir de la palette ; orange et gris clair seulement sur noir", () => {
    expect(jeton("fond").toLowerCase()).toBe("#141413");
    for (const h of SUR_NOIR_SEULEMENT) expect(CSS.toLowerCase()).toContain(h);
  });
  it("ni dégradé", () => {
    expect(CSS).not.toMatch(/(linear|radial|conic)-gradient/);
  });
  it("titres en Manrope seule (plus d'Archivo Black ni d'Arial Black)", () => {
    expect(CSS).not.toMatch(/police-titre|Arial Black|Archivo/);
    expect(CSS).toMatch(/--font-titre:\s*var\(--police-texte\)/);
  });
  it("contrastes WCAG AA (≥ 4,5:1 texte, ≥ 3:1 accent)", () => {
    const paires: [string, string, number][] = [
      ["texte", "fond", 4.5], ["texte", "surface-3", 4.5], ["texte-doux", "surface-2", 4.5],
      ["texte-faible", "surface-2", 4.5], ["sur-orange", "orange", 4.5], ["orange-vif", "fond", 3],
      ["brique", "fond", 4.5], ["sauge", "fond", 4.5], ["ambre", "fond", 4.5],
    ];
    for (const [a, b, min] of paires) expect(contraste(a, b), `${a}/${b}`).toBeGreaterThanOrEqual(min);
  });
});
