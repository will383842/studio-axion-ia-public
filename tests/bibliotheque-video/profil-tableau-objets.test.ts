/**
 * N-04f puis ALLUMER-OBJETS-TABLEAU-v20g : le profil « tableau animé » permet trois petits objets (gros chiffre, étape, coche).
 * Décision « ALLUMER-OBJETS-TABLEAU-v20g · Williams 20/11 (fini + gratuit) ». Modèle de l'entrée figée : `liaison-plan-scenes.test.tsx` (`entrees`).
 */
import { describe, expect, it } from "vitest";
import { ID } from "@/briques/bibliotheque-video/noms";
import { PROFIL_TABLEAU_ANIME } from "@/briques/bibliotheque-video/profils/tableau-anime";
import type { EntreeBibliotheque } from "@/briques/bibliotheque-video/types";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import { piecesPermisesDesEntrees } from "@/briques/plan-scenes-objets/pieces-permises";

const capacites = PROFIL_TABLEAU_ANIME.capacites as Record<string, { permis: boolean; maxParVideo?: number; decision?: string } | undefined>;
const TROIS = [ID.objetChiffre, ID.objetEtape, ID.objetMarque];

describe("profil tableau-anime : objets permis", () => {
  it("objet.chiffre, objet.etape, objet.marque : déclarées, permis true, maxParVideo 1", () => {
    for (const id of TROIS) {
      expect(capacites[id], id).toEqual({ permis: true, maxParVideo: 1, decision: "ALLUMER-OBJETS-TABLEAU-v20g · Williams 20/11 (fini + gratuit)" });
    }
  });

  it("objet.cartes absente ; seules les 3 capacités objet sont permises", () => {
    expect(capacites[ID.objetCartes]).toBeUndefined();
    expect(Object.entries(capacites).filter(([, c]) => c?.permis === true).map(([id]) => id).sort()).toEqual([...TROIS].sort());
  });

  it("entrée du profil → exactement les pièces des 3 objets (aucune autre capacité ouverte)", () => {
    const e: EntreeBibliotheque = { version: VERSION_BIBLIOTHEQUE, profil: PROFIL_TABLEAU_ANIME, recents: [], graine: "G", figeeLe: "2026-11-19" };
    const pieces = piecesPermisesDesEntrees({ bibliothequeVideo: e });
    for (const p of ["objet-gros-chiffre", "objet-etape", "objet-coche"]) expect(pieces).toContain(p);
    expect(pieces).not.toContain("objet-cartes-coche");
  });

  it("les deux capacités d'avant sont inchangées", () => {
    expect(capacites[ID.texteSurlignageMarqueur]).toEqual({ permis: false, maxParVideo: 1, decision: "S1, Q3" });
    expect(capacites[ID.texteStyleVarie]).toEqual({ permis: false, maxParVideo: 1, decision: "S2, Q3 (A2-11)" });
  });
});
