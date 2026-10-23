import { describe, expect, it } from "vitest";
import {
  CHARTE_CARROUSEL,
  contrasteWcag,
  texteLisible,
} from "@/briques/visuels/charte-carrousel";

describe("charte-carrousel/1 : contrastes WCAG", () => {
  it("porte l'identifiant et les couleurs de base", () => {
    expect(CHARTE_CARROUSEL.id).toBe("charte-carrousel/1");
    expect(CHARTE_CARROUSEL.couleurs.creme).toBe("#F8F0E3");
    expect(CHARTE_CARROUSEL.couleurs.orange).toBe("#D9622B");
  });

  it("encre sur crème = 17,4 ± 0,1", () => {
    const { encre, creme } = CHARTE_CARROUSEL.couleurs;
    expect(Math.abs(contrasteWcag(encre, creme) - 17.4)).toBeLessThanOrEqual(0.1);
  });

  it("refuse #D9622B en texte de 30 px (texte normal)", () => {
    const { orange, creme } = CHARTE_CARROUSEL.couleurs;
    expect(texteLisible(orange, creme, 30)).toBe(false);
  });

  it("accepte l'orange pour un GRAND élément", () => {
    const { orange, creme } = CHARTE_CARROUSEL.couleurs;
    expect(texteLisible(orange, creme, 72)).toBe(true);
  });

  it("refuse #B44F29 sur pale", () => {
    const { pale, orangeFonce } = CHARTE_CARROUSEL.couleurs;
    expect(texteLisible(orangeFonce, pale, 30)).toBe(false);
  });

  it("l'encre est lisible partout, y compris en petit", () => {
    const { encre, creme, pale } = CHARTE_CARROUSEL.couleurs;
    expect(texteLisible(encre, creme, 16)).toBe(true);
    expect(texteLisible(encre, pale, 16)).toBe(true);
  });

  it("rejette une couleur mal formée", () => {
    expect(() => contrasteWcag("rouge", "#FFFFFF")).toThrow();
  });

  it("pages M3a : encre sur orange (T08, T01C, T10), crème sur encre (T21) et orange sur encre (grand titre T21)", () => {
    const { encre, orange, creme } = CHARTE_CARROUSEL.couleurs;
    expect(texteLisible(encre, orange, 30)).toBe(true); // étiquette crème sur encre ci-dessous ; texte encre sur orange à partir de 30 px
    expect(texteLisible(encre, orange, 40)).toBe(true);
    expect(texteLisible(creme, encre, 30)).toBe(true);
    expect(texteLisible(orange, encre, 90)).toBe(true); // dernière ligne du titre de la page sombre : grand élément
    expect(texteLisible(orange, encre, 30)).toBe(true); // et même en petit : 5,4:1
  });
});

describe("charte-carrousel/1 : blanc des cartes (L1)", () => {
  it("l'encre est lisible en petit sur le blanc chaud des cartes impaires", () => {
    const { encre, blanc } = CHARTE_CARROUSEL.couleurs;
    expect(texteLisible(encre, blanc, 26)).toBe(true);
    expect(contrasteWcag(encre, blanc)).toBeGreaterThan(17.4);
  });
});
