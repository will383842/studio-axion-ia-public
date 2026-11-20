import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { graisseAuTemps, largeurReservee } from "../../../src/briques/sous-titres/poids-variable";
import { largeurMot, type NomPolice } from "../../../src/briques/sous-titres/mesure";

const MOTS = ["le", "avocat", "visa", "expatriation", "droit", "France", "Thaïlande", "impôts", "démarche", "contrat", "en", "règle", "99", "2027", "papiers", "mission", "WiFi", "où", "çà", "quand"];
const POLICES: NomPolice[] = ["Manrope Medium", "Manrope SemiBold", "Manrope Bold", "Manrope ExtraBold"];

describe("poids-variable : graisse du mot dit", () => {
  it("reste toujours dans [500, 800]", () => {
    for (let t = -2; t <= 5; t += 0.05) {
      const g = graisseAuTemps(t, 1, 2);
      expect(g).toBeGreaterThanOrEqual(500);
      expect(g).toBeLessThanOrEqual(800);
    }
  });
  it("500 avant le mot, 800 à la fin et après", () => {
    expect(graisseAuTemps(0, 1, 2)).toBe(500);
    expect(graisseAuTemps(1, 1, 2)).toBe(500);
    expect(graisseAuTemps(2, 1, 2)).toBe(800);
    expect(graisseAuTemps(3, 1, 2)).toBe(800);
  });
  it("monotone croissant pendant le mot", () => {
    let prec = 0;
    for (let t = 0.5; t <= 2.5; t += 0.01) {
      const g = graisseAuTemps(t, 1, 2);
      expect(g).toBeGreaterThanOrEqual(prec);
      prec = g;
    }
  });
  it("même entrée = même sortie ; mot de durée nulle sans NaN", () => {
    expect(graisseAuTemps(1.37, 1, 2)).toBe(graisseAuTemps(1.37, 1, 2));
    expect(graisseAuTemps(1, 1, 1)).toBe(800);
    expect(Number.isNaN(graisseAuTemps(0.9, 1, 1))).toBe(false);
  });
  it("la largeur réservée ≥ la largeur à toute graisse (20 mots)", () => {
    expect(MOTS).toHaveLength(20);
    for (const m of MOTS) {
      for (const p of POLICES) expect(largeurReservee(m, 100)).toBeGreaterThanOrEqual(largeurMot(m, p, 100));
      expect(largeurReservee(m, 100)).toBe(largeurMot(m, "Manrope ExtraBold", 100));
    }
  });
  it("police = Manrope Variable, déjà au dépôt, licence OFL copiée", () => {
    const d = join(__dirname, "../../../src/briques/sous-titres/polices");
    expect(existsSync(join(d, "Manrope-Variable.ttf"))).toBe(true);
    expect(readFileSync(join(d, "OFL-Manrope.txt"), "utf8")).toMatch(/SIL OPEN FONT LICENSE/i);
  });
  // FIX-GARDE-POIDS-VARIABLE-v19c 19/11 (voulue, seconde lecture du pilote) : liste fermée exacte des importeurs.
  const IMPORTEURS_PREVUS = ["src/briques/sous-titres/scene.ts", "src/briques/sous-titres/paliers-graisse.ts"];
  const estImporteur = (texte: string): boolean => /["'][^"'\n]*\/poids-variable(?:\.[cm]?[jt]sx?)?["']/.test(texte);
  const listerSources = (dossier: string, racine: string): string[] => {
    const sortie: string[] = [];
    for (const e of readdirSync(join(racine, dossier), { withFileTypes: true })) {
      const rel = `${dossier}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== "node_modules") sortie.push(...listerSources(rel, racine)); }
      else if (/\.tsx?$/.test(e.name)) sortie.push(rel);
    }
    return sortie;
  };
  it("éteint : seuls les fichiers prévus importent poids-variable", () => {
    const racine = join(__dirname, "../../..");
    const importeurs = ["src", "studio-rendu"].flatMap((d) => (existsSync(join(racine, d)) ? listerSources(d, racine) : [])).filter((f) => estImporteur(readFileSync(join(racine, f), "utf8"))).sort();
    for (const f of importeurs) expect(IMPORTEURS_PREVUS).toContain(f);
    expect(importeurs).toContain("src/briques/sous-titres/scene.ts");
    expect(importeurs.filter((f) => f.startsWith("studio-rendu/"))).toEqual([]);
  });
  it("contrôle négatif : un faux fichier qui importe poids-variable est reconnu, un nom de capacité non", () => {
    expect(estImporteur('import { graisseAuTemps } from "../sous-titres/poids-variable";')).toBe(true);
    expect(estImporteur('const m = await import("./poids-variable");')).toBe(true);
    expect(estImporteur('import {\n  graisseAuTemps,\n  largeurReservee,\n} from "./poids-variable";')).toBe(true);
    expect(estImporteur('export { graisseAuTemps } from "./poids-variable";')).toBe(true);
    expect(estImporteur('export * from "../sous-titres/poids-variable";')).toBe(true);
    expect(estImporteur('import { graisseAuTemps } from "./poids-variable.js";')).toBe(true);
    expect(estImporteur('const m = require("./poids-variable");')).toBe(true);
    expect(estImporteur('  textePoidsVariable: "texte.poids-variable",')).toBe(false);
  });
});
