/** L'écran /mots (mot GUIDE, validation des textes, pause) doit être joignable depuis le menu, sous un nom compréhensible. */
import { describe, expect, it } from "vitest";
import { NAV_LATERALE, TUILES_PLUS, navigationLaterale, sectionsLaterales, tuilesPlusMobile, ONGLETS_BAS } from "../src/components/coquille/navigation";

describe("entrée « Réponses automatiques » (ex-« Messages Zernio », 08/11)", () => {
  it("barre latérale : présente une seule fois, dans « Publier et mesurer », sans le mot Zernio", () => {
    const menu = navigationLaterale([], true, true);
    expect(menu.filter((e) => e.href === "/mots")).toHaveLength(1);
    expect(menu.find((e) => e.href === "/mots")?.libelle).toBe("Réponses automatiques");
    expect(menu.some((e) => /zernio/i.test(e.libelle))).toBe(false);
    const section = sectionsLaterales(true, true).find((s) => s.entrees.some((e) => e.href === "/mots"));
    expect(section?.titre).toBe("Publier et mesurer");
    expect(NAV_LATERALE.some((e) => e.href === "/mots")).toBe(true);
  });
  it("feuille « Plus » : tuile présente une seule fois", () => {
    for (const t of [TUILES_PLUS, tuilesPlusMobile(true, true)]) {
      expect(t.filter((e) => e.href === "/mots")).toHaveLength(1);
      expect(t.find((e) => e.href === "/mots")?.libelle).toBe("Réponses automatiques");
    }
  });
  it("pas dans les onglets du bas (ils restent à 4 entrées)", () => {
    expect(ONGLETS_BAS.some((e) => e.href === "/mots")).toBe(false);
  });
});
