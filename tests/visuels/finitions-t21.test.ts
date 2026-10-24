/** T21 (page sombre) : plus de ronds décoratifs sans sens, et une variante qui change d'un carrousel à l'autre (choix déterministe). */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { couperPhrase, VARIANTES_T21, varianteT21 } from "@/briques/visuels/variante-t21";

const TITRES = ["Répondre plus vite aux demandes", "Ranger les dossiers du cabinet", "Préparer un devis sans stress", "Relancer sans gêner", "Trois réflexes pour vos devis", "Une semaine mieux rangée"];
/** Styles en ligne qui dessinent un rond plein orange : `borderRadius: "50%"` et fond orange dans le même objet. */
const rondsOrange = (texte: string) => (texte.match(/style=\{\{[^}]*\}\}/g) ?? []).filter((st) => /borderRadius:\s*"50%"/.test(st) && /background:\s*COULEURS\.orange/.test(st));
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
    // Ni de div arrondies sur fond orange (le défaut d'origine).
    expect(rondsOrange(s)).toEqual([]);
  });
  it("le contrôle des ronds orange attrape le défaut d'origine (div `borderRadius: \"50%\"` sur fond orange), dans les deux ordres", () => {
    expect(rondsOrange('<div key={x} style={{ width: 220, height: 220, borderRadius: "50%", background: COULEURS.orange }} />')).toHaveLength(1);
    expect(rondsOrange('<div style={{ background: COULEURS.orange, borderRadius: "50%" }} />')).toHaveLength(1);
    expect(rondsOrange('<div style={{ borderRadius: 999, border: "2px solid", background: COULEURS.creme }} />')).toEqual([]);
  });
  it("la composition reçoit le titre de couverture", () => {
    expect(readFileSync("studio-rendu/compositions/visuels/VisuelPage.tsx", "utf8")).toMatch(/<T21 [^>]*titreCouverture=/);
  });
});

describe("T21 : phrase en grand, accent orange avec ou sans « : »", () => {
  it("avec « : » : la fin est ce qui suit les deux-points", () => {
    expect(couperPhrase("Une question, une idée : écrivez-nous.")).toEqual({ debut: "Une question, une idée :", fin: "écrivez-nous." });
  });
  it("sans « : » : le dernier groupe de mots est en orange, jamais une fin vide", () => {
    expect(couperPhrase("Un message privé suffit pour en parler ensemble")).toEqual({ debut: "Un message privé suffit pour", fin: "en parler ensemble" });
    expect(couperPhrase("Écrivez-nous")).toEqual({ debut: "", fin: "Écrivez-nous" });
    for (const p of ["Deux mots", "Une phrase sans deux-points du tout", "  espaces   en  trop  "]) {
      const { debut, fin } = couperPhrase(p);
      expect(fin.length).toBeGreaterThan(0);
      expect(`${debut} ${fin}`.trim()).toBe(p.trim().replace(/\s+/g, " "));
    }
  });
  it("la page passe par `couperPhrase` (plus de découpe locale qui laisserait la fin vide)", () => {
    expect(source()).toContain("couperPhrase(TEXTES_FIXES.t21Ligne)");
    expect(source()).not.toMatch(/t21Ligne\.split\(/);
  });
});
