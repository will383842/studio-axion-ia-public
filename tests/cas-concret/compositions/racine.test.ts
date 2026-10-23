/**
 * Raccord R1b : `CasConcretEcran` est inscrite dans la racine du rendu par UNE ligne, après le tableau animé, sans
 * retirer aucune composition existante ; le module des compositions du format ne fait rien à son chargement, et sa
 * police se charge comme Montserrat (dans le composant, une seule fois, jamais hors d'un navigateur).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RENDU = join(process.cwd(), "studio-rendu/compositions");
const lire = (f: string) => readFileSync(join(RENDU, f), "utf8");
/** Code sans les commentaires (ils peuvent citer un appel). */
const sansCommentaires = (t: string) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Instructions de premier niveau d'un module (découpées aux lignes qui commencent en colonne 0). */
const instructionsDePremierNiveau = (t: string) =>
  sansCommentaires(t)
    .split(/\n(?=[^\s})\]])/)
    .map((s) => s.trim())
    .filter(Boolean);

describe("Racine.tsx", () => {
  const racine = sansCommentaires(lire("Racine.tsx"));

  it("garde les compositions communes et le tableau animé", () => {
    for (const c of ["<CompositionsMotion />", "<CompositionsEffets />", "<CompositionsTableau />"]) expect(racine).toContain(c);
  });

  it("inscrit les compositions du format une seule fois, juste après le tableau animé", () => {
    expect(racine).toContain('import { CompositionsCasConcret } from "./cas-concret/Compositions";');
    expect(racine.match(/<CompositionsCasConcret \/>/g)).toHaveLength(1);
    expect(racine).toMatch(/<CompositionsTableau \/>\s*<CompositionsCasConcret \/>/);
  });
});

describe("cas-concret/Compositions.tsx", () => {
  it("ne fait rien au chargement : seulement des imports, des constantes sans appel et des fonctions", () => {
    for (const s of instructionsDePremierNiveau(lire("cas-concret/Compositions.tsx"))) {
      if (/^import\s/.test(s) || /^export function\s/.test(s)) continue;
      // Constante : une fonction fléchée, ou une table gelée littérale.
      expect(s, s).toMatch(/^export const \w+ = (\([^)]*\)[^=]*=>|Object\.freeze\(\{[^()]*\}\);)/);
    }
  });

  it("la police du format se charge comme Montserrat : dans le composant, gardée, hors navigateur sans effet", () => {
    const polices = sansCommentaires(lire("commune/polices.ts"));
    const corps = (nom: string) => polices.match(new RegExp(`export function ${nom}\\(\\): void \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";
    const garde = (c: string) => c.match(/if \((\w+) \|\| typeof document === "undefined"\) return;/)?.[1];
    expect(garde(corps("chargerPoliceMontserrat"))).toBeTruthy();
    expect(garde(corps("chargerPoliceAnton"))).toBeTruthy();
    expect(corps("chargerPoliceAnton")).toMatch(/delayRender\([\s\S]*continueRender\(/);
    // Appelée dans le composant de l'écran, jamais au premier niveau d'un module du format.
    const ecran = sansCommentaires(lire("cas-concret/Ecran.tsx"));
    expect(ecran).toMatch(/export function Ecran\([^)]*\) \{\s*chargerPoliceAnton\(\);/);
    for (const f of ["cas-concret/Compositions.tsx", "cas-concret/Ecran.tsx"]) {
      for (const s of instructionsDePremierNiveau(lire(f)).filter((x) => !/^export function\s/.test(x))) expect(s, f).not.toMatch(/chargerPolice\w*\(\)/);
    }
  });
});
