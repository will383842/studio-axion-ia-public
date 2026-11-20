import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CLES_REGLAGE_HABILLAGE,
  estAllume,
  habillageActif,
  reglagesHabillage,
  type NomReglageHabillage,
} from "@/briques/motion/habillage-commun/reglage";

const NOMS: NomReglageHabillage[] = ["transitionsPlanScenes", "transitionsStyleMontage", "lutsSupplementaires"];
const CLES = ["habillage.transitionsPlanScenes", "habillage.transitionsStyleMontage", "habillage.lutsSupplementaires"];

describe("C6-H4a · réglages de l'habillage commun (éteints par défaut, sauf transitionsPlanScenes)", () => {
  it("estAllume : seul true exact allume", () => {
    expect(estAllume(true)).toBe(true);
    for (const v of [false, "true", 1, "oui", null, undefined, {}, []]) expect(estAllume(v)).toBe(false);
  });

  describe("transitionsPlanScenes (ALLUMER-TRANSITIONS-CC-v20g : allumé par défaut)", () => {
    const nom: NomReglageHabillage = "transitionsPlanScenes";
    it("seul false exact éteint ; absent, true, \"true\", 1, null allument", async () => {
      expect(await habillageActif(nom, async () => false)).toBe(false);
      for (const v of [true, "true", 1, null, undefined]) expect(await habillageActif(nom, async () => v)).toBe(true);
    });
    it("lecture qui rejette ou lève : éteint", async () => {
      expect(await habillageActif(nom, () => Promise.reject(new Error("x")))).toBe(false);
      expect(await habillageActif(nom, () => { throw new Error("sync"); })).toBe(false);
    });
    it("lire reçoit la clé exacte et le défaut true", async () => {
      const lire = vi.fn(async () => true);
      await habillageActif(nom, lire);
      expect(lire).toHaveBeenCalledTimes(1);
      expect(lire).toHaveBeenCalledWith("habillage.transitionsPlanScenes", true);
    });
  });

  for (const nom of NOMS.filter((n) => n !== "transitionsPlanScenes")) {
    describe(nom, () => {
      it("true allume, toute autre valeur éteint", async () => {
        expect(await habillageActif(nom, async () => true)).toBe(true);
        for (const v of [false, "true", 1, "oui", null, undefined, {}, []]) {
          expect(await habillageActif(nom, async () => v)).toBe(false);
        }
      });
      it("lecture qui rejette ou lève : éteint", async () => {
        expect(await habillageActif(nom, () => Promise.reject(new Error("x")))).toBe(false);
        expect(
          await habillageActif(nom, () => {
            throw new Error("sync");
          }),
        ).toBe(false);
      });
      it("lire reçoit la clé exacte et le défaut false", async () => {
        const lire = vi.fn(async () => false);
        await habillageActif(nom, lire);
        expect(lire).toHaveBeenCalledTimes(1);
        expect(lire).toHaveBeenCalledWith(CLES_REGLAGE_HABILLAGE[nom], false);
      });
    });
  }

  it("clés exactes", () => {
    expect(CLES_REGLAGE_HABILLAGE.transitionsPlanScenes).toBe("habillage.transitionsPlanScenes");
    expect(CLES_REGLAGE_HABILLAGE.transitionsStyleMontage).toBe("habillage.transitionsStyleMontage");
    expect(CLES_REGLAGE_HABILLAGE.lutsSupplementaires).toBe("habillage.lutsSupplementaires");
  });

  it("nom inconnu : éteint sans appeler lire", async () => {
    const lire = vi.fn(async () => true);
    expect(await habillageActif("inconnu" as NomReglageHabillage, lire)).toBe(false);
    expect(lire).not.toHaveBeenCalled();
  });

  it("reglagesHabillage : 3 lectures, ordre, objet gelé", async () => {
    const lire = vi.fn(async (id: string) => id === "habillage.lutsSupplementaires");
    const r = await reglagesHabillage(lire);
    expect(r).toEqual({ transitionsPlanScenes: false, transitionsStyleMontage: false, lutsSupplementaires: true });
    expect(Object.keys(r)).toEqual(NOMS);
    expect(lire).toHaveBeenCalledTimes(3);
    expect(Object.isFrozen(r)).toBe(true);
  });

  it("liste fermée, aucun réglage de son", () => {
    expect(Object.values(CLES_REGLAGE_HABILLAGE)).toEqual(CLES);
    expect(Object.isFrozen(CLES_REGLAGE_HABILLAGE)).toBe(true);
    for (const c of Object.values(CLES_REGLAGE_HABILLAGE)) expect(c).not.toContain("son");
  });

  it("garde de source : pur, aucun import", () => {
    const src = readFileSync(join(process.cwd(), "src/briques/motion/habillage-commun/reglage.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/\bimport\b/);
    expect(code).not.toMatch(/lireParametre/);
    expect(code).not.toMatch(/@\/services/);
    expect(code).not.toMatch(/Date\.now|Math\.random/);
  });
});
