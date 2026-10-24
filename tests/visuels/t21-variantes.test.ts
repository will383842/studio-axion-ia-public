/**
 * ART-1, tour 2 : dernière page (T21). La bulle à tache orange était peu lisible : bulle NETTE dessinée sur place (pleine orange, ou contour
 * crème avec trois points). Trois mises en page (bulle pleine, bulle à trois points, typographique : la phrase en grand, sans rond) choisies d'après le SUJET du
 * carrousel (titre de la couverture) : deux carrousels différents n'ont pas forcément la même dernière page ; le même carrousel, toujours la même.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { VARIANTES_T21, varianteFin } from "../../studio-rendu/compositions/visuels/pages/T21";

// Sans les dépendances de studio-rendu (CI ciblée des visuels), « remotion » est simulé : les composants se chargent quand même.
// Installé, le vrai module est chargé (son chemin résolu n'est pas « remotion »), le test reste le même.
vi.mock("remotion", () => ({ cancelRender: () => undefined, continueRender: () => undefined, delayRender: () => 0, AbsoluteFill: () => null }));

const lire = (f: string) => readFileSync(new URL(`../../studio-rendu/compositions/visuels/${f}`, import.meta.url), "utf8");
const spec = (titre: string) => ({ version: "carrousel/1" as const, alt: "Un carrousel", pages: [{ type: "T01" as const, titre }, { type: "T21" as const }] });

describe("T21 : variantes de la dernière page", () => {
  it("trois variantes ; le choix est stable pour un même carrousel", () => {
    expect(VARIANTES_T21).toEqual(["bulle-pleine", "bulle-points", "typographique"]);
    expect(varianteFin(spec("Relancer sans y penser"))).toBe(varianteFin(spec("Relancer sans y penser")));
  });
  it("des sujets différents se répartissent sur les trois variantes", () => {
    const vues = new Set(["Relancer sans y penser", "Vos factures en ordre", "Moins de réunions", "Un dossier client sans trou", "Le temps perdu en relances", "Cinq tâches à alléger"].map((t) => varianteFin(spec(t))));
    expect(vues.size).toBe(3);
  });
  it("la bulle est dessinée sur place, nette : plus d'icône « bulle » à tache orange ; trois points dans la bulle", () => {
    const src = lire("pages/T21.tsx");
    expect(src).not.toContain('<Picto nom="bulle"');
    expect(src).toContain("function Bulle(");
    expect(src).toMatch(/<Dessin nom="bulle"/);
    expect(src).toContain("TROIS_POINTS");
    expect(lire("VisuelPage.tsx")).toContain("varianteFin(spec)");
  });
});
