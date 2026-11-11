import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DOSSIER_POLICES = new URL("../../studio-rendu/compositions/commune/polices/", import.meta.url);
const SOURCE = new URL("../../studio-rendu/compositions/visuels/polices.ts", import.meta.url);
const SOURCE_MANROPE = new URL("../../studio-rendu/compositions/visuels/police-manrope.ts", import.meta.url);

const POLICES = [{ fichier: "Manrope-Variable.ttf", licence: "OFL-Manrope.txt", famille: "Axion Manrope" }] as const;
const CHARGEURS = ["chargerPoliceTitre", "chargerPoliceInter", "chargerPoliceKalam"] as const;

/** Points de code présents dans la table cmap (formats 4 et 12) d'un fichier TrueType. */
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

describe("polices des carrousels (M1-02, passées à Manrope par L2-02)", () => {
  it.each(POLICES)("$famille : fichier de police et licence OFL présents", ({ fichier, licence }) => {
    expect(existsSync(new URL(fichier, DOSSIER_POLICES))).toBe(true);
    expect(existsSync(new URL(licence, DOSSIER_POLICES))).toBe(true);
    const texte = readFileSync(new URL(licence, DOSSIER_POLICES), "utf8");
    expect(texte).toContain("SIL OPEN FONT LICENSE Version 1.1");
    expect(texte).toMatch(/^Copyright /);
  });

  it("le chargeur ne déclare que Manrope (un seul fichier local), sans chargement au niveau du module, et garde les points d'entrée des gabarits", () => {
    const src = readFileSync(SOURCE, "utf8");
    for (const chargeur of CHARGEURS) expect(src).toMatch(new RegExp(`export function ${chargeur}\\(\\): void`));
    expect(src).toContain('from "./police-manrope"');
    expect(src).not.toMatch(/new FontFace\(|\.ttf/);
    expect(src).not.toMatch(/Archivo|JetBrains/i);
    const manrope = readFileSync(SOURCE_MANROPE, "utf8");
    expect(manrope.match(/new FontFace\(/g)).toHaveLength(1);
    expect(manrope).toContain('weight: "200 800"');
    expect(manrope).toContain("delayRender");
    expect(manrope).toContain("continueRender");
  });

  it.each(POLICES)("$famille : glyphes français « ÉÀÇŒœ’« » » présents (cmap)", ({ fichier }) => {
    const codes = codesCmap(readFileSync(new URL(fichier, DOSSIER_POLICES)));
    for (const c of "ÉÀÇŒœ’«»") expect(codes.has(c.codePointAt(0)!), c).toBe(true);
  });

  it("espaces insécables : l'insécable (U+00A0) est dans Manrope ; aucune face de repli ni unicodeRange n'est déclarée (la fine U+202F n'y est pas : voir le journal de L2-02)", () => {
    expect(codesCmap(readFileSync(new URL("Manrope-Variable.ttf", DOSSIER_POLICES))).has(0xa0)).toBe(true);
    expect(readFileSync(SOURCE, "utf8")).not.toMatch(/unicodeRange|PLAGE_ESPACE_FINE/);
    expect(readFileSync(SOURCE_MANROPE, "utf8")).not.toMatch(/unicodeRange/);
  });

  it("l'attente est exposée, une erreur de chargement fait échouer le rendu, et les bornes de 5 s ont disparu", () => {
    const src = readFileSync(SOURCE, "utf8");
    expect(src).toContain("export function policeTitrePrete");
    expect(src).toContain("export function policeInterPrete");
    expect(readFileSync(SOURCE_MANROPE, "utf8")).toContain("cancelRender");
    for (const f of ["commun/Titre.tsx", "commun/controle-debordement.tsx"]) {
      const s = readFileSync(new URL(`../../studio-rendu/compositions/visuels/${f}`, import.meta.url), "utf8");
      expect(s, f).toContain("DELAI_POLICE_MS");
    }
    const titre = readFileSync(new URL("../../studio-rendu/compositions/visuels/commun/Titre.tsx", import.meta.url), "utf8");
    expect(titre).not.toMatch(/i < 200/);
    const ctrl = readFileSync(new URL("../../studio-rendu/compositions/visuels/commun/controle-debordement.tsx", import.meta.url), "utf8");
    expect(ctrl.slice(0, ctrl.indexOf("attendreTitres"))).not.toMatch(/i < 200/);
  });
});
