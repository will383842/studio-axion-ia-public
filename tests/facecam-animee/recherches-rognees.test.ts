/** Une recherche de média de plus de 60 signes est raccourcie au lieu de faire refuser tout le plan (18/10, 3 essais payés). */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { rognerRecherchesV4, RECHERCHE_MAX_V4, MOT_MAX_V4 } = await import("@/moteurs/montage-facecam-animee/realisateur/role-v4");

describe("réalisateur v4 · recherches rognées", () => {
  it("raccourcit à 60 signes, à la fin d'un mot, sans toucher au reste", () => {
    const longue = "personne qui range des dossiers sur un bureau lumineux avec un ordinateur";
    const brut = { autre: 1, elementsV4: [{ type: "a", recherches: [longue, "courte"] }, { type: "b" }] };
    const r = rognerRecherchesV4(brut) as { autre: number; elementsV4: { recherches?: string[] }[] };
    expect(r.autre).toBe(1);
    expect(r.elementsV4[0].recherches![0].length).toBeLessThanOrEqual(RECHERCHE_MAX_V4);
    expect(longue.startsWith(r.elementsV4[0].recherches![0])).toBe(true);
    expect(r.elementsV4[0].recherches![1]).toBe("courte");
    expect(r.elementsV4[1]).toEqual({ type: "b" });
  });
  it("retire les chaînes vides de « mots » et rogne les mots trop longs (18/10 : mots[0] vide, plan refusé 3 fois)", () => {
    const long = "un mot affiché beaucoup trop long pour une plaquette de la vidéo animée";
    const brut = { elementsV4: [{ type: "a", mots: ["", "  ", "garde", long], recherches: ["", "ok"] }] };
    const r = rognerRecherchesV4(brut) as { elementsV4: { mots: string[]; recherches: string[] }[] };
    expect(r.elementsV4[0].mots[0]).toBe("garde");
    expect(r.elementsV4[0].mots).toHaveLength(2);
    expect(r.elementsV4[0].mots[1].length).toBeLessThanOrEqual(MOT_MAX_V4);
    expect(r.elementsV4[0].recherches).toEqual(["ok"]);
  });
  it("laisse intact ce qui n'a pas la forme attendue", () => {
    expect(rognerRecherchesV4(null)).toBeNull();
    expect(rognerRecherchesV4("x")).toBe("x");
    expect(rognerRecherchesV4({ a: 1 })).toEqual({ a: 1 });
  });
});
