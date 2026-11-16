import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { plafondsDepuisProfil } from "@/briques/bibliotheque-video/habillage";
import { PROFILS_DU_CODE, profilNeutre } from "@/briques/bibliotheque-video/profils";
import { PLAFONDS_PAR_DEFAUT } from "@/briques/motion/habillage-commun/types";
import type { ProfilVideo } from "@/briques/bibliotheque-video/types";

const avec = (plafonds: ProfilVideo["plafonds"], habillage?: unknown): ProfilVideo =>
  ({ ...profilNeutre("podcast"), plafonds, blocs: habillage === undefined ? undefined : { habillage } }) as ProfilVideo;

describe("plafondsDepuisProfil", () => {
  it("profil absent = plafonds par défaut, en copie", () => {
    for (const p of [null, undefined]) {
      const r = plafondsDepuisProfil(p);
      expect(r).toEqual(PLAFONDS_PAR_DEFAUT);
      expect(r).not.toBe(PLAFONDS_PAR_DEFAUT);
    }
  });
  it("chaque profil du code donne des plafonds valides", () => {
    for (const p of [...Object.values(PROFILS_DU_CODE), profilNeutre("podcast")]) {
      const r = plafondsDepuisProfil(p);
      expect(Number.isFinite(r.transitionsRichesMax) && r.transitionsRichesMax >= 0).toBe(true);
      expect(r.partCoupesFranchesMin).toBeGreaterThanOrEqual(0.9);
      expect(r.partCoupesFranchesMin).toBeLessThanOrEqual(1);
      expect(typeof r.pleinCadrePermis).toBe("boolean");
      expect(typeof r.fondsAnimes).toBe("boolean");
      expect(typeof r.lumieres).toBe("boolean");
    }
  });
  it("lit transitionsMax et le bloc habillage", () => {
    const r = plafondsDepuisProfil(avec({ transitionsMax: 5 }, { partCoupesFranchesMin: 0.95, pleinCadrePermis: true, fondsAnimes: true, lumieres: true }));
    expect(r).toEqual({ transitionsRichesMax: 5, partCoupesFranchesMin: 0.95, pleinCadrePermis: true, fondsAnimes: true, lumieres: true });
  });
  it("transitionsMax absent = 3 ; bloc absent = repli", () => {
    expect(plafondsDepuisProfil(avec({}))).toEqual(PLAFONDS_PAR_DEFAUT);
  });
  it("part de coupes franches jamais sous 0,9", () => {
    const r = plafondsDepuisProfil(avec({}, { partCoupesFranchesMin: 0.5, pleinCadrePermis: true, fondsAnimes: false, lumieres: false }));
    expect(r.partCoupesFranchesMin).toBe(0.9);
    expect(r.pleinCadrePermis).toBe(true);
  });
  it("valeurs hors bornes = repli", () => {
    for (const v of [-1, NaN, Infinity]) {
      const r = plafondsDepuisProfil(avec({ transitionsMax: v }, { partCoupesFranchesMin: v, pleinCadrePermis: true, fondsAnimes: false, lumieres: false }));
      expect(r.transitionsRichesMax).toBe(3);
      expect(r.partCoupesFranchesMin).toBe(0.9);
    }
    expect(plafondsDepuisProfil(avec({}, { partCoupesFranchesMin: 1.5, pleinCadrePermis: true, fondsAnimes: false, lumieres: false })).partCoupesFranchesMin).toBe(0.9);
  });
  it("l'objet de repli n'est jamais modifié", () => {
    const avant = JSON.stringify(PLAFONDS_PAR_DEFAUT);
    plafondsDepuisProfil(null).transitionsRichesMax = 99;
    plafondsDepuisProfil(avec({ transitionsMax: 7 }));
    expect(JSON.stringify(PLAFONDS_PAR_DEFAUT)).toBe(avant);
  });
  it("garde statique : aucun import interdit", () => {
    const src = readFileSync(join(process.cwd(), "src/briques/bibliotheque-video/habillage.ts"), "utf8");
    expect(src).not.toMatch(/studio-rendu|@\/services\/|argent|plafonds-argent/i);
  });
});
