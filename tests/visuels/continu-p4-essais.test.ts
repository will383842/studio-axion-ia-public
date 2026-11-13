import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GABARITS } from "../../src/briques/visuels/continu/registre-gabarits";
import { noterToile, SEUIL_RETOUCHE } from "../../src/domaine/controles-visuel/note-continu";

/** Toiles d'essai rendues par P2 (`studio-rendu/scripts/essai-toile.ts`) : mêmes types, textes du registre. */
const TYPES: Record<string, string[]> = {
  "toile-10p-4x5": ["X00", "X01", "X03", "PX1", "PX2", "PX3", "X04", "X05", "X06", "X02"],
  "toile-4p-4x5": ["X00", "X01", "X03", "X02"],
  "toile-6p-4x5": ["X00", "X01", "PX1", "PX2", "PX3", "X02"],
  "toile-4p-3x4": ["X00", "X01", "X03", "X02"],
  "toile-5p-3x4-parcours": ["X00", "PX1", "PX2", "PX3", "X02"],
};
const MESURES = JSON.parse(readFileSync("studio-rendu/essais-visuels/continu/p2/mesures.json", "utf8")) as Record<string, { format: string; mesures: Record<string, number> }>;
const exemple = (type: string) => ({ ...GABARITS.find((g) => g.type === type)!.exemple });

describe("continu P4 : notes des toiles d'essai de P2 (mesures.json)", () => {
  for (const [nom, types] of Object.entries(TYPES)) {
    it(nom, () => {
      const essai = MESURES[nom];
      const toile = { version: "toile/1", format: essai.format, pages: types.map(exemple), raccords: [] };
      const note = noterToile(toile, essai.mesures);
      // Les gabarits d'essai sont éteints : la porte est rouge, la note est bloquée et plafonnée.
      expect(note.bloquants.some((b) => /Charte/.test(b))).toBe(true);
      expect(note.total).toBeLessThan(SEUIL_RETOUCHE);
      // Le rendu de P2 passe les critères éliminatoires mesurés (couture, 26 px).
      expect(note.criteres.find((c) => c.id === 2)!.points).toBe(12);
      expect(note.criteres.find((c) => c.id === 3)!.points).toBe(12);
      console.log(`${nom} | ${note.criteres.map((c) => `${c.id}:${c.points}/${c.max}`).join(" ")} | total ${note.total}`);
    });
  }
});
