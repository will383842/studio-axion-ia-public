/** Les propriétés par défaut des compositions (`exemples.ts`, généré) sont égales à la vraie mise en page. */
import { describe, expect, it } from "vitest";
import { BULLE_EXEMPLE, LIGNE_EXEMPLE, SCENE_EXEMPLE } from "../../../studio-rendu/compositions/tableau/exemples";
import { pagesExemples } from "../compositions/exemples-attendus";

describe("exemples des compositions", () => {
  it("pages, cadre, zone sûre et bande : ceux de `mettreEnPage` (relancer generer-exemples.mts sinon)", () => {
    const attendu = JSON.parse(JSON.stringify(pagesExemples()));
    expect(SCENE_EXEMPLE.page).toEqual(attendu.accroche);
    expect(LIGNE_EXEMPLE.page).toEqual(attendu.ligne);
    expect(BULLE_EXEMPLE.page).toEqual(attendu.bulle);
    expect(SCENE_EXEMPLE.cadre).toEqual(attendu.cadres.cadre);
    expect(SCENE_EXEMPLE.bandeSousTitres).toEqual(attendu.cadres.bandeSousTitres);
  });
});
