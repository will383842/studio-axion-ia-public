import { describe, expect, it } from "vitest";
import { NAV_LATERALE, TUILES_PLUS } from "./navigation";

describe("navigation : « Outils motion design »", () => {
  it("apparaît dans la barre latérale et dans « Plus », avec le nom exact", () => {
    for (const liste of [NAV_LATERALE, TUILES_PLUS]) {
      const e = liste.find((x) => x.href === "/outils-motion");
      expect(e?.libelle).toBe("Outils motion design");
    }
  });
});
