import { describe, expect, it } from "vitest";
import { evaluerSeuil } from "./seuil";

describe("evaluerSeuil", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
  ])("donne « non-evalue » pour %s, quel que soit le sens", (_nom, valeur) => {
    expect(evaluerSeuil(valeur, { seuil: 10, sens: "au-moins" })).toBe("non-evalue");
    expect(evaluerSeuil(valeur, { seuil: 10, sens: "au-plus" })).toBe("non-evalue");
  });

  it("donne « non-evalue » pour une valeur qui n'est pas un nombre", () => {
    expect(evaluerSeuil("12" as unknown as number, { seuil: 10, sens: "au-moins" })).toBe("non-evalue");
  });

  it("au-moins : une valeur égale au seuil donne « alerte »", () => {
    expect(evaluerSeuil(10, { seuil: 10, sens: "au-moins" })).toBe("alerte");
  });

  it("au-moins : une valeur au-dessus donne « alerte », en dessous « ok »", () => {
    expect(evaluerSeuil(11, { seuil: 10, sens: "au-moins" })).toBe("alerte");
    expect(evaluerSeuil(9, { seuil: 10, sens: "au-moins" })).toBe("ok");
  });

  it("au-plus : une valeur égale au seuil donne « alerte »", () => {
    expect(evaluerSeuil(10, { seuil: 10, sens: "au-plus" })).toBe("alerte");
  });

  it("au-plus : une valeur en dessous donne « alerte », au-dessus « ok »", () => {
    expect(evaluerSeuil(9, { seuil: 10, sens: "au-plus" })).toBe("alerte");
    expect(evaluerSeuil(11, { seuil: 10, sens: "au-plus" })).toBe("ok");
  });

  it("traite 0 comme une valeur évaluable, pas comme une absence", () => {
    expect(evaluerSeuil(0, { seuil: 5, sens: "au-moins" })).toBe("ok");
    expect(evaluerSeuil(0, { seuil: 5, sens: "au-plus" })).toBe("alerte");
    expect(evaluerSeuil(0, { seuil: 0, sens: "au-moins" })).toBe("alerte");
  });

  it("gère les valeurs négatives et décimales", () => {
    expect(evaluerSeuil(-1.5, { seuil: -1.5, sens: "au-plus" })).toBe("alerte");
    expect(evaluerSeuil(-2, { seuil: -1.5, sens: "au-moins" })).toBe("ok");
  });
});
