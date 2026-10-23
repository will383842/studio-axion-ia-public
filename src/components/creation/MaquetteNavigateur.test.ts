import { describe, expect, it } from "vitest";
import { planA, zoomA } from "./MaquetteNavigateur";

describe("maquette composée dans le navigateur (B.1)", () => {
  const plans = [
    { debutSec: 0, finSec: 1.8 },
    { debutSec: 1.8, finSec: 4 },
    { debutSec: 4, finSec: 7.5 },
  ];
  it("le plan affiché suit le son ; avant le début : le premier, après la fin : le dernier", () => {
    expect(planA(plans, 0)).toBe(0);
    expect(planA(plans, 1.8)).toBe(1);
    expect(planA(plans, 6)).toBe(2);
    expect(planA(plans, 9)).toBe(2);
  });
  it("zoom lent 100 → 106 % réparti sur la durée du plan ; cadrage fixe sinon", () => {
    const p = { debutSec: 4, finSec: 7.5, cadrage: { zoom: 1, zoomFin: 1.06 } };
    expect(zoomA(p, 4)).toBe(1);
    expect(zoomA(p, 5.75)).toBeCloseTo(1.03, 5);
    expect(zoomA(p, 7.5)).toBeCloseTo(1.06, 5);
    expect(zoomA({ debutSec: 0, finSec: 2, cadrage: { zoom: 1.2 } }, 1)).toBe(1.2);
  });
});
