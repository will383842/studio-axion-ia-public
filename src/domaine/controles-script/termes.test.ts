import { describe, expect, it } from "vitest";
import { termesDivergents } from "./termes";

describe("termesDivergents", () => {
  it("signale des rôles divergents entre l'idée reçue et la réfutation", () => {
    expect(termesDivergents("il faut un informaticien", "sans développeur")).toEqual({ a: "informaticien", b: "developpeur" });
  });

  it("renvoie null quand les deux textes nomment le même rôle", () => {
    expect(termesDivergents("il faut un informaticien", "pas besoin d'un informaticien")).toBeNull();
    expect(termesDivergents("un comptable coûte cher", "un comptable suffit")).toBeNull();
  });

  it("renvoie null quand l'un des textes ne nomme aucun rôle", () => {
    expect(termesDivergents("il faut un informaticien", "ça se fait seul")).toBeNull();
    expect(termesDivergents("ça coûte cher", "sans développeur")).toBeNull();
  });

  it("reconnaît le pluriel et ignore accents et casse", () => {
    expect(termesDivergents("Des DÉVELOPPEURS", "un consultant")).toEqual({ a: "developpeur", b: "consultant" });
  });

  it("avec un pivot présent dans l'idée et absent de la réfutation, le résultat porte ce pivot", () => {
    expect(termesDivergents("il faut un informaticien", "sans développeur", "informaticien")).toEqual({ a: "informaticien", b: "developpeur" });
  });

  it("avec un pivot absent de la réfutation sans rôle nommé, l'autre terme est « autre chose »", () => {
    expect(termesDivergents("il faut un informaticien", "ça se fait seul", "informaticien")).toEqual({ a: "informaticien", b: "autre chose" });
  });

  it("avec un pivot présent dans les deux textes, ou absent de l'idée, renvoie null", () => {
    expect(termesDivergents("il faut un informaticien", "un informaticien n'est pas utile", "informaticien")).toBeNull();
    expect(termesDivergents("il faut un budget", "sans développeur", "informaticien")).toBeNull();
  });

  it("avec un pivot, ne compare pas les rôles", () => {
    expect(termesDivergents("un comptable", "un juriste", "budget")).toBeNull();
  });

  it("accepte un lexique personnalisé", () => {
    expect(termesDivergents("il faut un robot", "sans humain", undefined, ["robot", "humain"])).toEqual({ a: "robot", b: "humain" });
    expect(termesDivergents("il faut un informaticien", "sans développeur", undefined, ["robot"])).toBeNull();
  });
});
