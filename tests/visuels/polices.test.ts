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

  it("tout signe produit par espacerPage existe dans la cmap de Manrope (sinon le navigateur prend une police de secours)", async () => {
    const { espacerPage } = await import("../../src/briques/visuels/typographie-francaise");
    const cmap = codesCmap(readFileSync(new URL("Manrope-Variable.ttf", DOSSIER_POLICES)));
    expect(cmap.has(0xa0)).toBe(true);
    const sortie = espacerPage({ titre: "Et si on essayait ? Oui ! Voyons ; « ok » : fin 9:30 l'IA" });
    for (const c of JSON.stringify(sortie)) {
      const code = c.codePointAt(0)!;
      if (code > 0x7f) expect(cmap.has(code), `U+${code.toString(16).toUpperCase()}`).toBe(true);
    }
    expect(JSON.stringify(sortie)).not.toContain("\u202f");
    expect(readFileSync(SOURCE, "utf8")).not.toMatch(/unicodeRange|PLAGE_ESPACE_FINE/);
  });

  it("correction opus-v1-w1 : toute chaîne de TEXTES_FIXES, TEXTES_FIXES_L9 et TEXTES_FIXES_L11 existe dans la cmap de Manrope (page T22 comprise)", async () => {
    const { TEXTES_FIXES, TEXTES_FIXES_L9, TEXTES_FIXES_L11 } = await import("../../src/briques/visuels/textes-fixes");
    const cmap = codesCmap(readFileSync(new URL("Manrope-Variable.ttf", DOSSIER_POLICES)));
    const chaines: [string, string][] = [];
    const parcourir = (nom: string, v: unknown) => {
      if (typeof v === "string") chaines.push([nom, v]);
      else if (Array.isArray(v)) v.forEach((x, i) => parcourir(`${nom}[${i}]`, x));
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) parcourir(`${nom}.${k}`, x);
    };
    parcourir("TEXTES_FIXES", TEXTES_FIXES);
    parcourir("TEXTES_FIXES_L9", TEXTES_FIXES_L9);
    parcourir("TEXTES_FIXES_L11", TEXTES_FIXES_L11);
    expect(chaines.length).toBeGreaterThan(10);
    expect(chaines.map(([n]) => n)).toContain("TEXTES_FIXES_L9.t22Bascule");
    for (const [nom, t] of chaines) {
      for (const c of t) {
        const code = c.codePointAt(0)!;
        if (code > 0x7f) expect(cmap.has(code), `${nom} : U+${code.toString(16).toUpperCase()}`).toBe(true);
      }
    }
  });
  it("correction opus-v1-w1 : T21 passe son texte par pourManrope (jamais typographieFrancaise seule)", () => {
    const t21 = readFileSync(new URL("../../studio-rendu/compositions/visuels/pages/T21.tsx", import.meta.url), "utf8");
    expect(t21).toContain("pourManrope");
    expect(t21).not.toMatch(/\btypographieFrancaise\b/);
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
