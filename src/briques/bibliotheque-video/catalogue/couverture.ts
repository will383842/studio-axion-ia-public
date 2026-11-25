/** Catalogue des capacités : lignes du chantier C11 (pièces de texte). Aucune n'est permise par un profil. */
import { ID } from "../noms";
import type { LigneCatalogue } from "./types";

export const LIGNES_COUVERTURE: readonly LigneCatalogue[] = Object.freeze([
  { id: ID.texteMarquesAuMot, etat: "eteint", chantier: "11", note: "branchée, porte éteinte" },
  { id: ID.texteSelectif, etat: "eteint", chantier: "11", note: "branchée (porte texte.selectif), éteinte" },
  { id: ID.texteModeCarte, etat: "prevu", chantier: "11", note: "porte éteinte" },
  { id: ID.texteEffets, etat: "prevu", chantier: "11", note: "livrée, non branchée" },
  { id: ID.texteAccentsRole, etat: "prevu", chantier: "11", note: "porte éteinte, rien ne l'importe" },
] satisfies LigneCatalogue[]);
