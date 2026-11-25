import { describe, expect, it } from "vitest";
import { CATALOGUE_CAPACITES } from "@/briques/bibliotheque-video/catalogue";
import type { LigneCatalogue } from "@/briques/bibliotheque-video/catalogue";
import { briquesDuMoteur } from "@/briques/bibliotheque-video/facade";
import { ID } from "@/briques/bibliotheque-video/noms";
import { profilNeutre } from "@/briques/bibliotheque-video/profils";
import type { EntreeBibliotheque, ProfilVideo, RegleProfilCapacite } from "@/briques/bibliotheque-video/types";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import { DECLARATIONS } from "@/generateurs/declaration";

// Recopié de facade.test.ts (pas d'import croisé de tests).
function entree(capacites: Partial<Record<string, RegleProfilCapacite>> = {}, verrous: string[] = []): EntreeBibliotheque {
  const base = profilNeutre("format-essai");
  const profil: ProfilVideo = { ...base, capacites: capacites as ProfilVideo["capacites"], verrous };
  return { version: VERSION_BIBLIOTHEQUE, profil, recents: [{ capacite: ID.texteStyleVarie, cle: "k0", videoId: "v0" }], graine: "G", figeeLe: "2026-11-16" };
}

const CHANTIERS_CONTROLES = /^(6|9|10)\b/;
const ETATS_NON_CONTROLES = new Set(["prevu", "absent"]);

/** Lignes des chantiers 6, 9 et 10 réellement contrôlées (ni `prevu`, ni `absent`). */
function lignesControlees(lignes: readonly LigneCatalogue[]): LigneCatalogue[] {
  return lignes.filter((l) => l.chantier !== null && CHANTIERS_CONTROLES.test(l.chantier) && !ETATS_NON_CONTROLES.has(l.etat));
}

/** Messages d'échec : pièces inscrites au catalogue mais consommées par aucun générateur. */
function horsFacade(lignes: readonly LigneCatalogue[]): string[] {
  return lignesControlees(lignes)
    .filter((l) => {
      const e = entree({ [l.id]: { permis: true } });
      return !Object.keys(DECLARATIONS).some((formatId) => {
        const r = briquesDuMoteur(formatId, { bibliothequeVideo: e });
        return r.bibliotheque && r.permises.includes(l.id);
      });
    })
    .map((l) => l.id);
}

const ligne = (id: LigneCatalogue["id"], etat: LigneCatalogue["etat"], chantier: string | null): LigneCatalogue => ({ id, etat, chantier });

describe("liaison catalogue → façade (N-01a)", () => {
  it("catalogue réel : aucune pièce des chantiers 6, 9, 10 inscrite sans être consommée", () => {
    const hors = horsFacade(CATALOGUE_CAPACITES);
    expect(hors, hors.map((id) => `${id} est inscrite au catalogue mais aucun générateur ne la consomme (déclaration)`).join("\n")).toEqual([]);
  });

  it("la garde mord : objet.trait éteint (chantier 9) sans consommateur est listé", () => {
    expect(horsFacade([ligne(ID.objetTrait, "eteint", "9")])).toEqual(["objet.trait"]);
  });

  it("la garde mord : transition commune en prod (chantier 6 (H1 à H4)) sans consommateur est listée", () => {
    expect(horsFacade([ligne(ID.transitionCommune, "prod", "6 (H1 à H4)")])).toEqual([ID.transitionCommune]);
  });

  it("témoin positif : le plan de scènes cas concret (consommé) n'est pas listé", () => {
    expect(horsFacade([ligne(ID.planScenesCasConcret, "eteint", "9")])).toEqual([]);
  });

  it("jamais listées : prevu, absent, chantier null, autre chantier", () => {
    expect(horsFacade([
      ligne(ID.objetChiffre, "prevu", "9"),
      ligne(ID.objetChiffre, "absent", "9"),
      ligne(ID.objetChiffre, "eteint", null),
      ligne(ID.objetChiffre, "eteint", "11"),
      ligne(ID.objetChiffre, "eteint", "60"),
    ])).toEqual([]);
  });

  it("le chantier 10 est contrôlé comme 6 et 9", () => {
    expect(horsFacade([ligne(ID.objetTrait, "eteint", "10")])).toEqual(["objet.trait"]);
  });
});
