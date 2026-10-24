/** T21 (page sombre) : plus de ronds décoratifs sans sens, et une variante qui change d'un carrousel à l'autre (choix déterministe). */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { couperPhrase } from "@/briques/visuels/variante-t21";
import { VARIANTES_T21, varianteFin } from "../../studio-rendu/compositions/visuels/pages/T21";

// Sans les dépendances de studio-rendu (CI ciblée des visuels), « remotion » est simulé : les composants se chargent quand même.
// Installé, le vrai module est chargé (son chemin résolu n'est pas « remotion »), le test reste le même.
vi.mock("remotion", () => ({ cancelRender: () => undefined, continueRender: () => undefined, delayRender: () => 0, AbsoluteFill: () => null }));

const TITRES = ["Répondre plus vite aux demandes", "Ranger les dossiers du cabinet", "Préparer un devis sans stress", "Relancer sans gêner", "Trois réflexes pour vos devis", "Une semaine mieux rangée"];
/** Chaque `style={{ … }}` jusqu'à l'accolade qui l'équilibre (les `${…}` des gabarits ne le coupent pas). */
const stylesEnLigne = (texte: string) => {
  const styles: string[] = [];
  for (const m of texte.matchAll(/style=\{\{/g)) {
    const debut = m.index + "style=".length;
    let profondeur = 0;
    for (let i = debut; i < texte.length; i++) {
      if (texte[i] === "{") profondeur++;
      else if (texte[i] === "}" && --profondeur === 0) {
        styles.push(texte.slice(m.index, i + 1));
        break;
      }
    }
  }
  return styles;
};
/** Styles en ligne qui dessinent un rond plein orange : `borderRadius: "50%"` (ou 999…) et fond orange dans le même objet. */
const rondsOrange = (texte: string) =>
  stylesEnLigne(texte).filter((st) => /borderRadius:\s*(?:["']50%["']|9{3,})/.test(st) && /background(?:Color)?:\s*COULEURS\.orange/.test(st));
const source = () => readFileSync("studio-rendu/compositions/visuels/pages/T21.tsx", "utf8");
const varianteT21 = (titre: string) => varianteFin({ version: "carrousel/1", alt: "Essai", pages: [{ type: "T01", titre }, { type: "T21" }] });

describe("T21 : variante choisie par le carrousel", () => {
  it("déterministe : le même titre de couverture donne toujours la même variante", () => {
    for (const t of TITRES) expect(varianteT21(t)).toBe(varianteT21(t));
  });
  it("varie d'un carrousel à l'autre : toutes les variantes sont atteintes par quelques titres ordinaires", () => {
    expect(new Set(TITRES.map(varianteT21))).toEqual(new Set(VARIANTES_T21));
  });
  it("au moins trois variantes, dont une composition typographique sans dessin", () => {
    expect(VARIANTES_T21.length).toBeGreaterThanOrEqual(3);
    expect(VARIANTES_T21).toContain("typographique");
    expect(source()).toMatch(/typographique \? \(\s*<PhraseEnGrand \/>/);
  });
  it("la page lit la variante du titre de couverture ; aucun rond plein posé hors d'une bulle", () => {
    const s = source();
    expect(s).toContain("export function varianteFin(");
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
  it("le contrôle lit tout l'objet de style, gabarits `${…}` compris, et les variantes `backgroundColor` / `borderRadius: 999`", () => {
    expect(rondsOrange("<div style={{ border: `4px solid ${COULEURS.creme}`, borderRadius: 999, backgroundColor: COULEURS.orange }} />")).toHaveLength(1);
    expect(rondsOrange("<div style={{ outline: `${ep}px solid ${COULEURS.creme}`, background: COULEURS.orange, borderRadius: '50%' }} />")).toHaveLength(1);
    expect(rondsOrange("<div style={{ border: `4px solid ${COULEURS.orange}`, borderRadius: 12, background: COULEURS.creme }} />")).toEqual([]);
  });
  it("la composition passe la variante choisie d'après le carrousel (titre de couverture)", () => {
    expect(readFileSync("studio-rendu/compositions/visuels/VisuelPage.tsx", "utf8")).toMatch(/<T21 [^>]*variante=\{varianteFin\(spec\)\}/);
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
