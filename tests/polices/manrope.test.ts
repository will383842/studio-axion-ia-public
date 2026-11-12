import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIERS = ["studio-rendu/compositions/commune/polices", "src/briques/sous-titres/polices"];
const racine = process.cwd();

/** Lit les étiquettes de la table des polices (TTF) pour vérifier la présence de l'axe variable `wght`. */
function etiquettesTables(tampon: Buffer): string[] {
  const n = tampon.readUInt16BE(4);
  return Array.from({ length: n }, (_, i) => tampon.toString("ascii", 12 + i * 16, 16 + i * 16));
}

describe("V7-05 : Manrope variable + licence OFL", () => {
  for (const dossier of DOSSIERS) {
    it(`${dossier} : TTF variable valide et licence OFL`, () => {
      const ttf = join(racine, dossier, "Manrope-Variable.ttf");
      expect(existsSync(ttf)).toBe(true);
      const tampon = readFileSync(ttf);
      expect(tampon.readUInt32BE(0)).toBe(0x00010000);
      expect(etiquettesTables(tampon)).toContain("fvar");
      // table « name » en UTF-16 gros-boutiste
      expect(tampon.includes(Buffer.from("Manrope", "utf16le").swap16())).toBe(true);
      const licence = join(racine, dossier, "OFL-Manrope.txt");
      expect(existsSync(licence)).toBe(true);
      const texte = readFileSync(licence, "utf8");
      expect(texte).toContain("SIL OPEN FONT LICENSE Version 1.1");
      expect(texte).toContain("Manrope Project Authors");
    });
  }

  it("le rendu des visuels charge Manrope en local (famille dédiée)", () => {
    const source = readFileSync(join(racine, "studio-rendu/compositions/visuels/police-manrope.ts"), "utf8");
    expect(source).toContain("FAMILLE_MANROPE");
    expect(source).toContain("Manrope-Variable.ttf");
  });
});
