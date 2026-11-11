import { describe, expect, it } from "vitest";
import { vientDePasserARelire } from "./a-relire";

describe("vientDePasserARelire (lot D)", () => {
  it("vrai seulement au passage de faux à vrai", () => {
    expect(vientDePasserARelire(false, true)).toBe(true);
    expect(vientDePasserARelire(true, true)).toBe(false);
    expect(vientDePasserARelire(true, false)).toBe(false);
    expect(vientDePasserARelire(false, false)).toBe(false);
  });
});
