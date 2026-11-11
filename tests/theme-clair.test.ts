import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/app/globals.css", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");

function bloc(sel: string): string {
  const i = css.indexOf(`${sel} {`);
  expect(i).toBeGreaterThanOrEqual(0);
  return css.slice(i, css.indexOf("\n}", i));
}
const racine = bloc(":root");
const sombre = bloc(".theme-sombre");
const val = (b: string, n: string) => new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`).exec(b)?.[1] ?? "";
const brut = (b: string, n: string) => new RegExp(`--${n}:\\s*([^;]+);`).exec(b)?.[1].trim() ?? "";

const PALETTE_UI = ["#FAF9F5", "#E8E6DC", "#141413", "#B23F16", "#D97757", "#B0AEA5", "#5E7050", "#5E5D59", "#FFFFFF"];

function rgbDe(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}
function hexDe([r, g, b]: number[]): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}
/** Lit `--n: rgb(R G B / a)` et renvoie la base (hex) et l'opacité. */
function teinte(b: string, n: string): { base: string; a: number } {
  const m = new RegExp(`--${n}:\\s*rgb\\((\\d+) (\\d+) (\\d+) / ([0-9.]+)\\)`).exec(b);
  expect(m, `teinte --${n}`).not.toBeNull();
  return { base: hexDe([+m![1], +m![2], +m![3]]), a: +m![4] };
}
/** Mélange sRGB arrondi d'une base d'opacité a posée sur une couleur de dessous. */
function compose(base: string, a: number, dessous: string): string {
  const x = rgbDe(base);
  const y = rgbDe(dessous);
  return hexDe(x.map((v, i) => Math.round(v * a + y[i] * (1 - a))));
}

function lum(hex: string): number {
  const c = rgbDe(hex).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const EXACT_RACINE: Record<string, string> = {
  fond: "#FAF9F5", "surface-1": "#FFFFFF", "surface-2": "#FAF9F5", "surface-3": "#E8E6DC",
  trait: "#E8E6DC", "trait-fort": "#5E5D59", texte: "#141413", "texte-doux": "#5E5D59", "texte-faible": "#5E5D59",
  orange: "#B23F16", "orange-vif": "#B23F16", "sur-orange": "#FFFFFF", sauge: "#5E7050", ambre: "#141413", brique: "#B23F16",
};
const EXACT_RACINE_RGB: Record<string, string> = {
  "orange-doux": "rgb(178 63 22 / 0.10)", "sauge-doux": "rgb(94 112 80 / 0.08)", "ambre-doux": "rgb(20 20 19 / 0.08)",
  "brique-doux": "rgb(178 63 22 / 0.10)", voile: "rgb(20 20 19 / 0.45)",
};
const EXACT_SOMBRE: Record<string, string> = {
  fond: "#141413", "surface-1": "#141413", "surface-2": "#141413", "surface-3": "#141413",
  "trait-fort": "#B0AEA5", texte: "#FAF9F5", "texte-doux": "#B0AEA5", "texte-faible": "#B0AEA5",
  orange: "#D97757", "orange-vif": "#D97757", "sur-orange": "#141413", sauge: "#5E7050", ambre: "#E8E6DC", brique: "#D97757",
};
const EXACT_SOMBRE_RGB: Record<string, string> = {
  trait: "rgb(250 249 245 / 0.14)", "orange-doux": "rgb(217 119 87 / 0.16)", "sauge-doux": "rgb(94 112 80 / 0.16)",
  "ambre-doux": "rgb(232 230 220 / 0.16)", "brique-doux": "rgb(217 119 87 / 0.16)", voile: "rgb(20 20 19 / 0.72)",
  "ombre-carte": "0 1px 0 rgb(250 249 245 / 0.03) inset, 0 12px 32px -16px rgb(20 20 19 / 0.6)",
  "ombre-orange": "0 10px 30px -10px rgb(217 119 87 / 0.45)",
};

describe("thème clair de la zone de page", () => {
  it("la racine est claire, la zone sombre est la palette sur noir", () => {
    expect(racine).toMatch(/--fond:\s*#FAF9F5/i);
    expect(racine).toContain("color-scheme: light");
    expect(sombre).toContain("--fond: #141413");
    expect(sombre).toContain("--texte: #FAF9F5");
    expect(sombre).toContain("color-scheme: dark");
  });
  it("valeurs exactes de :root", () => {
    for (const [n, v] of Object.entries(EXACT_RACINE)) expect(racine, n).toMatch(new RegExp(`--${n}:\\s*${v}`, "i"));
    for (const [n, v] of Object.entries(EXACT_RACINE_RGB)) expect(brut(racine, n), n).toBe(v);
    expect(brut(racine, "lueur")).toBe("none");
    expect(brut(racine, "lueur-forte")).toBe("none");
  });
  it("valeurs exactes de .theme-sombre", () => {
    for (const [n, v] of Object.entries(EXACT_SOMBRE)) expect(sombre, n).toMatch(new RegExp(`--${n}:\\s*${v}`, "i"));
    for (const [n, v] of Object.entries(EXACT_SOMBRE_RGB)) expect(brut(sombre, n), n).toBe(v);
    expect(brut(sombre, "lueur")).toBe("none");
    expect(brut(sombre, "lueur-forte")).toBe("none");
  });
  it("toute couleur des deux blocs appartient à la palette", () => {
    for (const [nom, b] of [[":root", racine], [".theme-sombre", sombre]] as const) {
      for (const m of b.matchAll(/#[0-9a-fA-F]{6}\b/g)) expect(PALETTE_UI, `${nom} ${m[0]}`).toContain(m[0].toUpperCase());
      for (const m of b.matchAll(/rgb\((\d+) (\d+) (\d+)/g))
        expect(PALETTE_UI, `${nom} ${m[0]}`).toContain(hexDe([+m[1], +m[2], +m[3]]));
    }
    expect(css).not.toMatch(/8F3412/i);
    expect(css).not.toContain("gradient(");
  });
  it("aucun bleu ni jaune dans :root ni dans .theme-sombre", () => {
    for (const b of [racine, sombre])
      for (const m of b.matchAll(/--[a-z0-9-]+:\s*(#[0-9a-fA-F]{6})/g)) {
        const [r, g, bl] = rgbDe(m[1]);
        expect(bl > r + 20 && bl > g + 20, `bleu ${m[0]}`).toBe(false);
        expect(r > bl + 60 && g > bl + 60 && Math.abs(r - g) < 40, `jaune ${m[0]}`).toBe(false);
      }
  });
  it("orange et gris sur noir seulement, terracotta jamais en texte sur noir", () => {
    expect(racine).not.toMatch(/#D97757/i);
    expect(racine).not.toMatch(/#B0AEA5/i);
    for (const n of ["texte", "texte-doux", "texte-faible", "orange-vif", "sauge", "ambre", "brique"])
      expect(val(sombre, n).toUpperCase(), `--${n} sombre`).not.toBe("#B23F16");
  });
  it("contrastes WCAG AA de :root", () => {
    const fonds = ["fond", "surface-1", "surface-2", "surface-3"].map((n) => val(racine, n));
    for (const t of ["texte", "texte-doux", "texte-faible"])
      for (const f of fonds) expect(ratio(val(racine, t), f), `${t} / ${f}`).toBeGreaterThanOrEqual(4.5);
    for (const t of ["orange-vif", "sauge", "ambre", "brique"])
      for (const f of ["fond", "surface-1", "surface-2"].map((n) => val(racine, n)))
        expect(ratio(val(racine, t), f), `${t} / ${f}`).toBeGreaterThanOrEqual(4.5);
    expect(ratio(val(racine, "sur-orange"), val(racine, "orange"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(val(racine, "fond"), val(racine, "sauge"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(val(racine, "fond"), val(racine, "ambre"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(val(racine, "sur-orange"), val(racine, "brique"))).toBeGreaterThanOrEqual(4.5);
    for (const [t, d] of [["orange-vif", "orange-doux"], ["brique", "brique-doux"], ["sauge", "sauge-doux"], ["ambre", "ambre-doux"]])
      for (const f of [val(racine, "fond"), val(racine, "surface-1")]) {
        const { base, a } = teinte(racine, d);
        expect(ratio(val(racine, t), compose(base, a, f)), `${t} sur ${d} / ${f}`).toBeGreaterThanOrEqual(4.5);
      }
    for (const f of ["fond", "surface-1"]) expect(ratio(val(racine, "trait-fort"), val(racine, f)), `trait-fort / ${f}`).toBeGreaterThanOrEqual(3);
    for (const f of ["fond", "surface-1", "surface-3"]) expect(ratio(val(racine, "orange-vif"), val(racine, f)), `focus / ${f}`).toBeGreaterThanOrEqual(3);
  });
  it("contrastes de .theme-sombre", () => {
    const fond = val(sombre, "fond");
    for (const t of ["texte", "texte-doux", "texte-faible", "orange-vif", "ambre", "brique"])
      expect(ratio(val(sombre, t), fond), t).toBeGreaterThanOrEqual(4.5);
    expect(ratio(val(sombre, "sur-orange"), val(sombre, "orange"))).toBeGreaterThanOrEqual(4.5);
    const { base, a } = teinte(sombre, "orange-doux");
    expect(ratio(val(sombre, "orange-vif"), compose(base, a, fond))).toBeGreaterThanOrEqual(4.5);
    for (const t of ["sauge", "trait-fort"]) expect(ratio(val(sombre, t), fond), t).toBeGreaterThanOrEqual(3);
  });
  it("états distincts dans chaque bloc", () => {
    for (const b of [racine, sombre]) {
      const [br, sa, am, or] = ["brique", "sauge", "ambre", "orange"].map((n) => val(b, n).toUpperCase());
      expect(new Set([sa, am]).size).toBe(2);
      expect(sa).not.toBe(or);
      expect(am).not.toBe(or);
      // brique = orange dans les deux blocs (ESCALADE E1) : seul brique ≠ sauge, ambre est vérifié
      expect(br).not.toBe(sa);
      expect(br).not.toBe(am);
    }
  });
  it.todo("erreur ≠ accent (brique ≠ orange) : décision de Williams, ESCALADE E1");
});

describe("police : Manrope seule", () => {
  it("titres en Manrope 800", () => {
    const fontTitre = /--font-titre:\s*([^;]+);/.exec(css)?.[1] ?? "";
    expect(fontTitre).toContain("--police-texte");
    expect(fontTitre).not.toContain("police-titre");
    expect(fontTitre).not.toContain("Arial Black");
    const i = css.search(/h1,\s*h2,\s*h3 \{/);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(css.slice(i, css.indexOf("}", i))).toContain("font-weight: 800");
    expect(css).toContain(".font-titre { font-weight: 800; }");
    expect(css).not.toContain("Archivo");
    expect(layout).not.toMatch(/archivo/i);
    expect(layout).not.toContain("--police-titre");
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
