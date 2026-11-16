import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CLE_VARIETE_COMMUNE,
  FENETRE_VARIETE_COMMUNE,
  PRETES_COMPTEES,
  REPLI_VARIETE_COMMUNE,
  interpreterReglageVarieteCommune,
  lireReglageVarieteCommune,
} from "@/briques/variete-commune/reglage";

const ETEINT = { actif: false };
const piege = {
  get seuil(): number {
    throw new Error("piège");
  },
};

describe("réglage varieteCommune", () => {
  it.each([
    undefined, null, false, "true", 1, [], {},
    { fenetre: 20 },
    { seuil: 0.5, fenetre: 20 },
    { pretesNonPubliees: false },
    { seuil: "0.5" },
    { seuil: NaN },
  ])("éteint par défaut : %j", (v) => {
    expect(interpreterReglageVarieteCommune(v)).toEqual(ETEINT);
  });

  it("objet piège à getter : éteint", () => {
    expect(interpreterReglageVarieteCommune(piege)).toEqual(ETEINT);
  });

  it("true donne les défauts exacts", () => {
    expect(interpreterReglageVarieteCommune(true)).toEqual({
      actif: true,
      seuil: 0.5,
      fenetre: 10,
      pretesNonPubliees: true,
      repli: "moins-ressemblante",
    });
    expect(CLE_VARIETE_COMMUNE).toBe("varieteCommune");
    expect(FENETRE_VARIETE_COMMUNE).toBe(10);
    expect(PRETES_COMPTEES).toBe(true);
    expect(REPLI_VARIETE_COMMUNE).toBe("moins-ressemblante");
  });

  it("borne le seuil", () => {
    expect(interpreterReglageVarieteCommune({ seuil: 0.1 })).toMatchObject({ actif: true, seuil: 0.3 });
    expect(interpreterReglageVarieteCommune({ seuil: 0.95 })).toMatchObject({ actif: true, seuil: 0.9 });
    expect(interpreterReglageVarieteCommune({ seuil: 0.7 })).toMatchObject({
      actif: true,
      seuil: 0.7,
      fenetre: 10,
      pretesNonPubliees: true,
      repli: "moins-ressemblante",
    });
  });

  it("lit la clé une seule fois", async () => {
    const lire = vi.fn().mockResolvedValue(true);
    const r = await lireReglageVarieteCommune(lire);
    expect(lire).toHaveBeenCalledTimes(1);
    expect(lire).toHaveBeenCalledWith("varieteCommune");
    expect(r).toMatchObject({ actif: true, seuil: 0.5 });
  });

  it("lecture qui rejette ou qui lève ou absente : éteint", async () => {
    expect(await lireReglageVarieteCommune(() => Promise.reject(new Error("x")))).toEqual(ETEINT);
    expect(
      await lireReglageVarieteCommune(() => {
        throw new Error("x");
      }),
    ).toEqual(ETEINT);
    expect(await lireReglageVarieteCommune(async () => undefined)).toEqual(ETEINT);
  });

  it("garde : fichier pur", () => {
    const src = readFileSync(join(__dirname, "..", "..", "src/briques/variete-commune/reglage.ts"), "utf8");
    expect(src).not.toMatch(/reglages/);
    expect(src).not.toMatch(/@\/services/);
    expect(src).not.toMatch(/Date/);
    expect(src).not.toMatch(/Math\.random/);
  });
});
