import { describe, it, expect } from "vitest";
import { memoireAvecVoisines } from "@/services/variete-commune/cartes-voisines";
import { empreinteCartes } from "@/services/variete-commune/empreintes-b";
import type { EmpreinteVideo } from "@/briques/variete-commune/types";

const cartes = (id: string, le: string, modeles: string[], format = "montage-avocat") =>
  empreinteCartes(id, le, format, modeles.map((modele, i) => ({ modele, debutSec: i })));
const tableau: EmpreinteVideo = { version: "1", videoId: "t1", formatId: "tableau", le: "2026-11-16", axes: { objets: ["autre:tableau:grille"], ouverture: ["autre:tableau:x"] } };

describe("memoireAvecVoisines (X2-13a)", () => {
  it("voisines vides : égal en profondeur à la mémoire", () => {
    const m = { dejaServis: ["a", "b"], ouverturePrecedente: "a" };
    expect(memoireAvecVoisines(m, [])).toEqual(m);
    expect(memoireAvecVoisines({ dejaServis: [] }, [])).toEqual({ dejaServis: [] });
    expect("ouverturePrecedente" in memoireAvecVoisines({ dejaServis: [] }, [])).toBe(false);
  });
  it("une voisine avocat avec la carte chiffre : chiffre dans dejaServis, après ceux d'aujourd'hui", () => {
    const r = memoireAvecVoisines({ dejaServis: ["a"] }, [cartes("v1", "2026-11-15", ["chiffre"])]);
    expect(r.dejaServis).toEqual(["a", "chiffre"]);
  });
  it("plus récente d'abord, sans doublon", () => {
    const r = memoireAvecVoisines({ dejaServis: ["a"] }, [cartes("v1", "2026-11-10", ["x"]), cartes("v2", "2026-11-15", ["y", "a"])]);
    expect(r.dejaServis).toEqual(["a", "y", "x"]);
  });
  it("plafond 40", () => {
    const m = { dejaServis: Array.from({ length: 30 }, (_, i) => `m${i}`) };
    const v = cartes("v1", "2026-11-15", Array.from({ length: 30 }, (_, i) => `n${String(i).padStart(2, "0")}`));
    const r = memoireAvecVoisines(m, [v]);
    expect(r.dejaServis).toHaveLength(40);
    expect(r.dejaServis.slice(0, 30)).toEqual(m.dejaServis);
  });
  it("une voisine sans carte est ignorée", () => {
    const m = { dejaServis: ["a"], ouverturePrecedente: "a" };
    expect(memoireAvecVoisines(m, [tableau])).toEqual(m);
  });
  it("ouverture : la voisine plus récente gagne, sinon celle d'aujourd'hui", () => {
    const v = cartes("v1", "2026-11-15", ["chiffre", "autre"]);
    expect(memoireAvecVoisines({ dejaServis: [], ouverturePrecedente: "a" }, [v], "2026-11-14").ouverturePrecedente).toBe("chiffre");
    expect(memoireAvecVoisines({ dejaServis: [], ouverturePrecedente: "a" }, [v], "2026-11-16").ouverturePrecedente).toBe("a");
    expect(memoireAvecVoisines({ dejaServis: [] }, [v]).ouverturePrecedente).toBe("chiffre");
    expect(memoireAvecVoisines({ dejaServis: [], ouverturePrecedente: "a" }, [v]).ouverturePrecedente).toBe("a");
  });
  it("entrée non modifiée (gel) et déterministe", () => {
    const m = Object.freeze({ dejaServis: Object.freeze(["a"]) as unknown as string[], ouverturePrecedente: "a" });
    const vs = Object.freeze([cartes("v1", "2026-11-15", ["z"])]);
    const r1 = memoireAvecVoisines(m, vs, "2026-11-01");
    expect(memoireAvecVoisines(m, vs, "2026-11-01")).toEqual(r1);
    expect(m.dejaServis).toEqual(["a"]);
  });
});
