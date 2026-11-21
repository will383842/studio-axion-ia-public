/** G4-11b-2 : la courbe à plusieurs séries est inscrite au plan de scènes, porte FERMÉE (pièce gardée). */
import { describe, expect, it } from "vitest";
import { CATALOGUE_BRIQUES } from "../../../src/briques/plan-scenes/catalogue";
import { RENDUS_BRIQUES } from "../../../src/briques/plan-scenes/briques";
import { consignePlan } from "../../../src/briques/plan-scenes/generateur";
import { affichageDeLaScene, PIECES_DE_DONNEES } from "../../../src/briques/plan-scenes/controles";
import { estGardee, PIECES_GARDEES } from "../../../src/briques/plan-scenes/pieces-gardees";
import { TOILES } from "../../../src/briques/plan-scenes/toiles";
import { EXEMPLE_COURBE_SERIES } from "../../../src/briques/plan-scenes-donnees/definition-courbe-series";
import { MONTRE_PAR_PIECE } from "../../../src/briques/note-extraits/moments-ecran";

describe("courbe-series inscrite, gardée", () => {
  it("catalogue, rendu, toile et garde", () => {
    const d = CATALOGUE_BRIQUES["courbe-series"];
    expect(d.id).toBe("courbe-series");
    expect(RENDUS_BRIQUES["courbe-series"]).toBeTypeOf("function");
    expect(TOILES["courbe-series"]).toEqual(TOILES.graphique);
    expect(d.toile).toEqual(TOILES["courbe-series"]);
    expect(PIECES_GARDEES).toContain("courbe-series");
    expect(estGardee(d)).toBe(true);
    expect(PIECES_DE_DONNEES).toContain("courbe-series");
  });
  it("porte fermée : la consigne ne la cite pas sans permission, la cite avec", () => {
    expect(consignePlan()).not.toContain("courbe-series");
    expect(consignePlan([])).not.toContain("courbe-series");
    expect(consignePlan(["courbe-series"])).toContain("courbe-series");
  });
  it("contrôle : titre et chaque valeur des séries sont à vérifier", () => {
    const a = affichageDeLaScene({ piece: "courbe-series", parametres: EXEMPLE_COURBE_SERIES } as never);
    expect(a.blocs.map((b) => b.texte)).toEqual([EXEMPLE_COURBE_SERIES.titre]);
    expect(a.nombres).toEqual(EXEMPLE_COURBE_SERIES.series.flatMap((s) => s.valeurs));
  });
  it("moment d'écran : chiffre", () => {
    expect(MONTRE_PAR_PIECE["courbe-series"]).toBe("chiffre");
  });
});
