// La liste des échecs tolérés reste lisible : chaque ligne nomme un fichier de test existant, un nom de test et une note.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const liste = JSON.parse(readFileSync("scripts/echecs-connus.json", "utf8")) as { version: number; echecs: { fichier: string; nom: string; note: string }[] };

describe("scripts/echecs-connus.json : forme de la liste", () => {
  it("chaque échec connu a un fichier de test qui existe, un nom et une note", () => {
    expect(liste.version).toBe(1);
    for (const e of liste.echecs) {
      expect(existsSync(e.fichier), e.fichier).toBe(true);
      expect(e.nom.trim().length, e.fichier).toBeGreaterThan(0);
      expect(e.note.trim().length, e.fichier).toBeGreaterThan(0);
    }
  });

  it("aucun doublon (même fichier et même nom)", () => {
    const cles = liste.echecs.map((e) => `${e.fichier} › ${e.nom}`);
    expect(new Set(cles).size).toBe(cles.length);
  });
});
