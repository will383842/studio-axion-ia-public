/** Lot D · étape 6 : ratio par réseau ; 16:9 (YouTube long) hors périmètre. */
import { describe, expect, it } from "vitest";
import { ratioReseau } from "@/reseaux/adaptations";

describe("ratioReseau", () => {
  it("réglage coupé : le ratio de la mère, inchangé", () => {
    expect(ratioReseau({ actif: false, origine: "machine", reseau: "instagram", disponibles: ["9:16", "4:5"], mere: "9:16" })).toBe("9:16");
  });
  it("actif : le ratio préféré du réseau s'il est disponible (Instagram 9:16 en Reels)", () => {
    expect(ratioReseau({ actif: true, origine: "machine", reseau: "instagram", disponibles: ["9:16", "4:5"], mere: "9:16" })).toBe("9:16");
  });
  it("actif : aucun ratio permis par le registre du réseau : null (pas de déclinaison), jamais un ratio refusé", () => {
    expect(ratioReseau({ actif: true, origine: "machine", reseau: "tiktok", disponibles: ["4:5"], mere: "4:5" })).toBeNull();
  });
  it("actif : même résultat null si seul le 16:9 est disponible, jamais 16:9", () => {
    expect(ratioReseau({ actif: true, origine: "machine", reseau: "instagram", disponibles: ["16:9"], mere: "16:9" })).toBeNull();
  });
  it("actif : jamais de 16:9 pour un réseau de déclinaison, même disponible", () => {
    expect(ratioReseau({ actif: true, origine: "machine", reseau: "linkedin", disponibles: ["16:9", "9:16"], mere: "16:9" })).toBe("9:16");
  });
  it("actif : ratio accepté par le réseau seulement", () => {
    expect(ratioReseau({ actif: true, origine: "machine", reseau: "youtube-shorts", disponibles: ["1:1", "9:16"], mere: "1:1" })).toBe("9:16");
  });
  it("LinkedIn reste en 9:16 par défaut (règle li-video-2026) : ratioPrefere 4:5 du registre non utilisé, pas de 4:5 silencieux", () => {
    expect(ratioReseau({ actif: true, origine: "machine", reseau: "linkedin", disponibles: ["4:5", "9:16"], mere: "9:16" })).toBe("9:16");
    expect(ratioReseau({ actif: true, origine: "machine", reseau: "linkedin", disponibles: ["4:5", "9:16"], mere: "4:5" })).toBe("9:16");
    expect(ratioReseau({ actif: true, origine: "machine", reseau: "linkedin", disponibles: ["4:5"], mere: "4:5" })).toBe("4:5");
  });
});
