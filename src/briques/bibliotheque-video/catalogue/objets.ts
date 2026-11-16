/** Catalogue des capacités : lignes du chantier 9 (C9-03). 12 lignes `prevu`, jamais permises par un profil. */
import { ID } from "../noms";
import type { LigneCatalogue } from "./types";

export const LIGNES_OBJETS: readonly LigneCatalogue[] = Object.freeze([
  { id: ID.objetTrait, etat: "prevu", chantier: "9", decision: "D3 § C" },
  { id: ID.objetMarque, etat: "prevu", chantier: "9", decision: "D3 § C" },
  { id: ID.objetEtiquette, etat: "prevu", chantier: "9", decision: "D3 § C" },
  { id: ID.objetAppel, etat: "prevu", chantier: "9", decision: "D3 § C" },
  { id: ID.objetChiffre, etat: "prevu", chantier: "9", decision: "D3 § C" },
  { id: ID.objetEtape, etat: "prevu", chantier: "9", decision: "D3 § C" },
  { id: ID.objetCartes, etat: "prevu", chantier: "9", decision: "D3 § C" },
  { id: ID.objetSchema, etat: "prevu", chantier: "9", decision: "D3 § C" },
  { id: ID.objetEcran, etat: "prevu", chantier: "9", decision: "D3 § C" },
  { id: ID.objetReseauSchema, etat: "prevu", chantier: "9", decision: "D3 § C" },
  { id: ID.objetManuscrit, etat: "prevu", chantier: "9", decision: "D3 § C" },
  { id: ID.objetEmoji, etat: "prevu", chantier: "9", decision: "D3 § C", note: "attend W-K / W-14" },
]);
