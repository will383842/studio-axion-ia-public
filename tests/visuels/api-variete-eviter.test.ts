import { describe, expect, it } from "vitest";
import { CONSIGNE_API, consigneApi } from "@/visuels/texte/api";

describe("consigne API · variété L7", () => {
  it("sans récents : la consigne d'avant", () => {
    expect(consigneApi()).toBe(CONSIGNE_API);
    expect(consigneApi("eveil", [])).toBe(consigneApi("eveil"));
  });
  it("les 3 dernières suites et couvertures sont dites au rédacteur", () => {
    const e = ["a", "b", "c", "d"].map((x, k) => ({ suite: `T01 T0${k} T21`, couverture: `T01${k % 2 ? "B" : ""}:${x}` }));
    const c = consigneApi(undefined, e);
    expect(c).toContain("T01 T00 T21");
    expect(c).toContain("T01 T02 T21");
    expect(c).not.toContain("T01 T03 T21");
    expect(c).toContain("T01, T01B");
  });
});
