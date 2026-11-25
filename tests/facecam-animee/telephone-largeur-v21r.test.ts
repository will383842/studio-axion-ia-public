import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BANDE_YEUX_V4, DEMI_HAUTEUR_SOUS_TITRES_V4, Y_SOUS_TITRES_BASE_V4 } from "../../src/moteurs/montage-facecam-animee/realisateur/catalogue-v4";

// Chemin CALCULÉ (PIEGE-REMOTION-TSC.md) : le fichier de studio-rendu n'est lu que comme texte.
const CHEMIN = join(process.cwd(), ["studio-rendu", "compositions", "interface-claire", "motion-v4", "lot6", "rendus-lot6.tsx"].join("/"));
const TEXTE = readFileSync(CHEMIN, "utf8");
const nombre = (nom: string): number => {
  const m = new RegExp(`export const ${nom} = (\\d+);`).exec(TEXTE);
  if (!m) throw new Error(`${nom} introuvable`);
  return Number(m[1]);
};
const H = 1920;
/** Demi-bloc de 2 mots empilés : 1,27 × 84 px (briques-v4.tsx:294, tailleBase = 84). */
const DEMI_EMPILE = 1.27 * 84;

function geometrie(L: number, haut: number) {
  return { haut, bas: haut + 2 * L + Math.round(0.025 * L), largeur: L };
}
const centre = (L: number) => (H - 2 * L) / 2;

describe("TELEPHONE-LARGEUR-a-v21r : le téléphone finit au-dessus des sous-titres", () => {
  const L = nombre("LARGEUR_TELEPHONE_VIDEO");
  const haut = nombre("HAUT_TELEPHONE_VIDEO");
  const g = geometrie(L, haut);

  it("(a) bas avec ombre au-dessus du cas de 2 mots empilés", () => {
    expect(g.bas).toBeLessThan(Y_SOUS_TITRES_BASE_V4 * H - DEMI_EMPILE);
  });
  it("(b) bas avec ombre au-dessus du haut nominal des sous-titres", () => {
    expect(g.bas).toBeLessThan((Y_SOUS_TITRES_BASE_V4 - DEMI_HAUTEUR_SOUS_TITRES_V4) * H);
  });
  it("(c) dans l'image, centré horizontalement", () => {
    expect(g.haut).toBeGreaterThanOrEqual(0);
    expect(g.largeur).toBeLessThanOrEqual(1080);
    expect(TEXTE).toContain('alignItems: "center"');
  });
  it("(d) couvre toujours la bande des yeux", () => {
    expect(g.haut).toBeLessThanOrEqual(BANDE_YEUX_V4[0] * H);
    expect(g.bas).toBeGreaterThanOrEqual(BANDE_YEUX_V4[1] * H);
  });
  it("(e) témoin : L = 560 centré et L = 184 centré sont refusés", () => {
    const ok = (x: { haut: number; bas: number }) =>
      x.bas < Y_SOUS_TITRES_BASE_V4 * H - DEMI_EMPILE && x.haut <= BANDE_YEUX_V4[0] * H && x.bas >= BANDE_YEUX_V4[1] * H;
    expect(ok(geometrie(560, centre(560)))).toBe(false);
    expect(geometrie(560, centre(560)).bas).toBe(1534);
    expect(ok(geometrie(184, centre(184)))).toBe(false);
    expect(ok(g)).toBe(true);
  });
  it("(f) l'arbre AbsoluteFill > TelephoneVideo et largeur={LARGEUR_TELEPHONE_VIDEO} restent", () => {
    // `justifyContent: "flex-start"` fige la position « haut à 300 px » (centré sous le padding, le téléphone passerait sous les sous-titres).
    expect(TEXTE).toMatch(/<AbsoluteFill style=\{\{ alignItems: "center", justifyContent: "flex-start", paddingTop: HAUT_TELEPHONE_VIDEO \}\}>\s*<TelephoneVideo[^>]*largeur=\{LARGEUR_TELEPHONE_VIDEO\}/);
  });
});
