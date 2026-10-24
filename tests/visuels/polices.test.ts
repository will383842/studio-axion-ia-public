import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DOSSIER_POLICES = new URL("../../studio-rendu/compositions/commune/polices/", import.meta.url);
const SOURCE = new URL("../../studio-rendu/compositions/visuels/polices.ts", import.meta.url);

const POLICES = [
  { fichier: "InterDisplay-Black.ttf", licence: "OFL-Inter.txt", famille: "Axion Inter Display", chargeur: "chargerPoliceTitre" },
  { fichier: "Inter-Medium.ttf", licence: "OFL-Inter.txt", famille: "Axion Inter", chargeur: "chargerPoliceInter" },
  { fichier: "Inter-SemiBold.ttf", licence: "OFL-Inter.txt", famille: "Axion Inter", chargeur: "chargerPoliceInter" },
  { fichier: "Inter-Bold.ttf", licence: "OFL-Inter.txt", famille: "Axion Inter", chargeur: "chargerPoliceInter" },
] as const;

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

describe("polices des carrousels (M1-02)", () => {
  it.each(POLICES)("$famille : fichier de police et licence OFL présents", ({ fichier, licence }) => {
    expect(existsSync(new URL(fichier, DOSSIER_POLICES))).toBe(true);
    expect(existsSync(new URL(licence, DOSSIER_POLICES))).toBe(true);
    const texte = readFileSync(new URL(licence, DOSSIER_POLICES), "utf8");
    expect(texte).toContain("SIL OPEN FONT LICENSE Version 1.1");
    expect(texte).toMatch(/^Copyright /);
  });

  it("le chargeur déclare les familles (Inter Display Black pour les titres, Inter en trois graisses), sans chargement au niveau du module", () => {
    const src = readFileSync(SOURCE, "utf8");
    for (const { famille, chargeur, fichier } of POLICES) {
      expect(src).toContain(`"${famille}"`);
      expect(src).toMatch(new RegExp(`export function ${chargeur}\\(\\): void`));
      expect(src).toContain(fichier);
    }
    // Inter Display Black (1 fichier) + Inter (une FontFace par graisse : 500, 600, 700, plus U+202F pour le Bold) + Kalam (et son U+202F) ; ni Archivo Black ni JetBrains Mono.
    expect(src.match(/new FontFace\(/g)).toHaveLength(5);
    expect(src).not.toMatch(/Archivo/);
    for (const poids of ["500", "600", "700"]) expect(src).toContain(`poids: "${poids}"`);
    expect(src).not.toMatch(/JetBrains/i);
    expect(src).toContain("delayRender");
    expect(src).toContain("continueRender");
  });

  it.each(POLICES)("$famille : glyphes français « ÉÀÇŒœ’« » » présents (cmap)", ({ fichier }) => {
    const codes = codesCmap(readFileSync(new URL(fichier, DOSSIER_POLICES)));
    for (const c of "ÉÀÇŒœ’«»") expect(codes.has(c.codePointAt(0)!), c).toBe(true);
  });

  it("espace fine insécable (U+202F) : dans Inter Display Black et Inter SemiBold ; Inter Bold et Kalam la prennent dans Inter SemiBold (unicodeRange)", () => {
    for (const f of ["InterDisplay-Black.ttf", "Inter-SemiBold.ttf", "Inter-Medium.ttf"]) expect(codesCmap(readFileSync(new URL(f, DOSSIER_POLICES))).has(0x202f), f).toBe(true);
    const src = readFileSync(SOURCE, "utf8");
    expect(src).toContain('PLAGE_ESPACE_FINE = "U+202F"');
    expect(src.match(/url\(\$\{interSemiBold\}\)`, \{ weight: "700", unicodeRange: PLAGE_ESPACE_FINE \}/g)).toHaveLength(2);
  });

  it("l'attente est exposée, une erreur de chargement fait échouer le rendu, et les bornes de 5 s ont disparu", () => {
    const src = readFileSync(SOURCE, "utf8");
    expect(src).toContain("export function policeTitrePrete");
    expect(src).toContain("export function policeInterPrete");
    expect(src).toContain("cancelRender");
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
