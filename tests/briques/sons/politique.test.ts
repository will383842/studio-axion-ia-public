import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { POLITIQUE_SON_EXTRAIT, gainExtraitDb } from "../../../src/briques/sons/politique";

describe("politique du son d'un extrait incrusté", () => {
  it("est figée : toujours muet", () => {
    expect(POLITIQUE_SON_EXTRAIT).toBe("muet");
    expect(gainExtraitDb()).toBe(-Infinity);
  });
  it("source sans @/, sans Math.random ni Date.now", () => {
    const s = readFileSync(new URL("../../../src/briques/sons/politique.ts", import.meta.url), "utf8");
    expect(s).not.toMatch(/from\s+["']@\//);
    expect(s).not.toContain("Math.random");
    expect(s).not.toContain("Date.now");
  });
});
