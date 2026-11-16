import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ASCENDANTE, DESCENDANTE, margeBasTexte } from "../../studio-rendu/compositions/visuels/commun/interligne-capitales";

/** Lit une table du fichier TrueType (répertoire des tables en tête de fichier). */
function table(buf: Buffer, nom: string): number {
  const n = buf.readUInt16BE(4);
  for (let i = 0; i < n; i++) {
    const o = 12 + i * 16;
    if (buf.toString("ascii", o, o + 4) === nom) return buf.readUInt32BE(o + 8);
  }
  throw new Error(`table ${nom} absente`);
}

describe("métriques verticales de Manrope", () => {
  const buf = readFileSync("studio-rendu/compositions/commune/polices/Manrope-Variable.ttf");
  const unites = buf.readUInt16BE(table(buf, "head") + 18);
  const hhea = table(buf, "hhea");
  it("les constantes égalent la table hhea de la police", () => {
    expect(unites).toBe(2000);
    expect(ASCENDANTE).toBe(buf.readInt16BE(hhea + 4) / unites);
    expect(DESCENDANTE).toBe(-buf.readInt16BE(hhea + 6) / unites);
  });
  it("marge sous la phrase en grand : 16 px à 116 px, interligne 1,1", () => {
    expect(margeBasTexte(116, 1.1)).toBe(16);
    expect(margeBasTexte(116, 5)).toBe(0);
  });
});
