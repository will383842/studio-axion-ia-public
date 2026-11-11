import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PALETTE } from "@/briques/charte/axion-2026";

// V7-08a : PageTableau n'emploie que les couleurs de la charte Axion 2026.
// Hors périmètre de ce lot (décision D1 de Williams, OUVERTE) : les fonctions
// `outil` (feutres) et `brosse`, laissées telles quelles ; les autres rgba du
// fichier restent au cliquet (tests/charte/compositions-restantes.json).
const FICHIER = "studio-rendu/compositions/tableau/trois-styles/PageTableau.tsx";
const AUTORISES = new Set(
  [PALETTE.ivoire, PALETTE.gris, PALETTE.noir, PALETTE.terracotta, PALETTE.orange, PALETTE.grisSurNoir, PALETTE.texteSecondaire, PALETTE.blanc].map((h) => h.toUpperCase()),
);

function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Retire une fonction de premier niveau (de `function nom(` à l'accolade fermante en colonne 0). */
function sansFonction(src: string, nom: string): string {
  const debut = src.indexOf(`\nfunction ${nom}(`);
  expect(debut, `fonction ${nom} introuvable`).toBeGreaterThanOrEqual(0);
  const fin = src.indexOf("\n}\n", debut);
  return src.slice(0, debut) + src.slice(fin + 2);
}

const source = readFileSync(FICHIER, "utf8");
const perimetre = sansFonction(sansFonction(sansCommentaires(source), "outil"), "brosse");

describe("palette V7-08a", () => {
  it("hors outil et brosse (D1), aucun hex hors palette", () => {
    const hors = [...new Set((perimetre.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? []).filter((h) => !AUTORISES.has(h.toUpperCase())))];
    expect(hors).toEqual([]);
  });

  it("chapitres futurs : texte secondaire sur clair, jamais le gris chaud (1,2:1)", () => {
    const ligne = perimetre.split("\n").find((l) => l.includes("sc.style === \"ardoise\" ?") && l.includes("strokeStyle"));
    expect(ligne).toBeDefined();
    expect(ligne).toContain(`"${PALETTE.texteSecondaire}"`);
    expect(ligne).toContain(`"${PALETTE.grisSurNoir}"`);
    expect(ligne).not.toContain(`"${PALETTE.gris}"`);
  });

  it("rgba(255,255,255,a) est le blanc de la palette (le reflet de la brosse en fait partie)", () => {
    const blancs = source.match(/rgba\(255,255,255,[0-9.]+\)/g) ?? [];
    expect(blancs).toContain("rgba(255,255,255,0.18)");
    expect(PALETTE.blanc).toBe("#FFFFFF");
  });
});
