/** T21 (page sombre) : plus de ronds décoratifs sans sens, et une variante qui change d'un carrousel à l'autre (choix déterministe). */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VARIANTES_T21, varianteT21 } from "@/briques/visuels/variante-t21";

const TITRES = ["Répondre plus vite aux demandes", "Ranger les dossiers du cabinet", "Préparer un devis sans stress", "Relancer sans gêner", "Trois réflexes pour vos devis", "Une semaine mieux rangée"];
const source = () => readFileSync("studio-rendu/compositions/visuels/pages/T21.tsx", "utf8");

describe("T21 : variante choisie par le carrousel", () => {
  it("déterministe : le même titre de couverture donne toujours la même variante", () => {
    for (const t of TITRES) expect(varianteT21(t)).toBe(varianteT21(t));
    // Casse, accents et espaces ne changent pas le choix.
    expect(varianteT21("  RÉPONDRE plus vite aux demandes ")).toBe(varianteT21("Repondre plus vite aux demandes"));
  });
  it("varie d'un carrousel à l'autre : toutes les variantes sont atteintes par quelques titres ordinaires", () => {
    expect(new Set(TITRES.map(varianteT21))).toEqual(new Set(VARIANTES_T21));
  });
  it("au moins trois variantes, dont une composition typographique sans dessin", () => {
    expect(VARIANTES_T21.length).toBeGreaterThanOrEqual(3);
    expect(VARIANTES_T21).toContain("typographie");
  });
  it("la page lit la variante du titre de couverture ; aucun rond plein posé hors d'une bulle", () => {
    const s = source();
    expect(s).toContain("varianteT21(");
    // Les trois points vivent DANS une bulle (tracé de la bulle juste avant) : jamais de gros ronds orange seuls.
    expect(s).not.toMatch(/<circle[^>]*fill=\{COULEURS\.orange\}/);
  });
  it("la composition reçoit le titre de couverture", () => {
    expect(readFileSync("studio-rendu/compositions/visuels/VisuelPage.tsx", "utf8")).toMatch(/<T21 [^>]*titreCouverture=/);
  });
});
