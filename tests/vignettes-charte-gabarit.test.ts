/** Vignettes : un gabarit unique aux couleurs de la charte (aucun bleu / jaune / vert), titre centré dans la zone sûre. */
import { describe, expect, it } from "vitest";
import { COULEURS_VIDEO } from "@/briques/habillage/charte-video";
import { AMBIANCES } from "../studio-rendu/compositions/commune/vignette/socle";
import { MISES, MISE_INSTAGRAM, MISE_FOND_PROPRE } from "../studio-rendu/compositions/commune/vignette/mises";

const hex = (c: string) => c.toUpperCase();

describe("vignette Axion · charte du 07/11", () => {
  it("les ambiances n'emploient que les jetons de la charte", () => {
    const permis = new Set(Object.values(COULEURS_VIDEO).map(hex));
    for (const a of Object.values(AMBIANCES)) for (const c of [a.fond, a.texte, a.pave, a.paveTexte, a.lisere]) expect(permis.has(hex(c)), c).toBe(true);
  });
  it("le titre sans image est centré, gros, dans la zone sûre (ni haut ni bas des grilles)", () => {
    expect(MISE_FOND_PROPRE.titre.align).toBe("centre");
    expect(MISE_FOND_PROPRE.titre.taille).toBeGreaterThanOrEqual(128);
    expect(MISE_FOND_PROPRE.titre.x).toBeGreaterThanOrEqual(84);
    expect(MISE_FOND_PROPRE.titre.x + MISE_FOND_PROPRE.titre.largeur).toBeLessThanOrEqual(1080 - 84);
    expect(MISE_INSTAGRAM.titre.align).toBe("centre");
  });
  it("les mises verticales avec image gardent le titre dans les 84 px de marge", () => {
    for (const m of Object.values(MISES["9:16"])) expect(m.titre.x + m.titre.largeur).toBeLessThanOrEqual(1080 - 84);
  });
});
