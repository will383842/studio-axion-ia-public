/** Catalogue des capacités : lignes du chantier 10 (C10-15). Livrées mais non branchées : `prevu`, jamais permises. */
import { ID } from "../noms";
import type { LigneCatalogue } from "./types";

export const LIGNES_FINITION: readonly LigneCatalogue[] = Object.freeze([
  { id: ID.accrocheScript, etat: "prevu", chantier: "10", note: "branchée éteinte, aucune déclaration de générateur ne la consomme" },
  { id: ID.rythmeMesure, etat: "prevu", chantier: "10", note: "mesure allumée (remarque de plan), hors bibliothèque" },
  { id: ID.etalonnageNoirBlanc, etat: "prevu", chantier: "10", note: "livrée, non branchée" },
  { id: ID.texteLueur, etat: "prevu", chantier: "10", note: "livrée, non branchée" },
  { id: ID.texteFondClair, etat: "prevu", chantier: "10", note: "livrée, non branchée" },
] satisfies LigneCatalogue[]);
