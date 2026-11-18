import { describe, expect, it } from "vitest";
import { choisirInstants, mots, normaliser } from "../../../src/briques/regardeur";

describe("choisirInstants", () => {
  it("g) 30 parties, max 24 : début et fin gardés, tout dans les bornes", () => {
    const parties = Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, debutSec: i * 2, finSec: i * 2 + 2, texteAttendu: true }));
    const r = choisirInstants({ parties, dureeSec: 60 }, 24);
    expect(r).toHaveLength(24);
    expect(r[0]!.sorte).toBe("debut");
    expect(r.at(-1)!.sorte).toBe("fin");
    expect(r.map((i) => i.nom)[0]).toBe("i01");
    for (const i of r) {
      expect(i.instantSec).toBeGreaterThanOrEqual(0);
      expect(i.instantSec).toBeLessThanOrEqual(60);
      if (i.sorte === "partie") {
        const p = parties.find((x) => x.id === i.partieId)!;
        expect(i.instantSec).toBeGreaterThanOrEqual(p.debutSec);
        expect(i.instantSec).toBeLessThanOrEqual(p.finSec);
      }
    }
    expect(r.map((i) => i.instantSec)).toEqual([...r.map((i) => i.instantSec)].sort((a, b) => a - b));
  });

  it("mots dits entre t−1 s et t+1 s", () => {
    const r = choisirInstants({ parties: [{ id: "a", debutSec: 0, finSec: 5, texteAttendu: false }], dureeSec: 10, mots: [{ mot: "Bonjour", debutSec: 0, finSec: 0.4 }, { mot: "loin", debutSec: 9, finSec: 9.5 }] });
    expect(r[0]!.motsDits).toEqual(["bonjour"]);
  });

  it("normaliser et mots", () => {
    expect(normaliser("  Écrivez, PLAN !  e-mails ")).toBe("ecrivez plan e mails");
    expect(mots("un outil pour", 4)).toEqual(["outil", "pour"]);
  });
});
