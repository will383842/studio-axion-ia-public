import { describe, expect, it } from "vitest";
import { accepteReponseAutomatique, nomReponseALaMain } from "./reponses-auto";

describe("accepteReponseAutomatique (CAL-04)", () => {
  it("accepte Instagram et Facebook, insensible à la casse et aux espaces", () => {
    expect(accepteReponseAutomatique("instagram")).toBe(true);
    expect(accepteReponseAutomatique("Facebook ")).toBe(true);
    expect(accepteReponseAutomatique(" Instagram ")).toBe(true);
  });

  it("refuse LinkedIn et TikTok même avec le réglage à true", () => {
    expect(accepteReponseAutomatique("linkedin", true)).toBe(false);
    expect(accepteReponseAutomatique("tiktok", true)).toBe(false);
  });

  it("refuse les réseaux inconnus", () => {
    expect(accepteReponseAutomatique("myspace")).toBe(false);
    expect(accepteReponseAutomatique("")).toBe(false);
  });

  it("refuse null et les valeurs non textuelles", () => {
    expect(accepteReponseAutomatique(null)).toBe(false);
    expect(accepteReponseAutomatique(undefined)).toBe(false);
    expect(accepteReponseAutomatique(42)).toBe(false);
    expect(accepteReponseAutomatique({})).toBe(false);
  });
});

describe("nomReponseALaMain (CAL-04)", () => {
  it("rend le nom lisible de LinkedIn et TikTok", () => {
    expect(nomReponseALaMain("tiktok")).toBe("TikTok");
    expect(nomReponseALaMain(" LinkedIn ")).toBe("LinkedIn");
  });

  it("rend null pour un réseau à réponse auto ou inconnu", () => {
    expect(nomReponseALaMain("instagram")).toBeNull();
    expect(nomReponseALaMain("myspace")).toBeNull();
  });

  it("rend null pour null et les valeurs non textuelles", () => {
    expect(nomReponseALaMain(null)).toBeNull();
    expect(nomReponseALaMain(undefined)).toBeNull();
    expect(nomReponseALaMain(42)).toBeNull();
  });
});
