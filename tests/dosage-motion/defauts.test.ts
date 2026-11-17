import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLE_ACTIF, CLE_DEFAUTS } from "@/briques/dosage-motion/reglage";
import { DOSAGE_DEFAUT_CODE } from "@/briques/dosage-motion/crans";
import { definirDefautDosage, lireDefautsDosage, type PortsDefautsDosage } from "@/services/dosage-motion-defauts";

function ports(init: Record<string, unknown>, session = true) {
  const store: Record<string, unknown> = { ...init };
  const ecritures: Array<[string, unknown]> = [];
  const journal: string[] = [];
  const p: PortsDefautsDosage = {
    lire: async (id, d) => (id in store ? store[id] : d),
    ecrire: async (id, v) => { ecritures.push([id, v]); store[id] = v; },
    session: async () => { if (!session) throw new Error("pas de session"); },
    journaliser: async (_t, m) => { journal.push(m); },
  };
  return { p, ecritures, journal, store };
}

describe("dosage-motion : service des défauts", () => {
  for (const v of [undefined, false, "true"]) {
    it(`éteint (${String(v)}) : refus et 0 écriture`, async () => {
      const t = ports(v === undefined ? {} : { [CLE_ACTIF]: v });
      expect(await definirDefautDosage("avocat", "sobre", t.p)).toEqual({ ok: false, message: "Pas encore actif." });
      expect(t.ecritures).toHaveLength(0);
    });
  }
  it("cran non permis refusé", async () => {
    const t = ports({ [CLE_ACTIF]: true });
    expect(await definirDefautDosage("tableau", "aucun", t.p)).toEqual({ ok: false, message: "Ce choix n'existe pas pour ce générateur." });
    expect(t.ecritures).toHaveLength(0);
  });
  it("écriture puis lecture : même valeur, objet complet", async () => {
    const t = ports({ [CLE_ACTIF]: true });
    expect(await definirDefautDosage("avocat", "sobre", t.p)).toEqual({ ok: true });
    const lu = await lireDefautsDosage(t.p);
    expect(lu.avocat).toBe("sobre");
    expect(lu.tableau).toBe(DOSAGE_DEFAUT_CODE.tableau);
    expect(t.ecritures[0][0]).toBe(CLE_DEFAUTS);
    expect(Object.keys(t.ecritures[0][1] as object).sort()).toEqual(Object.keys(DOSAGE_DEFAUT_CODE).sort());
    expect(t.journal).toHaveLength(1);
  });
  it("deux appels identiques : une seule écriture", async () => {
    const t = ports({ [CLE_ACTIF]: true });
    await definirDefautDosage("avocat", "sobre", t.p);
    expect(await definirDefautDosage("avocat", "sobre", t.p)).toEqual({ ok: true });
    expect(t.ecritures).toHaveLength(1);
  });
  it("sans session : refus, rien écrit", async () => {
    const t = ports({ [CLE_ACTIF]: true }, false);
    await expect(definirDefautDosage("avocat", "sobre", t.p)).rejects.toThrow();
    expect(t.ecritures).toHaveLength(0);
  });
  it("garde : imports interdits", () => {
    const src = readFileSync(join(process.cwd(), "src/services/dosage-motion-defauts.ts"), "utf8");
    const imports = src.split("\n").filter((l) => /^\s*(import|export)\b.*from/.test(l)).join("\n");
    expect(imports).not.toMatch(/reglages|travaux|fabrication|credits|couts/);
  });
});
