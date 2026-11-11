import { describe, expect, it } from "vitest";
import { analyserEcartH, analyserRythme, estConfirmee, reglesCadence } from "@/domaine/cadence/regles";
import { reseaux } from "@/donnees/bases-usine";

describe("règles de cadence typées", () => {
  it("'5-7' et '3' donnent {5, 7, 3}", () => {
    const r = analyserRythme("5-7");
    expect(r).toEqual({ min: 5, max: 7 });
    expect(analyserEcartH("3")).toBe(3);
  });
  it("un nombre seul vaut min = max ; les valeurs inconnues restent nulles", () => {
    expect(analyserRythme("4")).toEqual({ min: 4, max: 4 });
    expect(analyserRythme("inconnu")).toBeNull();
    expect(analyserRythme("")).toBeNull();
    expect(analyserRythme("7-5")).toBeNull();
    expect(analyserEcartH("inconnu")).toBeNull();
    expect(analyserEcartH("-2")).toBeNull();
  });
  it("une source « exemple inventé » n'est pas confirmée", () => {
    expect(estConfirmee("exemple inventé")).toBe(false);
    expect(estConfirmee("")).toBe(false);
    expect(estConfirmee("inconnu")).toBe(false);
    expect(estConfirmee("page officielle du réseau, lue le 2026-11-01")).toBe(true);
  });
  it("lit les mêmes règles que reseaux() et marque chacune « conseil, non confirmé »", () => {
    const toutes = reglesCadence();
    expect(toutes.length).toBe(reseaux().length);
    for (const c of toutes) {
      expect(c.niveau).toBe("conseil");
      expect(c.confirmee).toBe(false);
      expect(c.rythme).toEqual({ min: 5, max: 7 });
      expect(c.ecartMinH).toBe(3);
    }
    expect(reglesCadence("tiktok").every((c) => c.reseau === "tiktok")).toBe(true);
  });
});
