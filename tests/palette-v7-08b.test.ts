import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// V7-08b (lot L6) : dans ces fichiers, seules les couleurs de la charte Axion 2026 sont permises, plus les
// matières réalistes (métal du micro) déclarées en constantes nommées MATIERE_* en tête de fichier, sans teinte
// bleue ni jaune. Les silhouettes (peau, cheveux) gardent leurs teintes réalistes : décision D1, hors de ce test.
const PALETTE = new Set(["#FAF9F5", "#E8E6DC", "#141413", "#B23F16", "#D97757", "#B0AEA5"]);
const BASE = "studio-rendu/compositions/commune/";
const FICHIERS = ["MicroPodcast.tsx", "effets/objets.ts"].map((f) => BASE + f);
const DECLARATION_MATIERE = /^const (MATIERE_[A-Z0-9_]+) = "(#[0-9A-Fa-f]{6})";$/gm;

function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
function hexHorsMatieres(src: string): string[] {
  return sansCommentaires(src).replace(DECLARATION_MATIERE, "").match(/#[0-9A-Fa-f]{3,8}\b/g) ?? [];
}
function matieres(src: string): string[] {
  return [...sansCommentaires(src).matchAll(DECLARATION_MATIERE)].map((m) => m[2]);
}
function rgbaHorsPalette(src: string): string[] {
  const permis = new Set(["20,20,19", "250,249,245", "232,230,220", "178,63,22", "217,119,87", "176,174,165"]);
  return [...sansCommentaires(src).matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)].map((m) => `${m[1]},${m[2]},${m[3]}`).filter((c) => !permis.has(c));
}

describe("palette V7-08b", () => {
  for (const f of FICHIERS) {
    const src = readFileSync(f, "utf8");
    it(`${f} n'utilise que la palette et des matières déclarées`, () => {
      const hors = [...new Set(hexHorsMatieres(src).filter((h) => !PALETTE.has(h.toUpperCase())))];
      expect(hors).toEqual([]);
      expect(rgbaHorsPalette(src)).toEqual([]);
    });
    it(`${f} : les matières déclarées n'ont ni teinte bleue ni teinte jaune`, () => {
      for (const h of matieres(src)) {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
        expect(b - r, h).toBeLessThanOrEqual(0);
        expect(Math.min(r, g) - b, h).toBeLessThanOrEqual(2);
      }
    });
  }
  it("MicroPodcast : sa lumière par défaut est l'orange de la charte", () => {
    expect(readFileSync(BASE + "MicroPodcast.tsx", "utf8")).toContain('const COULEUR_LUMIERE = "#D97757";');
  });
  // Passe 2 : sur le plateau NOIR, le pull et la manche (noir sur mur noir, contraste 1,00) portent un filet gris.
  describe("PlateauEffets : contours sur fond noir", () => {
    const src = readFileSync(BASE + "effets/PlateauEffets.tsx", "utf8");
    const valeur = (nom: string) => src.match(new RegExp(`const ${nom} = "(#[0-9A-Fa-f]{6})";`))?.[1].toUpperCase();
    const balise = (debut: RegExp) => src.split("\n").find((l) => debut.test(l)) ?? "";
    const mur = valeur("NOIR");
    const filet = valeur("GRIS_SUR_NOIR");
    it("le filet est le gris sur noir de la palette, différent du mur", () => {
      expect(mur).toBe("#141413");
      expect(filet).toBe("#B0AEA5");
      expect(filet).not.toBe(mur);
    });
    it("le pull et la manche ont un contour (stroke) de couleur différente du mur, de 3 px", () => {
      for (const l of [balise(/Z" fill=\{NOIR\}/), balise(/h \+ 40\} Z`\} fill=\{NOIR\}/)]) {
        expect(l).toContain("fill={NOIR}");
        expect(l).toContain("stroke={GRIS_SUR_NOIR}");
        expect(l).toContain("strokeWidth={3}");
      }
    });
    it("le col se distingue du pull (texte secondaire #5E5D59)", () => {
      expect(valeur("GRIS_TEXTE_SECONDAIRE")).toBe("#5E5D59");
      expect(balise(/390 1010 Z"/)).toContain("fill={GRIS_TEXTE_SECONDAIRE}");
    });
    it("le halo de l'étagère n'est plus terracotta sur noir", () => {
      expect(src).not.toContain("rgba(178,63,22");
      expect(src).toContain("rgba(217,119,87,0.25)");
    });
  });
  // Passe 2 : les objets sont posés sur le plateau noir : orange #D97757 (jamais terracotta), A sombre sur tuile orange.
  describe("objets.ts : rôles sur fond noir", () => {
    const src = readFileSync(BASE + "effets/objets.ts", "utf8");
    it("ORANGE est l'orange sur noir, le bord de pièce est le gris sur noir", () => {
      expect(src).toContain('const ORANGE = "#D97757";');
      expect(src).toContain('const GRIS = "#B0AEA5";');
      expect(src).not.toContain("#B23F16\";");
      expect(src).toContain("matiere(T, GRIS, { metal: 0.9");
    });
    it("le halo de l'écran est ivoire discret et le « A » posé sur une tuile orange est sombre", () => {
      expect(src).toContain("rgba(250,249,245,0.12)");
      expect(src).not.toMatch(/halo\.addColorStop\([01], "rgba\(217,119,87/);
      expect(src).not.toMatch(/matiere\(T, CREME, \{ (rugosite: 0\.42|rugosite: 0\.45|metal: 0\.3)/);
    });
  });
  it("MicroPodcast : les matières sont nommées par rôle, plus numérotées", () => {
    const src = readFileSync(BASE + "MicroPodcast.tsx", "utf8");
    expect(src).not.toMatch(/MATIERE_METAL_\d/);
    expect(src).toMatch(/MATIERE_MOUSSE_HAUT/);
    expect(src).toMatch(/MATIERE_GRILLE_POINT_CLAIR/);
  });
});
