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
  it("refuse aussi les variantes de source non prouvée", () => {
    for (const s of ["exemple inventé.", "Exemple inventé (à remplacer)", "exemple", "à vérifier", "Inconnue", "source inventée", "non daté", "https://exemple.fr/page, exemple inventé"]) {
      expect(estConfirmee(s), s).toBe(false);
    }
  });
  it("n'accepte qu'une source datée ou une URL", () => {
    expect(estConfirmee("https://aide.reseau.test/cadence")).toBe(true);
    expect(estConfirmee("lue le 2026-11-01")).toBe(true);
    expect(estConfirmee("page officielle du réseau")).toBe(false);
    expect(estConfirmee("on m'a dit")).toBe(false);
  });
  it("lit les mêmes règles que reseaux() et marque chacune « conseil, non confirmé »", () => {
    const toutes = reglesCadence();
    expect(toutes.length).toBe(reseaux().length);
    for (const c of toutes) {
      expect(c.niveau).toBe("conseil");
      expect(c.confirmee).toBe(false);
    }
    for (const r of reseaux()) {
      const c = toutes.find((x) => x.code === r.code)!;
      expect(c.rythme).toEqual(analyserRythme(r.rythmeMaxSemaine));
      expect(c.ecartMinH).toBe(analyserEcartH(r.ecartMinH));
    }
    expect(reglesCadence("tiktok").every((c) => c.reseau === "tiktok")).toBe(true);
  });
});
