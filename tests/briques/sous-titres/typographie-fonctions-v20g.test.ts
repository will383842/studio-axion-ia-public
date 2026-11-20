import { describe, expect, it } from "vitest";
import {
  estFinPhrase,
  estMotOutil,
  estPause,
  estTrancheMilliers,
} from "../../../src/briques/sous-titres/typographie";

describe("estMotOutil", () => {
  it("reconnaît les articles, prépositions et conjonctions, casse et ponctuation ignorées", () => {
    expect(estMotOutil("le")).toBe(true);
    expect(estMotOutil("Pour")).toBe(true);
    expect(estMotOutil("À")).toBe(true);
    expect(estMotOutil("«")).toBe(false);
    expect(estMotOutil("(avec)")).toBe(true);
  });
  it("refuse les mots pleins et la chaîne vide", () => {
    expect(estMotOutil("entreprise")).toBe(false);
    expect(estMotOutil("")).toBe(false);
  });
  it("refuse un mot outil suivi d'une ponctuation forte", () => {
    expect(estMotOutil("et,")).toBe(false);
    expect(estMotOutil("donc.")).toBe(false);
    expect(estMotOutil("quoi ?")).toBe(false);
  });
  it("accepte une élision seule (« l' ») mais pas une élision suivie du mot (« l'entreprise »)", () => {
    expect(estMotOutil("l'")).toBe(true);
    expect(estMotOutil("d’")).toBe(true);
    expect(estMotOutil("l'entreprise")).toBe(false);
  });
});

describe("estTrancheMilliers", () => {
  it("reconnaît une tranche de trois chiffres, avec décimale éventuelle", () => {
    expect(estTrancheMilliers("000")).toBe(true);
    expect(estTrancheMilliers("500")).toBe(true);
    expect(estTrancheMilliers("250,50")).toBe(true);
    expect(estTrancheMilliers("000,")).toBe(true);
  });
  it("refuse les bords : vide, 2 ou 4 chiffres, lettres, unité", () => {
    expect(estTrancheMilliers("")).toBe(false);
    expect(estTrancheMilliers("00")).toBe(false);
    expect(estTrancheMilliers("0000")).toBe(false);
    expect(estTrancheMilliers("abc")).toBe(false);
    expect(estTrancheMilliers("000€")).toBe(false);
  });
});

describe("estFinPhrase", () => {
  it("reconnaît . ? ! … en fin de mot, même suivis d'un guillemet fermant", () => {
    expect(estFinPhrase("fini.")).toBe(true);
    expect(estFinPhrase("vraiment ?")).toBe(true);
    expect(estFinPhrase("stop!")).toBe(true);
    expect(estFinPhrase("bon…")).toBe(true);
    expect(estFinPhrase("fini.»")).toBe(true);
  });
  it("refuse virgule, point-virgule, mot nu et chaîne vide", () => {
    expect(estFinPhrase("fini,")).toBe(false);
    expect(estFinPhrase("fini;")).toBe(false);
    expect(estFinPhrase("fini")).toBe(false);
    expect(estFinPhrase("")).toBe(false);
  });
});

describe("estPause", () => {
  it("reconnaît , ; : en fin de mot", () => {
    expect(estPause("alors,")).toBe(true);
    expect(estPause("mais;")).toBe(true);
    expect(estPause("voici :")).toBe(true);
  });
  it("refuse la ponctuation forte, le mot nu et la chaîne vide", () => {
    expect(estPause("fini.")).toBe(false);
    expect(estPause("fini")).toBe(false);
    expect(estPause("")).toBe(false);
    expect(estPause("a,b")).toBe(false);
  });
});
