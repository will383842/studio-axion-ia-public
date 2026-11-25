import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PILE_CSS } from "@/briques/charte/axion-2026";

/**
 * POLICES-P2-b : les petits objets demandent la PILE de la charte (avec repli « Manrope », déjà chargé par les hôtes),
 * pas le seul nom « Axion Manrope » : sinon le navigateur retombe sur Times. Lecture de TEXTE (pas de navigateur).
 * Exceptions fermées et nommées : le terminal (sa pile monospace) et les 5 objets en FAMILLE_CSS_AXION.
 */
const DOSSIER = join(process.cwd(), "src/briques/motion/petits-objets");
const EXCEPTIONS: Record<string, string> = {
  "terminal-commande.tsx": "FAMILLE_TERMINAL",
  "carton-definition.tsx": "FAMILLE_CSS_AXION",
  "carton-magazine.tsx": "FAMILLE_CSS_AXION",
  "post-it.tsx": "FAMILLE_CSS_AXION",
  "pellicule.tsx": "FAMILLE_CSS_AXION",
  "volet-avant-apres.tsx": "FAMILLE_CSS_AXION",
};
const fichiers = readdirSync(DOSSIER).filter((n) => n.endsWith(".tsx")).sort();

/** Expressions données à `fontFamily` (attribut JSX `fontFamily={…}` ou propriété de style `fontFamily: …`). */
const valeurs = (texte: string): string[] =>
  [...texte.matchAll(/fontFamily\s*(?:=\s*\{([^}]*)\}|:\s*([^,}\n]+))/g)].map((m) => (m[1] ?? m[2]).trim());

describe("POLICES-P2-b : les petits objets demandent PILE_CSS", () => {
  it("la pile de la charte garde son repli « Manrope »", () => {
    expect(PILE_CSS).toBe('"Axion Manrope", "Manrope", sans-serif');
  });
  for (const f of fichiers) {
    const lues = valeurs(readFileSync(join(DOSSIER, f), "utf8"));
    if (lues.length === 0) continue;
    it(`${f} : ${EXCEPTIONS[f] ? `exception ${EXCEPTIONS[f]}` : "PILE_CSS seulement"}`, () => {
      expect(new Set(lues)).toEqual(new Set([EXCEPTIONS[f] ?? "PILE_CSS"]));
    });
  }
  it("les 14 objets de la fiche sont couverts, et les exceptions sont toutes vues", () => {
    const pile = fichiers.filter((f) => valeurs(readFileSync(join(DOSSIER, f), "utf8")).includes("PILE_CSS"));
    expect(pile.length).toBeGreaterThanOrEqual(15); // 14 objets + fenetre-app (déjà en PILE_CSS)
    for (const f of Object.keys(EXCEPTIONS)) expect(fichiers).toContain(f);
  });
});
