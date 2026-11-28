import { describe, expect, it } from "vitest";
import { dansFenetre, ecartJours } from "./jours";

describe("ecartJours", () => {
  it("compte les jours du premier au second", () => {
    expect(ecartJours("2026-11-28", "2026-11-30")).toBe(2);
    expect(ecartJours("2026-11-28", "2026-11-28")).toBe(0);
  });

  it("donne un écart négatif pour une date passée", () => {
    expect(ecartJours("2026-11-28", "2026-11-25")).toBe(-3);
  });

  it("traverse les fins de mois et d'année", () => {
    expect(ecartJours("2026-12-30", "2027-01-02")).toBe(3);
  });

  it("renvoie null pour une chaîne qui n'est pas une date", () => {
    expect(ecartJours("2026-11-28", "pas une date")).toBeNull();
    expect(ecartJours("2026-11-28", "2026-1-5")).toBeNull();
    expect(ecartJours("", "2026-11-28")).toBeNull();
    expect(ecartJours("hier", "demain")).toBeNull();
  });
});

describe("dansFenetre", () => {
  it("inclut les bornes 0 et n", () => {
    expect(dansFenetre(0, 7)).toBe(true);
    expect(dansFenetre(7, 7)).toBe(true);
    expect(dansFenetre(3, 7)).toBe(true);
  });

  it("exclut un écart au-delà de n et un écart passé", () => {
    expect(dansFenetre(8, 7)).toBe(false);
    expect(dansFenetre(-1, 7)).toBe(false);
  });

  it("n'inclut jamais un écart inconnu (null)", () => {
    expect(dansFenetre(null, 7)).toBe(false);
    expect(dansFenetre(null, 0)).toBe(false);
  });
});
