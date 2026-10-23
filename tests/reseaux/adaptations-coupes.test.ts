/** Lot D · étape 3 : coupe du segment facultatif par réseau (fonction pure). */
import { describe, expect, it } from "vitest";
import { segmentsFacultatifsRetenus } from "@/reseaux/adaptations";

const segs = [
  { id: "f1", dureeSec: 6 },
  { id: "f2", dureeSec: 5 },
];

describe("segmentsFacultatifsRetenus", () => {
  it("réglage coupé : tout est gardé, sur tout réseau", () => {
    for (const r of ["tiktok", "linkedin", "instagram", "facebook", "youtube-shorts"] as const) {
      expect(segmentsFacultatifsRetenus({ actif: false, origine: "machine", reseau: r, dureeSansFacultatifSec: 30, facultatifs: segs })).toEqual(["f1", "f2"]);
    }
  });
  it("actif : un réseau qui n'accepte pas le facultatif les coupe tous (TikTok)", () => {
    expect(segmentsFacultatifsRetenus({ actif: true, origine: "machine", reseau: "tiktok", dureeSansFacultatifSec: 20, facultatifs: segs })).toEqual([]);
  });
  it("actif : LinkedIn (zone 32-60) garde ce qui tient sous le plafond de la zone, dans l'ordre", () => {
    expect(segmentsFacultatifsRetenus({ actif: true, origine: "machine", reseau: "linkedin", dureeSansFacultatifSec: 30, facultatifs: segs })).toEqual(["f1", "f2"]);
    expect(segmentsFacultatifsRetenus({ actif: true, origine: "machine", reseau: "linkedin", dureeSansFacultatifSec: 52, facultatifs: segs })).toEqual(["f1"]);
    expect(segmentsFacultatifsRetenus({ actif: true, origine: "machine", reseau: "linkedin", dureeSansFacultatifSec: 58, facultatifs: segs })).toEqual([]);
  });
  it("jamais de coupe sur le corps : sans facultatif, liste vide", () => {
    expect(segmentsFacultatifsRetenus({ actif: true, origine: "machine", reseau: "linkedin", dureeSansFacultatifSec: 30, facultatifs: [] })).toEqual([]);
  });
});
