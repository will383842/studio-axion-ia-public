import { describe, expect, it } from "vitest";

import { dansFenetre, ecartJours } from "./jours";

describe("ecartJours", () => {
  it("compte les jours entre aujourd'hui et une date future", () => {
    expect(ecartJours("2026-11-28", "2026-11-30")).toBe(2);
  });

  it("renvoie un écart négatif pour une date passée", () => {
    expect(ecartJours("2026-11-30", "2026-11-28")).toBe(-2);
  });

  it("renvoie null pour une chaîne qui n'est pas une date", () => {
    expect(ecartJours("2026-11-28", "pas-une-date")).toBeNull();
  });
});

describe("dansFenetre", () => {
  it("rejette un écart inconnu (null)", () => {
    expect(dansFenetre(null, 7)).toBe(false);
  });

  it("inclut la borne 0 (aujourd'hui)", () => {
    expect(dansFenetre(0, 7)).toBe(true);
  });

  it("inclut la borne n", () => {
    expect(dansFenetre(7, 7)).toBe(true);
  });

  it("rejette un écart au-delà de n", () => {
    expect(dansFenetre(8, 7)).toBe(false);
  });
});
