import { describe, expect, it } from "vitest";
import {
  partDessinsCommuns,
  proposerStructure,
  resumeVisuelDepuisFiche,
  ressemblanceAccroches,
  verifierVarieteVisuelle,
  type ResumeVisuel,
} from "../../../src/briques/variete";
import type { FicheScenes as Fiche } from "../../../src/briques/fiche-scenes";

const S = ["erreur-corrigee", "avant-apres", "demonstration", "question-abonne"];
const v = (structure: string, dessins: string[], accroche: string, format = "f"): ResumeVisuel => ({ structure, dessins, accroche, format });
const neuve = v("demonstration", ["d1", "d2", "d3", "d4"], "Trois gestes pour trier votre boîte mail");
const dix = (): ResumeVisuel[] =>
  Array.from({ length: 10 }, (_, i) => v(i % 2 ? "avant-apres" : "erreur-corrigee", [`x${i}a`, `x${i}b`], `Accroche numéro ${i} très différente ${"z".repeat(i)}`));

describe("variété visuelle", () => {
  it("accepte une vidéo différente et propose une structure", () => {
    const r = verifierVarieteVisuelle(neuve, dix(), { structuresPossibles: S });
    expect(r.accepte).toBe(true);
    expect(r.refus).toEqual([]);
    expect(r.proposition).toBe("demonstration");
  });

  it("refuse la structure de l'une des 2 dernières vidéos, mais pas de la 3e", () => {
    const h = [v("avant-apres", ["a"], "un"), v("erreur-corrigee", ["b"], "deux"), v("demonstration", ["c"], "trois")];
    const r1 = verifierVarieteVisuelle(v("erreur-corrigee", [], "x"), h, { structuresPossibles: S });
    expect(r1.accepte).toBe(false);
    expect(r1.refus.map((x) => x.regle)).toEqual(["structure"]);
    expect(r1.refus[0]!.message).toContain("erreur corrigee");
    expect(r1.proposition).toBe("question-abonne");
    expect(verifierVarieteVisuelle(v("demonstration", [], "x"), h, { structuresPossibles: S }).accepte).toBe(true);
  });

  it("refuse des dessins répétés au seuil, et le seuil est réglable", () => {
    const h = [v("avant-apres", ["d1", "d2", "d3", "z"], "autre chose"), ...dix().slice(1)];
    const r = verifierVarieteVisuelle(neuve, h, { structuresPossibles: S });
    expect(r.refus.map((x) => x.regle)).toEqual(["dessins"]); // 3 sur 4 = 75 % ≥ 60 %
    expect(r.refus[0]!.message).toContain("75 %");
    const souple = verifierVarieteVisuelle(neuve, h, { structuresPossibles: S, seuils: { dessinsCommunsMax: 0.9 } });
    expect(souple.accepte).toBe(true);
    const exact = verifierVarieteVisuelle(neuve, h, { structuresPossibles: S, seuils: { dessinsCommunsMax: 0.75 } });
    expect(exact.accepte).toBe(false);
  });

  it("refuse une accroche trop proche, sans tenir compte des accents ni de la casse", () => {
    const h = [v("avant-apres", ["q"], "TROIS gestes pour trier votre boîte mail !"), ...dix().slice(1)];
    const r = verifierVarieteVisuelle(neuve, h, { structuresPossibles: S });
    expect(r.refus.map((x) => x.regle)).toEqual(["accroche"]);
    expect(r.refus[0]!.message).toContain("100 %");
  });

  it("ne lit que les 10 dernières vidéos et que le même format", () => {
    const h = [...dix(), v("demonstration", ["d1", "d2", "d3", "d4"], "Trois gestes pour trier votre boîte mail")];
    expect(verifierVarieteVisuelle(neuve, h, { structuresPossibles: S }).accepte).toBe(true); // 11e ignorée
    const autre = [v("demonstration", ["d1", "d2", "d3", "d4"], neuve.accroche, "autre")];
    expect(verifierVarieteVisuelle(neuve, autre, { structuresPossibles: S }).accepte).toBe(true);
  });

  it("cumule les refus", () => {
    const h = [v("demonstration", ["d1", "d2", "d3", "d4"], neuve.accroche)];
    expect(verifierVarieteVisuelle(neuve, h, { structuresPossibles: S }).refus.map((x) => x.regle)).toEqual(["structure", "dessins", "accroche"]);
  });

  it("la levée motivée accepte en gardant les refus ; un motif vide ne lève rien", () => {
    const h = [v("demonstration", ["d1", "d2", "d3", "d4"], neuve.accroche)];
    const ok = verifierVarieteVisuelle(neuve, h, { structuresPossibles: S, levee: { motif: "  Série voulue ainsi  ", auteur: "Will" } });
    expect(ok).toMatchObject({ accepte: true, leve: true, motifLevee: "Série voulue ainsi" });
    expect(ok.refus).toHaveLength(3);
    const vide = verifierVarieteVisuelle(neuve, h, { structuresPossibles: S, levee: { motif: "   " } });
    expect(vide).toMatchObject({ accepte: false, leve: false });
    expect(vide.motifLevee).toBeUndefined();
    // Rien à lever : pas de levée affichée.
    expect(verifierVarieteVisuelle(neuve, [], { structuresPossibles: S, levee: { motif: "x" } }).leve).toBe(false);
  });

  it("propose la structure la moins utilisée, puis la plus ancienne, jamais celle des 2 dernières", () => {
    const h = [v("a", [], ""), v("b", [], ""), v("c", [], ""), v("c", [], ""), v("d", [], "")];
    expect(proposerStructure(h, ["a", "b", "c", "d", "e"], 2)).toBe("e"); // jamais utilisée
    expect(proposerStructure(h, ["a", "b", "c", "d"], 2)).toBe("d"); // 1 emploi, la plus ancienne
    expect(proposerStructure(h, ["a", "b"], 2)).toBeNull();
    expect(proposerStructure([], ["a", "b"], 2)).toBe("a");
  });

  it("noms lisibles et mesures de base", () => {
    const r = verifierVarieteVisuelle(v("avant-apres", [], "x"), [v("avant-apres", [], "y")], {
      structuresPossibles: S,
      nomsLisibles: { "avant-apres": "Avant / après" },
    });
    expect(r.refus[0]!.message).toContain("« Avant / après »");
    expect(ressemblanceAccroches("", "")).toBe(0);
    expect(partDessinsCommuns([], ["a"])).toBe(0);
    expect(partDessinsCommuns(["a", "a", "b"], ["a"])).toBe(0.5);
  });
});

describe("résumé depuis une fiche de scènes", () => {
  const fiche = {
    version: "fiche-scenes/1",
    formatId: "fmt",
    videoId: "v1",
    versionId: "r1",
    habillage: "h",
    stylo: "s",
    ratio: "9:16",
    structure: "avant-apres",
    serie: { code: "S", nom: "Série" },
    douleur: "d",
    gesteMinute: "g",
    appelId: null,
    scenes: [
      { id: "s01", role: "accroche", page: 1, texteDit: "Dit en scène un", elements: [{ type: "ligne", texte: "Stop aux" }, { type: "ligne", texte: "mails perdus" }, { type: "dessin", dessinId: "d1" }] },
      { id: "s02", role: "etape", page: 1, texteDit: "suite", elements: [{ type: "dessin", dessinId: "d2" }, { type: "chiffre", valeur: "3" }, 42, null] },
    ],
  } as unknown as Fiche;

  it("tire structure, dessins, accroche et format", () => {
    expect(resumeVisuelDepuisFiche(fiche)).toEqual({ structure: "avant-apres", dessins: ["d1", "d2"], accroche: "Stop aux mails perdus", format: "fmt" });
  });

  it("à défaut de ligne, l'accroche est le texte dit ; fiche sans scène sans plantage", () => {
    const sansLigne = { ...fiche, scenes: [{ ...fiche.scenes[0]!, elements: [] }] } as Fiche;
    expect(resumeVisuelDepuisFiche(sansLigne).accroche).toBe("Dit en scène un");
    expect(resumeVisuelDepuisFiche({ ...fiche, scenes: [] } as Fiche)).toMatchObject({ accroche: "", dessins: [] });
  });
});
