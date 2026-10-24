import { describe, expect, it } from "vitest";
import { choisirVoixDuPersonnage } from "@/services/tableau-outils";

describe("choisirVoixDuPersonnage : la voix choisie par défaut passe avant la première voix prête", () => {
  const ancienne = { id: "voix-437780d799de" };
  const nouvelle = { id: "voix-ea88c134955a" };
  it("prend la voix par défaut du personnage même si une autre est listée avant (cas réel du 24/10/2026)", () => {
    expect(choisirVoixDuPersonnage([ancienne, nouvelle], { voixParDefautId: "voix-ea88c134955a" })).toBe(nouvelle);
  });
  it("sans voix par défaut, ou si elle n'est pas prête, prend la première prête (comme avant)", () => {
    expect(choisirVoixDuPersonnage([ancienne, nouvelle], {})).toBe(ancienne);
    expect(choisirVoixDuPersonnage([ancienne], { voixParDefautId: "voix-ea88c134955a" })).toBe(ancienne);
  });
  it("aucune voix prête : rien", () => {
    expect(choisirVoixDuPersonnage([], { voixParDefautId: "voix-ea88c134955a" })).toBeUndefined();
  });
});
