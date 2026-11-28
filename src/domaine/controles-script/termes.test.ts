import { describe, it, expect } from "vitest";
import { termesDivergents } from "./termes";

describe("termesDivergents", () => {
  it("« il faut un informaticien » contre « sans développeur » : rôles divergents", () => {
    expect(termesDivergents("il faut un informaticien", "sans développeur")).toEqual({
      a: "informaticien",
      b: "developpeur",
    });
  });

  it("deux textes nommant le même rôle : null", () => {
    expect(termesDivergents("il faut un informaticien", "un informaticien suffit rarement")).toBeNull();
  });

  it("pivot présent dans l'idée et absent de la réfutation : le résultat porte ce pivot", () => {
    expect(termesDivergents("il faut un informaticien", "sans développeur", "informaticien")).toEqual({
      a: "informaticien",
      b: "developpeur",
    });
  });
});
