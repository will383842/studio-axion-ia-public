import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ORIGINES_AVANT_PUBLICATION,
  plageProposableAvantPublication,
  plagesProposables,
} from "@/briques/archive-extraits/attente-publication";
import type { FicheSourceExtraits, PlageExtrait } from "@/domaine/archive-extraits";

function plage(id: string, p: Partial<PlageExtrait> = {}): PlageExtrait {
  return {
    id,
    debutSec: 0,
    finSec: 5,
    texte: "",
    motsCles: [],
    avecVisage: false,
    texteIncruste: false,
    etat: "utilisable",
    origine: "capture-cas",
    ...p,
  };
}

function fiche(plages: PlageExtrait[], attentePublication?: boolean): FicheSourceExtraits {
  const f = {
    videoId: "v1",
    versionId: "ver1",
    sortieId: "s1",
    ratio: "9:16",
    licence: {},
    famille: [],
    plages,
    rangee: true,
    sourcePreferee: true,
  } as unknown as FicheSourceExtraits;
  if (attentePublication !== undefined) f.attentePublication = attentePublication;
  return f;
}

describe("attente-publication (X4-11a)", () => {
  it("liste gelée des origines", () => {
    expect([...ORIGINES_AVANT_PUBLICATION]).toEqual(["ecran-demo", "capture-cas", "scene"]);
    expect(Object.isFrozen(ORIGINES_AVANT_PUBLICATION)).toBe(true);
  });

  it("sans attentePublication : plages utilisables inchangées (mêmes objets, même ordre)", () => {
    const plages = [
      plage("a", { origine: "parole", avecVisage: true }),
      plage("b", { etat: "ecartee" }),
      plage("c", { origine: undefined, texteIncruste: true }),
    ];
    const r = plagesProposables(fiche(plages));
    expect(r).toEqual(plages.filter((p) => p.etat === "utilisable"));
    expect(r[0]).toBe(plages[0]);
    expect(r[1]).toBe(plages[2]);
    expect(plagesProposables(fiche(plages, false))).toEqual(r);
  });

  it("en attente : exclut parole, texte incrusté, visage, origine absente", () => {
    const plages = [
      plage("parle", { origine: "parole" }),
      plage("capture"),
      plage("texte", { texteIncruste: true }),
      plage("scene-visage", { origine: "scene", avecVisage: true }),
      plage("sans-origine", { origine: undefined }),
      plage("scene-ok", { origine: "scene" }),
      plage("demo", { origine: "ecran-demo" }),
    ];
    const r = plagesProposables(fiche(plages, true));
    expect(r.map((p) => p.id)).toEqual(["capture", "scene-ok", "demo"]);
    expect(r[0]).toBe(plages[1]);
  });

  it("une plage écartée n'est jamais proposée", () => {
    const p = plage("x", { etat: "ecartee" });
    expect(plageProposableAvantPublication(p)).toBe(false);
    expect(plagesProposables(fiche([p], true))).toEqual([]);
    expect(plagesProposables(fiche([p]))).toEqual([]);
  });

  it("entrée gelée non modifiée", () => {
    const plages = [Object.freeze(plage("a")), Object.freeze(plage("b", { origine: "parole" }))];
    const f = Object.freeze(fiche(Object.freeze(plages) as PlageExtrait[], true));
    expect(() => plagesProposables(f)).not.toThrow();
    expect(plagesProposables(f).map((p) => p.id)).toEqual(["a"]);
  });

  it("aucun import de @/services", () => {
    const src = readFileSync(join(process.cwd(), "src/briques/archive-extraits/attente-publication.ts"), "utf8");
    expect(src).not.toMatch(/@\/services/);
  });
});
