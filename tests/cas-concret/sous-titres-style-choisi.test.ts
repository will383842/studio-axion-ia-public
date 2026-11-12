/**
 * GV-ST-02 · cas concret : la variante de sous-titres tirée par vidéo est supprimée par défaut ; le style choisi dans la
 * Bibliothèque fait loi (base karaoké pour un style karaoké). Calcul pur : aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import { baseRetenue } from "@/briques/sous-titres";
import { STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import {
  centreSousTitresCasConcret,
  surlignageCasConcret,
  variationSousTitresCasConcret,
  VARIANTE_PAR_VIDEO,
  type TirageSousTitres,
} from "@/moteurs/montage-cas-concret/sous-titres-variete";
import { TIRAGE_V4 } from "@/moteurs/montage-cas-concret/variete";
import { centreSousTitresPleineImagePct } from "@/moteurs/montage-cas-concret/zone-objets";

const V4: TirageSousTitres = TIRAGE_V4.sousTitres;
const VIDEO_A: TirageSousTitres = { inclinaison: "inverse", intensite: "vif", accent: "surlignage", hauteur: "haute" };
const VIDEO_B: TirageSousTitres = { inclinaison: "v4", intensite: "calme", accent: "v4", hauteur: "v4" };

describe("GV-ST-02 · plus de variante tirée par vidéo", () => {
  it("la variante par vidéo est coupée par défaut", () => {
    expect(VARIANTE_PAR_VIDEO).toBe(false);
  });

  it("deux vidéos de tirages différents : aucun écart d'inclinaison, de surlignage ni de hauteur", () => {
    for (const t of [undefined, null, V4, VIDEO_A, VIDEO_B]) {
      expect(variationSousTitresCasConcret(t)).toEqual({});
      expect(surlignageCasConcret(t)).toEqual({});
      expect(centreSousTitresCasConcret(t)).toBe(centreSousTitresPleineImagePct());
    }
  });
});

describe("GV-ST-02 · style de la Bibliothèque", () => {
  it("un style karaoké donne la base karaoké ; la base de la commande l'emporte", () => {
    expect(baseRetenue(undefined, STYLE_SOUS_TITRES_AVOCAT)).toBe("karaoke");
    expect(baseRetenue("minimal", STYLE_SOUS_TITRES_AVOCAT)).toBe("minimal");
  });
});
