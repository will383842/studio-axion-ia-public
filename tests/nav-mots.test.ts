/** L'écran /mots (mot GUIDE, validation des textes, pause) doit être joignable depuis le menu. */
import { describe, expect, it } from "vitest";
import { NAV_LATERALE, TUILES_PLUS, navigationLaterale, tuilesPlusMobile, ONGLETS_BAS } from "../src/components/coquille/navigation";

describe("entrée « Messages Zernio »", () => {
  it("barre latérale : présente une seule fois, juste avant Réglages", () => {
    const menu = navigationLaterale([], true, true);
    expect(menu.filter((e) => e.href === "/mots")).toHaveLength(1);
    const i = menu.findIndex((e) => e.href === "/mots");
    expect(menu[i].libelle).toBe("Messages Zernio");
    expect(menu[i + 1].href).toBe("/reglages");
    expect(NAV_LATERALE.some((e) => e.href === "/mots")).toBe(true);
  });
  it("feuille « Plus » : tuile présente une seule fois, avant Réglages", () => {
    for (const t of [TUILES_PLUS, tuilesPlusMobile(true, true)]) {
      expect(t.filter((e) => e.href === "/mots")).toHaveLength(1);
      const i = t.findIndex((e) => e.href === "/mots");
      expect(t[i].libelle).toBe("Messages Zernio");
      expect(t[i + 1].href).toBe("/reglages");
    }
  });
  it("pas dans les onglets du bas (ils restent à 4 entrées)", () => {
    expect(ONGLETS_BAS.some((e) => e.href === "/mots")).toBe(false);
  });
});
