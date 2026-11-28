import { describe, expect, it } from "vitest";
import { accepteReponseAutomatique, nomReponseALaMain } from "./reponses-auto";

describe("accepteReponseAutomatique", () => {
  it("accepte Instagram et Facebook, quelle que soit la casse ou les espaces autour", () => {
    expect(accepteReponseAutomatique("instagram")).toBe(true);
    expect(accepteReponseAutomatique("Facebook ")).toBe(true);
    expect(accepteReponseAutomatique(" Instagram ")).toBe(true);
  });

  it("refuse LinkedIn et TikTok, même avec le réglage à true", () => {
    expect(accepteReponseAutomatique("linkedin", true)).toBe(false);
    expect(accepteReponseAutomatique("LinkedIn", true)).toBe(false);
    expect(accepteReponseAutomatique("tiktok", true)).toBe(false);
    expect(accepteReponseAutomatique("TikTok", true)).toBe(false);
  });

  it("ignore le réglage pour Instagram et Facebook", () => {
    expect(accepteReponseAutomatique("instagram", false)).toBe(true);
    expect(accepteReponseAutomatique("facebook", false)).toBe(true);
  });

  it("refuse un réseau inconnu, vide, null, undefined ou non texte", () => {
    expect(accepteReponseAutomatique("pinterest")).toBe(false);
    expect(accepteReponseAutomatique("")).toBe(false);
    expect(accepteReponseAutomatique(null)).toBe(false);
    expect(accepteReponseAutomatique(undefined)).toBe(false);
    expect(accepteReponseAutomatique(42)).toBe(false);
    expect(accepteReponseAutomatique({ reseau: "instagram" })).toBe(false);
  });
});

describe("nomReponseALaMain", () => {
  it("donne le nom lisible de TikTok et de LinkedIn", () => {
    expect(nomReponseALaMain("tiktok")).toBe("TikTok");
    expect(nomReponseALaMain(" TikTok ")).toBe("TikTok");
    expect(nomReponseALaMain("linkedin")).toBe("LinkedIn");
  });

  it("renvoie null pour Instagram, Facebook et un réseau inconnu", () => {
    expect(nomReponseALaMain("instagram")).toBeNull();
    expect(nomReponseALaMain("facebook")).toBeNull();
    expect(nomReponseALaMain("pinterest")).toBeNull();
  });

  it("renvoie null pour null, undefined ou un non-texte", () => {
    expect(nomReponseALaMain(null)).toBeNull();
    expect(nomReponseALaMain(undefined)).toBeNull();
    expect(nomReponseALaMain(7)).toBeNull();
  });
});
