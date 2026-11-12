import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/app/globals.css", "utf8");

function bloc(sel: string): string {
  const i = css.indexOf(`${sel} {`);
  expect(i).toBeGreaterThanOrEqual(0);
  return css.slice(i, css.indexOf("\n}", i));
}
const racine = bloc(":root");
const sombre = bloc(".theme-sombre");
const val = (b: string, n: string) => new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`).exec(b)?.[1] ?? "";

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe("thème clair de la zone de page", () => {
  it("la racine est claire (bleu ciel pâle, décision du 12/11), la zone sombre est bleutée", () => {
    expect(racine).toMatch(/--fond:\s*#f3f7fb/i);
    expect(racine).toContain("color-scheme: light");
    expect(sombre).toContain("--fond: #16202b");
    expect(sombre).toContain("--texte: #eaf1f7");
    expect(sombre).toContain("color-scheme: dark");
  });
  it("aucun jaune dans :root (le bleu est voulu depuis le 12/11)", () => {
    for (const m of racine.matchAll(/--[a-z0-9-]+:\s*(#[0-9a-fA-F]{6})/g)) {
      if (m[0].startsWith("--fam-")) continue; // familles de contenu (olive du Carrousel validée en maquette M0)
      const h = m[1];
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
      expect(r > b + 60 && g > b + 60 && Math.abs(r - g) < 40, `jaune ${m[0]}`).toBe(false);
    }
  });
  it("contrastes WCAG AA", () => {
    const fonds = ["fond", "surface-1", "surface-2", "surface-3"].map((n) => val(racine, n));
    for (const t of ["texte", "texte-doux", "texte-faible"])
      for (const f of fonds) expect(ratio(val(racine, t), f), `${t} / ${f}`).toBeGreaterThanOrEqual(4.5);
    for (const t of ["orange-vif", "sauge", "ambre", "brique"])
      for (const f of fonds.slice(0, 2)) expect(ratio(val(racine, t), f), `${t} / ${f}`).toBeGreaterThanOrEqual(4.5);
    expect(ratio(val(racine, "sur-orange"), val(racine, "orange"))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("thèmes : mêmes variables", () => {
  it("les variables de .theme-sombre sont celles de :root (sauf tailles de barres)", () => {
    const noms = (b: string) => new Set([...b.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]));
    const attendu = noms(racine);
    for (const n of [...attendu]) if (n === "--hauteur-onglets-bas" || n.startsWith("--largeur-barre")) attendu.delete(n);
    expect([...noms(sombre)].sort()).toEqual([...attendu].sort());
  });
});
