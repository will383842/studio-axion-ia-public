import { describe, expect, it } from "vitest";
import { consigneTrame } from "@/briques/visuels/trames";
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
  it("intention + récents : seul le modèle de couverture est évoqué, pas la suite de pages", () => {
    const e = ["a", "b"].map((x, k) => ({ suite: `T01 T0${k} T21`, couverture: `T01${k ? "B" : ""}:${x}` }));
    const c = consigneApi("preuve", e);
    expect(c).toContain(consigneTrame("preuve"));
    expect(c).toContain("modèle de couverture des derniers carrousels (T01, T01B)");
    expect(c).not.toContain("suite de pages");
    expect(c).not.toContain("T01 T00 T21");
  });
  it("intention eveil : T01 imposé par la trame n'est pas à éviter", () => {
    const c = consigneApi("eveil", [{ suite: "T01 T02 T21", couverture: "T01:x" }]);
    expect(c).toBe(consigneApi("eveil"));
    expect(c).not.toContain("couverture (T01");
    expect(c).not.toContain("Variété");
  });
});
