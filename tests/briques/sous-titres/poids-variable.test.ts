import { existsSync, readFileSync } from "node:fs";
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
  it("éteint : aucun fichier de production n'importe poids-variable", async () => {
    const { execSync } = await import("node:child_process");
    const out = execSync(`grep -rl "poids-variable" src studio-rendu --include=*.ts --include=*.tsx || true`, { cwd: join(__dirname, "../../..") }).toString();
    expect(out.trim()).toBe("");
  });
});
