/** FIX-CALAGE-CHIFFRES-v20h : un chiffre seul (« 3 ») retrouve le mot dit (« trois »). */
import { describe, expect, it } from "vitest";
import { instantDit, motsCles, type MotCalage } from "../../../src/briques/motion/calage";

const mot = (m: string, debutSec: number): MotCalage => ({ mot: m, debutSec, finSec: debutSec + 0.3 });

describe("chiffre seul", () => {
  it("instantDit(« 3 ») se cale sur « trois »", () => {
    expect(instantDit("3", [mot("trois", 4)], 0)).toBe(4);
  });
  it("motsCles garde le chiffre seul", () => {
    expect(motsCles("3 étapes")).toContain("3");
  });
  it("écarte toujours une lettre seule non chiffre", () => {
    expect(motsCles("a l b")).toEqual([]);
  });
  it("garde « 12 » et « douze », et un mot absent reste indéfini", () => {
    expect(instantDit("12", [mot("douze", 2)], 0)).toBe(2);
    expect(instantDit("3", [mot("autre", 2)], 0)).toBeUndefined();
  });
});
