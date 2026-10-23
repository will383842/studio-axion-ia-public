/** Lot D · relecture Opus : un script collé par Will (origine « will ») est pris à l'identique, réglage allumé ou non. */
import { describe, expect, it } from "vitest";
import { boucleVisuelle, habillageReseau, ordreScript, ratioReseau, segmentsFacultatifsRetenus, vitesseVoix } from "@/reseaux/adaptations";

const RESEAUX = ["tiktok", "instagram", "facebook", "linkedin", "youtube-shorts"] as const;
const segs = [
  { id: "f1", dureeSec: 6 },
  { id: "f2", dureeSec: 5 },
];

describe("origine « will » : identité sur chaque fonction, réglage allumé", () => {
  it("segmentsFacultatifsRetenus : la liste reçue, sans coupe de plafond", () => {
    expect(segmentsFacultatifsRetenus({ actif: true, origine: "will", reseau: "linkedin", dureeSansFacultatifSec: 58, facultatifs: segs })).toEqual(["f1", "f2"]);
    expect(segmentsFacultatifsRetenus({ actif: true, origine: "will", reseau: "tiktok", dureeSansFacultatifSec: 20, facultatifs: segs })).toEqual(["f1", "f2"]);
    expect(segmentsFacultatifsRetenus({ actif: true, origine: "machine", reseau: "linkedin", dureeSansFacultatifSec: 58, facultatifs: segs })).toEqual([]);
  });
  it("boucleVisuelle : rien ajouté", () => {
    for (const r of RESEAUX) expect(boucleVisuelle({ actif: true, origine: "will", reseau: r, typeAppel: "envoi" })).toBeNull();
    expect(boucleVisuelle({ actif: true, origine: "machine", reseau: "tiktok", typeAppel: "envoi" })).toBe(true);
  });
  it("habillageReseau : aucune adaptation (null)", () => {
    for (const r of RESEAUX) expect(habillageReseau({ actif: true, origine: "will", reseau: r, ratio: "9:16" })).toBeNull();
    expect(habillageReseau({ actif: true, origine: "machine", reseau: "tiktok", ratio: "9:16" })).not.toBeNull();
  });
  it("ratioReseau : le ratio de la mère, même s'il n'est pas le préféré du réseau", () => {
    expect(ratioReseau({ actif: true, origine: "will", reseau: "instagram", disponibles: ["9:16", "4:5"], mere: "4:5" })).toBe("4:5");
    expect(ratioReseau({ actif: true, origine: "machine", reseau: "instagram", disponibles: ["9:16", "4:5"], mere: "4:5" })).toBe("9:16");
  });
  it("vitesseVoix et ordreScript : identité, quelle que soit l'origine", () => {
    for (const origine of ["will", "machine"] as const) {
      expect(vitesseVoix({ actif: true, origine, reseau: "tiktok" })).toBe(1);
      expect(ordreScript({ actif: true, origine, ordre: ["a", "b"] })).toEqual(["a", "b"]);
    }
  });
});
