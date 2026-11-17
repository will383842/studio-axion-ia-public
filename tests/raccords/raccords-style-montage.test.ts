/**
 * C6-H24b-a · `raccordsStyleMontage` : fonction pure, non branchée. Un raccord seulement entre deux illustrations voisines,
 * jamais avec un côté qui montre le visage (Q7), jamais si l'un des plans dure moins de 0,6 s.
 */
import { describe, expect, it } from "vitest";
import type { PlanScene } from "../../src/briques/composition/scene";
import { raccordsStyleMontage } from "../../src/briques/composition/raccords";

const CADRAGE = { valeur: "large", zoom: 1, zoomFin: 1, pointX: 0.5, pointY: 0.38 } as const;
const double = (debutSec: number, finSec: number): PlanScene => ({ debutSec, finSec, type: "double", angle: "principal", cadrage: CADRAGE });
const illu = (debutSec: number, finSec: number, extra: Partial<PlanScene> = {}): PlanScene => ({
  debutSec, finSec, type: "illustration", angle: "principal", cadrage: CADRAGE, illustration: { url: "entree:illu", video: false }, ...extra,
});

describe("raccordsStyleMontage", () => {
  it("avocat : une illustration entre deux doubles → aucun raccord", () => {
    const plans = [double(0, 2.26), double(2.26, 3.96), illu(3.96, 6), double(6, 8.5), double(8.5, 10)];
    expect(raccordsStyleMontage(plans, "fondu")).toEqual([]);
    expect(raccordsStyleMontage(plans, "glissement")).toEqual([]);
  });
  it("deux illustrations voisines → un raccord du type demandé", () => {
    const plans = [double(0, 2), illu(2, 4), illu(4, 6), double(6, 8)];
    expect(raccordsStyleMontage(plans, "fondu")).toEqual([{ indexAvant: 1, type: "fondu" }]);
    expect(raccordsStyleMontage(plans, "glissement")).toEqual([{ indexAvant: 1, type: "glissement" }]);
  });
  it("« coupe » → []", () => {
    expect(raccordsStyleMontage([illu(0, 2), illu(2, 4)], "coupe")).toEqual([]);
  });
  it("double ↔ illustration : jamais", () => {
    expect(raccordsStyleMontage([double(0, 2), illu(2, 4)], "fondu")).toEqual([]);
    expect(raccordsStyleMontage([illu(0, 2), double(2, 4)], "fondu")).toEqual([]);
  });
  it("plan avec ecranPartage ou miseEnPage : jamais", () => {
    const partage = { carte: "entree:c", hauteurHaut: 960, sourceY: 0, entreeImages: 8, carteDebutSec: 0 } as unknown as PlanScene["ecranPartage"];
    const mise = { } as unknown as PlanScene["miseEnPage"];
    expect(raccordsStyleMontage([illu(0, 2), illu(2, 4, { ecranPartage: partage })], "fondu")).toEqual([]);
    expect(raccordsStyleMontage([illu(0, 2, { miseEnPage: mise }), illu(2, 4)], "glissement")).toEqual([]);
  });
  it("paire trop courte (< 0,6 s) : pas de raccord ; 0,6 s exactement : raccord", () => {
    expect(raccordsStyleMontage([illu(0, 2), illu(2, 2.5)], "fondu")).toEqual([]);
    expect(raccordsStyleMontage([illu(0, 0.5), illu(0.5, 3)], "fondu")).toEqual([]);
    expect(raccordsStyleMontage([illu(0, 2), illu(2, 2.75)], "fondu")).toHaveLength(1);
  });
  it("ordre croissant, plusieurs raccords", () => {
    const plans = [illu(0, 2), illu(2, 4), double(4, 6), illu(6, 8), illu(8, 10)];
    expect(raccordsStyleMontage(plans, "fondu").map((r) => r.indexAvant)).toEqual([0, 3]);
  });
  it("pure : même entrée, même sortie, entrée intacte", () => {
    const plans = [illu(0, 2), illu(2, 4)];
    const copie = JSON.stringify(plans);
    expect(raccordsStyleMontage(plans, "fondu")).toEqual(raccordsStyleMontage(plans, "fondu"));
    expect(JSON.stringify(plans)).toBe(copie);
  });
});
