import { describe, expect, it } from "vitest";
import { CATALOGUE_OUTILS_MOTION, trouverOutilMotion } from "./catalogue";

describe("catalogue des outils motion design", () => {
  it("contient les dix pièces demandées, au niveau 1, sans prix", () => {
    expect(CATALOGUE_OUTILS_MOTION.map((o) => o.id)).toEqual(["curseur", "zoom", "frappe", "carte-kpi", "graphique", "tableau-de-bord", "liste-crm", "fenetre-app", "bulle-chat", "legende"]);
    for (const o of CATALOGUE_OUTILS_MOTION) {
      expect(o.niveau).toBe(1);
      expect(o.nom.length).toBeGreaterThan(0);
      expect(o.description.length).toBeGreaterThan(0);
      expect(o.description.length).toBeLessThanOrEqual(90);
      expect(`${o.nom} ${o.description}`).not.toMatch(/€|\$|prix|tarif/i);
    }
  });
  it("a des identifiants uniques et se retrouve par identifiant", () => {
    expect(new Set(CATALOGUE_OUTILS_MOTION.map((o) => o.id)).size).toBe(CATALOGUE_OUTILS_MOTION.length);
    expect(trouverOutilMotion("zoom")?.nom).toBe("Zoom");
    expect(trouverOutilMotion("inconnu")).toBeUndefined();
  });
});
