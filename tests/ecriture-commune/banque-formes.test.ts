/** C1.3 : banque de formes décrites (pas de phrases toutes faites), au moins 5 par rôle et par réseau. */
import { describe, expect, it } from "vitest";
import { BANQUE_FORMES, ROLES_FORME, formesDuRole, tirerForme } from "@/domaine/ecriture-commune/banque-formes";
import { RESEAUX_DECLINAISON } from "@/reseaux/codes";

describe("banque de formes", () => {
  it("couvre les 8 éléments de la recette", () => {
    expect([...ROLES_FORME]).toEqual(["accroche", "douleur", "question", "promesse", "mecanisme", "preuve", "rupture", "appel"]);
  });
  for (const role of ROLES_FORME) {
    it(`${role} : au moins 5 formes, au moins 5 par réseau de déclinaison`, () => {
      expect(formesDuRole(role).length).toBeGreaterThanOrEqual(5);
      for (const r of RESEAUX_DECLINAISON) expect(formesDuRole(role, r).length).toBeGreaterThanOrEqual(5);
    });
  }
  it("identifiants uniques, descriptions écrites, réseaux valides", () => {
    const ids = BANQUE_FORMES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of BANQUE_FORMES) {
      expect(f.description.length).toBeGreaterThan(30);
      expect(f.reseaux.length).toBeGreaterThan(0);
      for (const r of f.reseaux) expect(RESEAUX_DECLINAISON).toContain(r);
    }
  });
  it("la consigne « quand » est du français correct (pas « à quel moment la dernière fois »)", () => {
    const f = BANQUE_FORMES.find((x) => x.id === "question-quand");
    expect(f?.description).toContain("à quand remonte la dernière fois");
    expect(f?.description).not.toContain("à quel moment la dernière fois");
  });
  it("jamais « Villeexemple » ni « Aucun gain garanti », jamais « faites-le vous-même »", () => {
    const tout = BANQUE_FORMES.map((f) => `${f.nom} ${f.description}`).join(" ").toLowerCase();
    expect(tout).not.toContain("villeexemple");
    expect(tout).not.toContain("aucun gain garanti");
    expect(tout).not.toMatch(/faites-le vous-m[eê]me/);
  });
  it("tirerForme évite les récents et respecte le réseau", () => {
    const formes = formesDuRole("accroche", "linkedin");
    const recents = formes.slice(0, formes.length - 1).map((f) => f.id);
    for (let i = 0; i < 20; i++) {
      const t = tirerForme("accroche", "linkedin", recents, `g${i}`);
      expect(t.id).toBe(formes[formes.length - 1].id);
      expect(t.reseaux).toContain("linkedin");
    }
  });
});
