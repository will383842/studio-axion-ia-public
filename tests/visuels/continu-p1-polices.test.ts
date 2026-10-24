import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DOSSIER = new URL("../../studio-rendu/compositions/commune/polices/", import.meta.url);
const FICHIERS = [
  { fichier: "BricolageGrotesque-Variable.ttf", licence: "OFL-BricolageGrotesque.txt" },
  { fichier: "InstrumentSerif-Regular.ttf", licence: "OFL-InstrumentSerif.txt" },
  { fichier: "InstrumentSerif-Italic.ttf", licence: "OFL-InstrumentSerif.txt" },
] as const;

function codesCmap(b: Buffer): Set<number> {
  const n = b.readUInt16BE(4);
  let off = -1;
  for (let i = 0; i < n; i++) {
    const o = 12 + i * 16;
    if (b.toString("ascii", o, o + 4) === "cmap") off = b.readUInt32BE(o + 8);
  }
  const codes = new Set<number>();
  if (off < 0) return codes;
  const nbTables = b.readUInt16BE(off + 2);
  for (let i = 0; i < nbTables; i++) {
    const so = off + b.readUInt32BE(off + 4 + i * 8 + 4);
    const format = b.readUInt16BE(so);
    if (format === 4) {
      const segments = b.readUInt16BE(so + 6) / 2;
      const fins = so + 14;
      const debuts = fins + segments * 2 + 2;
      for (let k = 0; k < segments; k++) {
        const fin = b.readUInt16BE(fins + k * 2);
        for (let c = b.readUInt16BE(debuts + k * 2); c <= fin && c < 0xffff; c++) codes.add(c);
      }
    } else if (format === 12) {
      const groupes = b.readUInt32BE(so + 12);
      for (let k = 0; k < groupes; k++) {
        const g = so + 16 + k * 12;
        for (let c = b.readUInt32BE(g); c <= b.readUInt32BE(g + 4); c++) codes.add(c);
      }
    }
  }
  return codes;
}

describe("continu P1 : polices", () => {
  it.each(FICHIERS)("$fichier et sa licence existent", ({ fichier, licence }) => {
    expect(existsSync(new URL(fichier, DOSSIER))).toBe(true);
    const texte = readFileSync(new URL(licence, DOSSIER), "utf8");
    expect(texte).toContain("SIL OPEN FONT LICENSE Version 1.1");
  });
  it.each(FICHIERS)("$fichier couvre A-Z, a-z et les glyphes français", ({ fichier }) => {
    const codes = codesCmap(readFileSync(new URL(fichier, DOSSIER)));
    for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzéèêàçùœ’«»") expect(codes.has(c.codePointAt(0)!), c).toBe(true);
    if (!codes.has(0x202f)) console.log(`${fichier} : U+202F absent, P2 ajoutera la face de repli`);
  });
});
