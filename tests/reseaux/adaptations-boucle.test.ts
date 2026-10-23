/** Lot D · étape 4 : boucle visuelle (la fin rejoint l'accroche) par réseau. */
import { describe, expect, it } from "vitest";
import { boucleVisuelle } from "@/reseaux/adaptations";

describe("boucleVisuelle", () => {
  it("réglage coupé : null (rien à changer), pas false", () => {
    expect(boucleVisuelle({ actif: false, origine: "machine", reseau: "tiktok", typeAppel: "envoi" })).toBeNull();
  });
  it("actif : oui sur TikTok, Instagram, Shorts", () => {
    for (const r of ["tiktok", "instagram", "youtube-shorts"] as const) expect(boucleVisuelle({ actif: true, origine: "machine", reseau: r, typeAppel: "envoi" })).toBe(true);
  });
  it("actif : non sur LinkedIn", () => {
    expect(boucleVisuelle({ actif: true, origine: "machine", reseau: "linkedin", typeAppel: "envoi" })).toBe(false);
  });
  it("actif : Facebook, sauf après une question d'expert", () => {
    expect(boucleVisuelle({ actif: true, origine: "machine", reseau: "facebook", typeAppel: "envoi" })).toBe(true);
    expect(boucleVisuelle({ actif: true, origine: "machine", reseau: "facebook", typeAppel: "question-expert" })).toBe(false);
  });
});
