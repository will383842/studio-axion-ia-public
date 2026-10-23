import { describe, expect, it } from "vitest";
import { validerProprietesPage } from "@/visuels/proprietes-page";
import type { CarrouselSpecType } from "@/domaine/visuels/types";
import { pageDuSpec } from "../../studio-rendu/compositions/visuels/commun/page";
import type { SpecVisuel } from "../../studio-rendu/compositions/visuels/commun/types";
import { CONTENU_ESSAI } from "../../studio-rendu/scripts/contenu-essai-visuel";

const carte = { titre: "Trier le courrier", corps: "Chaque pli trouve sa place.", mini: "W02" };
const valide = {
  spec: {
    version: "carrousel/1",
    alt: "Exemple de carrousel",
    pages: [
      { type: "T01", titre: "Un titre", sousTitre: "Un sous-titre" },
      { type: "T02", titre: "Une page", cartes: [carte, carte] },
    ],
  },
  index: 1,
};

describe("composition VisuelPage : le texte vient d'un CarrouselSpec valide", () => {
  it("accepte un spec valide et renvoie la page demandée", () => {
    const p = validerProprietesPage(valide);
    expect(p.index).toBe(1);
    expect(pageDuSpec(p.spec, p.index).type).toBe("T02");
  });

  it.each([
    ["clé libre", { ...valide, spec: { ...valide.spec, couleur: "#fff" } }],
    ["type de page inconnu", { ...valide, spec: { ...valide.spec, pages: [{ type: "T01", titre: "Un titre" }, { type: "T99", titre: "X" }] } }],
    ["adresse dans un texte", { ...valide, spec: { ...valide.spec, pages: [{ type: "T01", titre: "Un titre" }, { type: "T02", titre: "https://exemple.org", cartes: [carte, carte] }] } }],
    ["mini inconnu", { ...valide, spec: { ...valide.spec, pages: [{ type: "T01", titre: "Un titre" }, { type: "T02", titre: "X", cartes: [{ ...carte, mini: "W99" }, carte] }] } }],
    ["version inconnue", { ...valide, spec: { ...valide.spec, version: "carrousel/9" } }],
    ["index hors des pages", { ...valide, index: 2 }],
    ["index négatif", { ...valide, index: -1 }],
    ["index non entier", { ...valide, index: 0.5 }],
    ["spec absent", { index: 0 }],
    ["rien du tout", null],
  ])("refuse : %s", (_nom, brut) => {
    expect(() => validerProprietesPage(brut)).toThrow();
  });

  it("la garde de la composition refuse un index hors des pages", () => {
    expect(() => pageDuSpec(valide.spec as SpecVisuel, 5)).toThrow();
    expect(() => pageDuSpec(valide.spec as SpecVisuel, -1)).toThrow();
  });

  it("le type local de la composition est compatible avec le type du schéma", () => {
    const verif = (s: CarrouselSpecType): SpecVisuel => s;
    expect(typeof verif).toBe("function");
  });

  it("le contenu figé de l'essai passe le schéma, sans chiffre ni adresse", () => {
    const p = validerProprietesPage({ spec: CONTENU_ESSAI, index: 0 });
    expect(p.spec.pages.map((x) => x.type)).toEqual(["T01", "T02"]);
    const t02 = p.spec.pages[1];
    expect(t02.type === "T02" && t02.cartes.length).toBeGreaterThanOrEqual(4);
    expect(t02.type === "T02" && t02.cartes.length).toBeLessThanOrEqual(6);
    const textes = JSON.stringify(CONTENU_ESSAI, (cle, v) => (cle === "mini" || cle === "version" || cle === "type" ? undefined : v));
    expect(textes).not.toMatch(/\d/);
  });
});
