/** Vignettes : l'image choisie n'est jamais vide, noire, délavée ou floue ; sinon fond propre de la charte. */
import { describe, expect, it } from "vitest";
import { choisirImagePropre, jugerImage, type MesureImage } from "../../studio-rendu/src/operations/miniature";

const bonne = (t: number, flou = 2): MesureImage => ({ instantSec: t, flou, luminosite: 120, contraste: 90 });

describe("jugerImage", () => {
  it("accepte une image normale", () => expect(jugerImage(bonne(5))).toBe(true));
  it("rejette une image noire", () => expect(jugerImage({ ...bonne(5), luminosite: 8 })).toBe(false));
  it("rejette une image presque blanche (vide)", () => expect(jugerImage({ ...bonne(5), luminosite: 248 })).toBe(false));
  it("rejette une image à moitié fondue (faible contraste)", () => expect(jugerImage({ ...bonne(5), contraste: 12 })).toBe(false));
  it("rejette une image floue", () => expect(jugerImage({ ...bonne(5), flou: 40 })).toBe(false));
  it("sans mesure de contraste ni de luminosité, une image n'est pas jugée mauvaise", () => expect(jugerImage({ instantSec: 1 })).toBe(true));
});

describe("choisirImagePropre", () => {
  it("prend la plus nette parmi les acceptables", () => {
    const r = choisirImagePropre([bonne(5, 4), bonne(6, 1), { ...bonne(7, 0.5), luminosite: 5 }], 5);
    expect(r?.instantSec).toBe(6);
  });
  it("aucune acceptable : null (fond propre de la charte, jamais une image coupée)", () => {
    expect(choisirImagePropre([{ ...bonne(5), luminosite: 5 }, { ...bonne(6), contraste: 3 }], 5)).toBeNull();
  });
  it("aucune mesure : null", () => expect(choisirImagePropre([], 5)).toBeNull());
});
