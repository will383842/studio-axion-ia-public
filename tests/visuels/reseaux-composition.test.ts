/**
 * H2 · composition par réseau : la clé `cadre` (linkedin | meta) traverse la validation des propriétés, les couvertures reçoivent les
 * retraits du cadre, la flèche du pied disparaît pour LinkedIn, et la mesure compte les textes posés dans une zone interdite du cadre.
 * Sans cadre, rien ne change (mêmes propriétés validées : même rendu, même empreinte).
 */
import { describe, expect, it } from "vitest";
import { validerProprietesPage } from "@/visuels/proprietes-page";
import { compterIntrusions, flecheVisible, retraitPage, TOLERANCE_PX } from "../../studio-rendu/compositions/visuels/commun/cadre";
import { CONTENU_ESSAI } from "../../studio-rendu/scripts/contenu-essai-visuel";

describe("H2 · cadre dans les propriétés de VisuelPage", () => {
  it("accepte linkedin et meta, et les rend tels quels", () => {
    expect(validerProprietesPage({ spec: CONTENU_ESSAI, index: 0, cadre: "linkedin" }).cadre).toBe("linkedin");
    expect(validerProprietesPage({ spec: CONTENU_ESSAI, index: 1, cadre: "meta" }).cadre).toBe("meta");
  });
  it("refuse toute autre valeur (un réseau n'est pas un cadre)", () => {
    for (const cadre of ["instagram", "facebook", "", 1, null]) {
      expect(() => validerProprietesPage({ spec: CONTENU_ESSAI, index: 0, cadre })).toThrow(/cadre/);
    }
  });
  it("sans cadre : aucune clé `cadre` dans les propriétés validées (mêmes propriétés qu'avant)", () => {
    expect(Object.keys(validerProprietesPage({ spec: CONTENU_ESSAI, index: 0 }))).toEqual(["spec", "index"]);
    expect(Object.keys(validerProprietesPage({ spec: CONTENU_ESSAI, index: 0, cadre: undefined }))).toEqual(["spec", "index"]);
  });
});

describe("H2 · retraits des couvertures et flèche du pied", () => {
  it("sans cadre : la marge habituelle (64 px) en haut et en bas", () => {
    expect(retraitPage(undefined)).toEqual({ haut: 64, bas: 64 });
  });
  it("avec un cadre : 170 px en haut, 135 px en bas", () => {
    expect(retraitPage("linkedin")).toEqual({ haut: 170, bas: 135 });
    expect(retraitPage("meta")).toEqual({ haut: 170, bas: 135 });
  });
  it("LinkedIn : jamais de flèche de défilement (sa propre flèche la recouvre) ; ailleurs, sauf sur la dernière page", () => {
    expect(flecheVisible(0, 3, "linkedin")).toBe(false);
    expect(flecheVisible(1, 3, "linkedin")).toBe(false);
    expect(flecheVisible(0, 3, "meta")).toBe(true);
    expect(flecheVisible(0, 3, undefined)).toBe(true);
    expect(flecheVisible(2, 3, undefined)).toBe(false);
  });
});

describe("H2 · intrusions (texte dans une zone interdite du cadre)", () => {
  const ligneEnHaut = { gauche: 64, haut: 60, droite: 600, bas: 120 };
  it("une ligne de texte à y = 60 sur la couverture LinkedIn entre dans la pastille du titre", () => {
    expect(compterIntrusions([ligneEnHaut], "linkedin", 0)).toEqual({ total: 1, parZone: { pastilleTitre: 1 } });
  });
  it("la même ligne sur une page intérieure LinkedIn ou Meta : aucune zone en haut", () => {
    expect(compterIntrusions([ligneEnHaut], "linkedin", 1).total).toBe(0);
    expect(compterIntrusions([ligneEnHaut], "meta", 1).total).toBe(0);
  });
  it("couverture Meta : la bande carrée de Facebook (haut) et la grille d'Instagram (bords) comptent", () => {
    const r = compterIntrusions([ligneEnHaut, { gauche: 20, haut: 400, droite: 300, bas: 450 }], "meta", 0);
    expect(r.total).toBe(2);
    expect(r.parZone).toEqual({ carreFacebookHaut: 1, grilleGauche: 1 });
  });
  it("un bord qui touche la zone ne compte pas ; sans cadre, rien ne compte", () => {
    expect(compterIntrusions([{ gauche: 64, haut: 170, droite: 600, bas: 260 }], "linkedin", 0).total).toBe(0);
    expect(compterIntrusions([ligneEnHaut], undefined, 0)).toEqual({ total: 0, parZone: {} });
  });
  it("tolérance de 1 px (TOLERANCE_PX de la mesure) : une ligne qui mord d'une fraction de pixel ne compte pas, au-delà oui", () => {
    expect(TOLERANCE_PX).toBe(1);
    expect(compterIntrusions([{ gauche: 64, haut: 169.6, droite: 600, bas: 260 }], "linkedin", 0).total).toBe(0);
    expect(compterIntrusions([{ gauche: 64, haut: 1100, droite: 600, bas: 1215.4 }], "meta", 0).total).toBe(0);
    expect(compterIntrusions([{ gauche: 64, haut: 168, droite: 600, bas: 260 }], "linkedin", 0).total).toBe(1);
    expect(compterIntrusions([{ gauche: 64, haut: 1100, droite: 600, bas: 1217 }], "meta", 0).parZone).toEqual({ carreFacebookBas: 1 });
  });
});
