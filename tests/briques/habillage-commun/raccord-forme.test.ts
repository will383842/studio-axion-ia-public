import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CHARTE_AXION } from "@/briques/jetons-motion";
import {
  FORMES_RACCORD,
  choisirRaccordForme,
  type FormeRaccord,
} from "@/briques/motion/habillage-commun/raccord-forme";

const RACINE = join(__dirname, "../../..");
const PURE = readFileSync(join(RACINE, "src/briques/motion/habillage-commun/raccord-forme.ts"), "utf8");
const COMPO_CHEMIN = join(RACINE, "studio-rendu/compositions/commune/habillage/RaccordForme.tsx");
const BOITE = { largeur: 800, hauteur: 450 };
const ENTREE = (de: FormeRaccord, vers: FormeRaccord) => ({ de, vers, avecVisage: false, boite: BOITE });

describe("raccord par forme (X1-06)", () => {
  it("3 formes : cercle, carre, carte", () => {
    expect([...FORMES_RACCORD]).toEqual(["cercle", "carre", "carte"]);
  });

  it("paires compatibles : cercle↔cercle, carré↔carte (les deux sens)", () => {
    expect(choisirRaccordForme(ENTREE("cercle", "cercle"))).not.toBeNull();
    expect(choisirRaccordForme(ENTREE("carre", "carte"))).not.toBeNull();
    expect(choisirRaccordForme(ENTREE("carte", "carre"))).not.toBeNull();
  });

  it("sans paire compatible → null", () => {
    expect(choisirRaccordForme(ENTREE("cercle", "carre"))).toBeNull();
    expect(choisirRaccordForme(ENTREE("carte", "cercle"))).toBeNull();
    expect(choisirRaccordForme(ENTREE("carre", "carre"))).toBeNull();
    expect(choisirRaccordForme({ ...ENTREE("cercle", "cercle"), de: "triangle" as FormeRaccord })).toBeNull();
  });

  it("jamais sur un plan avec visage", () => {
    expect(choisirRaccordForme({ ...ENTREE("cercle", "cercle"), avecVisage: true })).toBeNull();
    expect(choisirRaccordForme({ ...ENTREE("carre", "carte"), avecVisage: true })).toBeNull();
  });

  it("couleurs de la charte seulement", () => {
    const valeurs = Object.values(CHARTE_AXION) as string[];
    const r = choisirRaccordForme(ENTREE("cercle", "cercle"))!;
    expect(valeurs).toContain(r.couleur);
    const r2 = choisirRaccordForme({ ...ENTREE("carre", "carte"), couleur: "noir" })!;
    expect(r2.couleur).toBe(CHARTE_AXION.noir);
    expect(choisirRaccordForme({ ...ENTREE("carre", "carte"), couleur: "bleu" as never })).toBeNull();
    expect(PURE).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(|gradient/);
  });

  it("même entrée = même chemin ; chemins de même structure (morphose possible)", () => {
    const a = choisirRaccordForme(ENTREE("carre", "carte"))!;
    const b = choisirRaccordForme(ENTREE("carre", "carte"))!;
    expect(a).toEqual(b);
    const commandes = (d: string) => d.replace(/[-\d.\s,]+/g, "");
    expect(commandes(a.cheminDe)).toBe(commandes(a.cheminVers));
    expect(a.cheminDe).not.toBe(a.cheminVers);
    const c = choisirRaccordForme(ENTREE("cercle", "cercle"))!;
    expect(c.cheminDe).toBe(c.cheminVers);
    expect(a.cheminDe).toMatch(/^M [\d. -]+ C .* Z$/);
    expect(a.cheminDe).not.toMatch(/NaN/);
  });

  it("source pure : aucun hasard, aucune horloge, aucun alias, aucun cubic-bezier", () => {
    expect(PURE).not.toMatch(/Math\.random|Date\.now|performance\.now|cubic-bezier/);
    expect(PURE).not.toMatch(/from\s+["']@\//);
  });

  it("éteint = identique : rien n'importe ces fichiers, absent de Compositions.tsx", () => {
    const compositions = readFileSync(join(RACINE, "studio-rendu/compositions/commune/habillage/Compositions.tsx"), "utf8");
    expect(compositions).not.toMatch(/RaccordForme|raccord-forme/);
    const index = readFileSync(join(RACINE, "src/briques/motion/habillage-commun/index.ts"), "utf8");
    expect(index).not.toMatch(/raccord-forme/);
  });

  it("composition : morphose par interpolatePath, imports relatifs, sans hasard ni couleur libre", () => {
    expect(existsSync(COMPO_CHEMIN)).toBe(true);
    const src = readFileSync(COMPO_CHEMIN, "utf8");
    expect(src).toMatch(/import\s*\{[^}]*interpolatePath[^}]*\}\s*from\s*["']@remotion\/paths["']/);
    expect(src).not.toMatch(/from\s+["']@\//);
    expect(src).not.toMatch(/Math\.random|Date\.now|cubic-bezier|#[0-9a-fA-F]{3,8}\b|gradient/);
    expect(src).toMatch(/avecVisage/);
  });
});
