/**
 * N-04f : le profil « tableau animé » déclare trois petits objets possibles (gros chiffre, étape, coche), tous FERMÉS.
 * Éteint = identique : aucune pièce d'objet n'est permise. Modèle de l'entrée figée : `liaison-plan-scenes.test.tsx` (`entrees`).
 */
import { describe, expect, it } from "vitest";
import { ID } from "@/briques/bibliotheque-video/noms";
import { PROFIL_TABLEAU_ANIME } from "@/briques/bibliotheque-video/profils/tableau-anime";
import type { EntreeBibliotheque } from "@/briques/bibliotheque-video/types";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import { piecesPermisesDesEntrees } from "@/briques/plan-scenes-objets/pieces-permises";

const capacites = PROFIL_TABLEAU_ANIME.capacites as Record<string, { permis: boolean; maxParVideo?: number; decision?: string } | undefined>;

describe("profil tableau-anime : objets déclarés fermés", () => {
  it("objet.chiffre, objet.etape, objet.marque : déclarées, permis false, maxParVideo 1", () => {
    for (const id of [ID.objetChiffre, ID.objetEtape, ID.objetMarque]) {
      expect(capacites[id], id).toEqual({ permis: false, maxParVideo: 1, decision: "N-04 (allumage = Williams)" });
    }
  });

  it("objet.cartes absente ; aucune capacité du profil n'est permise", () => {
    expect(capacites[ID.objetCartes]).toBeUndefined();
    expect(Object.values(capacites).filter((c) => c?.permis === true)).toEqual([]);
  });

  it("éteint = identique : aucune pièce d'objet permise par l'entrée figée du profil", () => {
    const e: EntreeBibliotheque = { version: VERSION_BIBLIOTHEQUE, profil: PROFIL_TABLEAU_ANIME, recents: [], graine: "G", figeeLe: "2026-11-19" };
    expect(piecesPermisesDesEntrees({ bibliothequeVideo: e })).toEqual([]);
  });

  it("les deux capacités d'avant sont inchangées", () => {
    expect(capacites[ID.texteSurlignageMarqueur]).toEqual({ permis: false, maxParVideo: 1, decision: "S1, Q3" });
    expect(capacites[ID.texteStyleVarie]).toEqual({ permis: false, maxParVideo: 1, decision: "S2, Q3 (A2-11)" });
  });
});
