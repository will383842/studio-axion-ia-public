/**
 * POLICES-P7-f-v20l : la face caméra v4 (`motion-v4/**`) en Manrope, par le chargeur UNIQUE de la police de marque.
 * Lecture du texte des sources seulement (aucun import de `studio-rendu/**` : piège TS2307 « remotion »).
 * Commentaires retirés avant contrôle ; les noms d'aides (`styleMontserrat`, `MONTSERRAT`) restent permis (renommage = autre fiche).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FAMILLE_CSS, PILE_CSS } from "../../src/briques/charte/axion-2026";

const V4 = "studio-rendu/compositions/interface-claire/motion-v4";
const lister = (d: string): string[] =>
  readdirSync(d).flatMap((n) => {
    const c = join(d, n);
    return statSync(c).isDirectory() ? lister(c) : /\.tsx?$/.test(n) ? [c] : [];
  });
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const sources = lister(V4).map((f) => ({ f, s: sansCommentaires(readFileSync(f, "utf8")) }));
const chaines = (s: string) => s.match(/(["'`])(?:(?!\1)[^\n\\]|\\.)*\1/g) ?? [];

describe("POLICES-P7-f · face caméra v4 en Manrope", () => {
  it("(a) aucune famille hors charte écrite en clair sous motion-v4/** (Montserrat, Inter, Anton, Arial Black)", () => {
    expect(sources.length).toBeGreaterThan(50);
    const fautes = sources.flatMap(({ f, s }) => chaines(s).filter((c) => /Montserrat|\bInter\b|Anton|Arial Black/.test(c)).map((c) => `${f} ${c}`));
    expect(fautes).toEqual([]);
  });

  it("(b) aucune graisse 900 (hors de l'axe 200-800 de Manrope) hors commentaire", () => {
    const fautes = sources.flatMap(({ f, s }) => s.split("\n").filter((l) => /fontWeight\s*:\s*["']?900\b|weight\s*:\s*["']9\d\d|font\s*=\s*`900\b/.test(l)).map((l) => `${f} ${l.trim()}`));
    expect(fautes).toEqual([]);
  });

  it("(c) aucun fichier de police v4 chargé : ni .ttf ni .woff2 importé ou demandé hors lot6 (déjà Manrope)", () => {
    const fautes = sources.filter(({ f }) => !f.includes("/lot6/")).flatMap(({ f, s }) => chaines(s).filter((c) => /\.(ttf|woff2?)\b/.test(c)).map((c) => `${f} ${c}`));
    expect(fautes).toEqual([]);
  });

  it("(d) les chargeurs v4 (briques, lots 1 à 4) passent par commune/police-marque et nomment la famille de la charte", () => {
    const attendus: Record<string, RegExp> = {
      "communs/briques-v4.tsx": /export const MONTSERRAT = "Axion Manrope";[\s\S]*policeChargee = policeMarquePrete\(\)/,
      "lot1/commun-lot1.tsx": /export const MONTSERRAT = "Axion Manrope";[\s\S]*chargement = policeMarquePrete\(\)/,
      "lot2/commun-lot2.tsx": /export const MONTSERRAT = "Axion Manrope";[\s\S]*export function chargerPolicesV4\(\): void \{\s*chargerPoliceMarque\(\);/,
      "lot3/commun-lot3.tsx": /export const MONTSERRAT = '"Axion Manrope", "Manrope", sans-serif';[\s\S]*policeMarquePrete\(\)\.then/,
      "lot4/commun-lot4.tsx": /export const MONTSERRAT = "Axion Manrope";[\s\S]*export function chargerMontserratBlack\(\): void \{\s*chargerPoliceMarque\(\);/,
    };
    for (const [f, motif] of Object.entries(attendus)) {
      const s = sansCommentaires(readFileSync(`${V4}/${f}`, "utf8"));
      expect(s, f).toMatch(motif);
      expect(s, f).toMatch(/from "\.\.\/\.\.\/\.\.\/commune\/police-marque";/);
      expect(s, f).not.toMatch(/new FontFace\(/);
    }
  });

  it("(e) les noms écrits en clair (les plaquettes n'importent aucune valeur de src/, garde lot-i) = FAMILLE_CSS / PILE_CSS de la charte = chargeur unique", () => {
    expect(FAMILLE_CSS).toBe("Axion Manrope");
    expect(PILE_CSS).toBe('"Axion Manrope", "Manrope", sans-serif');
    expect(readFileSync("studio-rendu/compositions/commune/police-marque.ts", "utf8")).toContain('new FontFace("Axion Manrope"');
  });
});
