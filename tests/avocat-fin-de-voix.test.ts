import { describe, expect, it } from "vitest";
import { fonduDeFin } from "@/briques/composition/parametres";
import { RECETTE_COMPOSITION_AVOCAT } from "@/moteurs/montage-avocat/recette-composition";

// GV2-37 : le fondu de fin de l'avocat commence 0,5 s après le dernier mot (la vidéo finit 1,2 s après lui).
const DUREE = 11.2;
const DERNIER_MOT = 10;

describe("fondu de fin de l'avocat (GV2-37)", () => {
  const recette = RECETTE_COMPOSITION_AVOCAT;

  it("avec la recette avocat, le fondu commence 0,5 s après le dernier mot", () => {
    const d = fonduDeFin({ dureeSec: DUREE, dernierMotSec: DERNIER_MOT, finEnBoucle: false, maxSec: recette.fonduFinMaxSec, margeSec: recette.fonduFinApresMotSec });
    expect(d).toBeCloseTo(0.7, 3);
    expect(DUREE - d!).toBeCloseTo(DERNIER_MOT + 0.5, 3);
  });

  it("sans marge, la valeur d'avant ne change pas", () => {
    expect(fonduDeFin({ dureeSec: DUREE, dernierMotSec: DERNIER_MOT, finEnBoucle: false, maxSec: 1 })).toBe(1);
    expect(fonduDeFin({ dureeSec: 10.5, dernierMotSec: DERNIER_MOT, finEnBoucle: false, maxSec: 1 })).toBe(0.5);
  });

  it("fin en boucle : aucun fondu", () => {
    expect(fonduDeFin({ dureeSec: DUREE, dernierMotSec: DERNIER_MOT, finEnBoucle: true, maxSec: 1, margeSec: 0.5 })).toBeUndefined();
  });
});
