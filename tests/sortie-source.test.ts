/** L1-03 · source d'une sortie : exactement une vidéo ou un visuel (jamais les deux, jamais aucun). */
import { describe, expect, it } from "vitest";
import { sourceDe } from "@/domaine/types";
import { sourceDeSortie } from "@/domaine/sortie-source";

describe("L1-03 · sourceDeSortie", () => {
  it("lit une sortie de vidéo", () => {
    expect(sourceDeSortie({ videoId: "v1" })).toEqual({ famille: "video", videoId: "v1" });
  });
  it("lit une sortie de visuel", () => {
    expect(sourceDeSortie({ visuelId: "x1" })).toEqual({ famille: "visuel", visuelId: "x1" });
  });
  it("refuse les deux à la fois", () => {
    expect(() => sourceDeSortie({ videoId: "v1", visuelId: "x1" })).toThrow();
  });
  it("refuse aucun", () => {
    expect(() => sourceDeSortie({})).toThrow();
    expect(() => sourceDeSortie({ videoId: "", visuelId: "" })).toThrow();
  });
  it("délègue à sourceDe : une seule règle, même résultat et même erreur", () => {
    expect(sourceDeSortie).toBe(sourceDe);
    for (const e of [{ videoId: "v1" }, { visuelId: "x1" }]) expect(sourceDeSortie(e)).toEqual(sourceDe(e));
    expect(() => sourceDeSortie({})).toThrow(/source unique/);
  });
});
