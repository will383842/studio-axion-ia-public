/** GV2-52 · image → vidéo : l'axe des sous-titres ne pèse rien tant que son effet est éteint. */
import { describe, expect, it } from "vitest";
import { REFERENCES, type RecetteVarieteIV } from "@/briques/schema-motion/variete";
import { poidsAxe, POIDS_AXES, ressemblanceRecette } from "@/moteurs/montage-image-video/variete/ressemblance";
import { VARIANTE_PAR_VERSION } from "@/moteurs/montage-image-video/sous-titres-varies";

const ref = REFERENCES as unknown as RecetteVarieteIV;
const A: RecetteVarieteIV = { ...ref, sousTitres: "SOU-B" } as RecetteVarieteIV;
const B: RecetteVarieteIV = { ...ref, sousTitres: "SOU-C" } as RecetteVarieteIV;

describe("GV2-52 · axe éteint", () => {
  it("le drapeau est éteint dans le code livré", () => expect(VARIANTE_PAR_VERSION).toBe(false));
  it("poids 0 si éteint, 1 si allumé ; les autres axes inchangés", () => {
    expect(poidsAxe("sousTitres", false)).toBe(0);
    expect(poidsAxe("sousTitres", true)).toBe(POIDS_AXES.sousTitres);
    expect(POIDS_AXES.sousTitres).toBe(1);
    expect(poidsAxe("ouverture", false)).toBe(3);
  });
  it("deux recettes qui ne diffèrent que par les sous-titres : ressemblance 1 (éteint), moins de 1 (allumé)", () => {
    expect(ressemblanceRecette(A, B, false)).toBe(1);
    expect(ressemblanceRecette(A, B)).toBe(1);
    expect(ressemblanceRecette(A, B, true)).toBeLessThan(1);
  });
});
