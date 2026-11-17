import { describe, expect, it } from "vitest";
import { PROFILS_DU_CODE } from "@/briques/bibliotheque-video/profils";
import type { IdCapacite } from "@/briques/bibliotheque-video/types";
import { DECLARATIONS } from "@/generateurs/declaration";

/** FIX-DECL : `consomme` de demo-facecam doit égaler exactement les capacités `permis: true` de son profil. */
describe("déclaration demo-facecam (FIX-DECL)", () => {
  const profil = PROFILS_DU_CODE["demo-facecam"];
  const permises = Object.entries(profil.capacites)
    .filter(([, v]) => v?.permis === true)
    .map(([k]) => k)
    .sort();

  it("le profil demo-facecam existe et autorise au moins une capacité", () => {
    expect(profil).toBeDefined();
    expect(permises.length).toBeGreaterThan(0);
  });

  it("consomme == capacités permis: true du profil, sans ajout ni oubli", () => {
    expect([...DECLARATIONS["demo-facecam"].consomme].sort()).toEqual(permises);
  });

  it("consomme ne contient aucun doublon ni capacité interdite par le profil", () => {
    const consomme = DECLARATIONS["demo-facecam"].consomme;
    expect(new Set(consomme).size).toBe(consomme.length);
    for (const id of consomme) expect(profil.capacites[id as IdCapacite]?.permis, id).toBe(true);
  });
});
