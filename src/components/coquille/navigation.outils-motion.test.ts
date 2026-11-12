import { describe, expect, it } from "vitest";
import { NAV_LATERALE, TUILES_PLUS } from "./navigation";
import { pagesTrouvees } from "./pages-recherche";

describe("navigation : « Outils motion design »", () => {
  // R8a (décision de Williams, 12/11) : la recherche mène à Bibliothèque › Animations.
  it("sort du menu (barre et « Plus ») ; on le trouve par la recherche et la Bibliothèque", () => {
    for (const liste of [NAV_LATERALE, TUILES_PLUS]) expect(liste.some((x) => x.href === "/outils-motion")).toBe(false);
    const p = pagesTrouvees("motion", {}).find((x) => x.href.startsWith("/bibliotheque/animations"));
    expect(p?.libelle).toBe("Animations du studio");
  });
});
