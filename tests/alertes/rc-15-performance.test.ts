/**
 * RC-15 : alertes de performance A17 (décolle) et A16 (chute), sans IA, fonctions pures. Moins de 10 relevés = « trop tôt »,
 * jamais d'alerte. Les types et la fonction de seuil viennent de RC-14.
 */
import { describe, expect, it } from "vitest";
import { evaluerChute, evaluerDecolle, medianeCompte, SEUILS_PERFORMANCE, type PublicationMesuree } from "@/domaine/alertes/performance";

const pub = (vues: number | null, nbReleves = 10): PublicationMesuree => ({ vues, nbReleves });

describe("RC-15 — médiane du compte", () => {
  it("médiane impaire, paire, et valeurs inconnues ignorées", () => {
    expect(medianeCompte([5, 1, 3])).toBe(3);
    expect(medianeCompte([1, 2, 3, 4])).toBe(2.5);
    expect(medianeCompte([1, null, 3, Number.NaN])).toBe(2);
    expect(medianeCompte([])).toBeNull();
    expect(medianeCompte([null])).toBeNull();
  });
  it("une valeur négative est illisible : ignorée par la médiane", () => {
    expect(medianeCompte([-4, 2, 3])).toBe(2.5);
    expect(medianeCompte([-4, 2, 4, 6])).toBe(4);
    expect(medianeCompte([-1, -2])).toBeNull();
  });
});

describe("RC-15 — A17 décolle (> 2 × médiane à H+2, au moins 10 relevés)", () => {
  it("alerte au-delà de 2 fois la médiane", () => {
    const r = evaluerDecolle(pub(201), 100);
    expect(r).toMatchObject({ id: "A17", niveau: "alerte", statut: "fiable" });
  });
  it("pas d'alerte à exactement 2 fois (strict) ni en dessous", () => {
    expect(evaluerDecolle(pub(200), 100).niveau).toBe("ok");
    expect(evaluerDecolle(pub(50), 100).niveau).toBe("ok");
  });
  it("moins de 10 relevés : « trop tôt », aucune alerte même très au-dessus", () => {
    const r = evaluerDecolle(pub(10_000, 9), 100);
    expect(r).toMatchObject({ niveau: "ok", statut: "trop-tot" });
  });
  it("10 relevés pile : évalué", () => {
    expect(evaluerDecolle(pub(500, 10), 100).statut).toBe("fiable");
  });
  it("médiane ou vues inconnues / nulles : non évalué, jamais de faux vert", () => {
    expect(evaluerDecolle(pub(500), null)).toMatchObject({ niveau: "non-evalue", statut: "non-evalue" });
    expect(evaluerDecolle(pub(500), 0).niveau).toBe("non-evalue");
    expect(evaluerDecolle(pub(null), 100).niveau).toBe("non-evalue");
  });
  it("vues négatives : illisible, non évalué", () => {
    expect(evaluerDecolle(pub(-5), 100)).toMatchObject({ niveau: "non-evalue", statut: "non-evalue" });
    expect(evaluerDecolle(pub(-1), 100).niveau).toBe("non-evalue");
  });
});

describe("RC-15 — A16 chute (< 50 % de la médiane sur 3 publications)", () => {
  it("alerte quand les 3 dernières sont sous 50 %", () => {
    expect(evaluerChute([pub(10), pub(20), pub(49)], 100)).toMatchObject({ id: "A16", niveau: "alerte", statut: "fiable" });
  });
  it("pas d'alerte à exactement 50 % (strict) ou si une seule remonte", () => {
    expect(evaluerChute([pub(10), pub(20), pub(50)], 100).niveau).toBe("ok");
    expect(evaluerChute([pub(10), pub(80), pub(20)], 100).niveau).toBe("ok");
  });
  it("moins de 3 publications ou une à moins de 10 relevés : « trop tôt », aucune alerte", () => {
    expect(evaluerChute([pub(1), pub(1)], 100)).toMatchObject({ niveau: "ok", statut: "trop-tot" });
    expect(evaluerChute([pub(1), pub(1), pub(1, 9)], 100)).toMatchObject({ niveau: "ok", statut: "trop-tot" });
  });
  it("seules les 3 plus récentes comptent (la liste est du plus ancien au plus récent)", () => {
    expect(evaluerChute([pub(500), pub(1), pub(1), pub(1)], 100).niveau).toBe("alerte");
  });
  it("médiane inconnue ou vues inconnues : non évalué", () => {
    expect(evaluerChute([pub(1), pub(1), pub(1)], null).niveau).toBe("non-evalue");
    expect(evaluerChute([pub(1), pub(null), pub(1)], 100).niveau).toBe("non-evalue");
  });
  it("vues négatives : illisible, non évalué (jamais une alerte de chute)", () => {
    expect(evaluerChute([pub(-1), pub(-1), pub(-1)], 100)).toMatchObject({ niveau: "non-evalue", statut: "non-evalue" });
    expect(evaluerChute([pub(1), pub(-1), pub(1)], 100).niveau).toBe("non-evalue");
  });
});

describe("RC-15 — seuils et pureté", () => {
  it("seuils lisibles en un seul endroit", () => {
    expect(SEUILS_PERFORMANCE).toEqual({ relevesMin: 10, decolleFacteur: 2, chuteFacteur: 0.5, chutePublications: 3 });
  });
  it("ne modifie pas ses entrées", () => {
    const l = [pub(1), pub(2), pub(3)];
    const copie = JSON.parse(JSON.stringify(l));
    evaluerChute(l, 100);
    expect(l).toEqual(copie);
  });
});
