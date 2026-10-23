/**
 * X7 · Contrat figé avec l'Usine : l'indicateur « mot branché » porte aussi le compte. `motBranchePour(mot, reseau,
 * compte?)` : une ligne avec compte ne vaut que pour ce compte ; une ligne sans compte vaut pour tous les comptes du
 * réseau ; tant que le compte d'une sortie est inconnu, seule la ligne sans compte compte (la feuille « Votre vidéo »).
 */
import { describe, expect, it } from "vitest";
import * as m from "@/formats/cas-concret/mots-branches";

const LE = "2026-10-12";

describe("X7 · motBranchePour(mot, reseau, compte?)", () => {
  it("ligne avec compte : branché pour ce compte seulement ; un autre compte ou un compte inconnu : non branché", () => {
    const r = m.lireReglageMotsBranches([{ mot: "GUIDE", reseau: "facebook", compte: "williamsjullin", etat: "branche", le: LE }]);
    expect(m.motBranchePour("GUIDE", "facebook", "williamsjullin", r)).toBe(true);
    expect(m.motBranchePour("guide", "facebook", "WilliamsJullin", r)).toBe(true);
    expect(m.motBranchePour("GUIDE", "facebook", "axion-ia", r)).toBe(false);
    expect(m.motBranchePour("GUIDE", "facebook", undefined, r)).toBe(false);
    expect(m.motBranchePour("GUIDE", "facebook", r)).toBe(false);
    expect(m.branchesDuReglage(r)).toEqual({});
  });

  it("ligne sans compte : branché pour tous les comptes du réseau, et lue par la feuille", () => {
    const r = m.lireReglageMotsBranches([{ mot: "GUIDE", reseau: "instagram", etat: "branche", le: LE }]);
    expect(m.motBranchePour("GUIDE", "instagram", "williamsjullin", r)).toBe(true);
    expect(m.motBranchePour("GUIDE", "instagram", "axion-ia", r)).toBe(true);
    expect(m.motBranchePour("GUIDE", "instagram", r)).toBe(true);
    expect(m.motBranchePour("GUIDE", "facebook", r)).toBe(false);
    expect(m.branchesDuReglage(r)).toEqual({ GUIDE: ["instagram"] });
  });

  it("la ligne d'un compte l'emporte sur la ligne sans compte, pour ce compte", () => {
    const r = m.lireReglageMotsBranches([
      { mot: "IA", reseau: "facebook", etat: "branche", le: LE },
      { mot: "IA", reseau: "facebook", compte: "williamsjullin", etat: "non_branche", le: LE },
    ]);
    expect(m.motBranchePour("IA", "facebook", "williamsjullin", r)).toBe(false);
    expect(m.motBranchePour("IA", "facebook", "axion-ia", r)).toBe(true);
  });

  it("jamais sur TikTok ni LinkedIn ; lignes douteuses ignorées (compte mal formé, date absente, réseau inconnu)", () => {
    const r = m.lireReglageMotsBranches([
      { mot: "IA", reseau: "tiktok", etat: "branche", le: LE },
      { mot: "IA", reseau: "instagram", compte: "un compte", etat: "branche", le: LE },
      { mot: "IA", reseau: "facebook", etat: "branche" },
      { mot: "I A", reseau: "facebook", etat: "branche", le: LE },
    ]);
    expect(r).toEqual({});
    expect(m.motBranchePour("IA", "linkedin", "x", m.lireReglageMotsBranches([{ mot: "IA", reseau: "linkedin", etat: "branche", le: LE }]))).toBe(false);
  });

  it("avecBranchement pose une ligne de compte ; lignesDuReglage rend la forme du contrat", () => {
    const r = m.avecBranchement(m.REGLAGE_MOTS_VIDE, "guide", "facebook", { etat: "branche", le: LE }, "@WilliamsJullin");
    expect(m.lignesDuReglage(r)).toEqual([{ mot: "GUIDE", reseau: "facebook", compte: "williamsjullin", etat: "branche", le: LE }]);
    expect(() => m.avecBranchement(r, "GUIDE", "facebook", { etat: "branche", le: LE }, "un compte")).toThrow(/compte/);
    const deux = m.avecBranchement(r, "GUIDE", "instagram", { etat: "branche", le: LE });
    expect(m.lignesDuReglage(deux)).toContainEqual({ mot: "GUIDE", reseau: "instagram", etat: "branche", le: LE });
  });

  it("l'ancienne forme du réglage (mot → réseau → état) se lit comme des lignes sans compte", () => {
    const r = m.lireReglageMotsBranches({ IA: { instagram: { etat: "branche", le: LE }, "facebook@williamsjullin": { etat: "branche", le: LE } } });
    expect(m.motBranchePour("IA", "instagram", "n-importe", r)).toBe(true);
    expect(m.motBranchePour("IA", "facebook", "williamsjullin", r)).toBe(true);
    expect(m.motBranchePour("IA", "facebook", r)).toBe(false);
  });

  it("le lecteur passe le compte quand il le connaît", () => {
    const lire = m.lecteurDuReglage(m.lireReglageMotsBranches([{ mot: "IA", reseau: "facebook", compte: "williamsjullin", etat: "branche", le: LE }]));
    expect(lire("IA", "facebook", "williamsjullin")).toBe(true);
    expect(lire("IA", "facebook")).toBe(false);
    expect(m.reseauxDuMot("IA", ["facebook", "instagram"], lire)).toEqual([]);
  });
});
