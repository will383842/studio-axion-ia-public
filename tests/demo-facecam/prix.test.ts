import { describe, expect, it } from "vitest";
import { libellePrixDemo } from "@/domaine/demo-facecam/prix";

describe("libellePrixDemo", () => {
  it("rend le libellé français à partir des centimes", () => {
    expect(libellePrixDemo(0)).toBe("0,00 €");
    expect(libellePrixDemo(120)).toBe("1,20 €");
    expect(libellePrixDemo(1050)).toBe("10,50 €");
  });
});
