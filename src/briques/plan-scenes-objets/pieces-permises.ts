/**
 * Pièces d'objets permises par le profil figé (N-03b) : traduit les capacités `objet.*` de l'entrée bibliothèque
 * en identifiants de pièces `objet-…` du registre, ceux qu'attend la porte C9-33 (`objetsPermis`).
 * Fonction pure, ne lève jamais, ne lit aucun réglage. Non exportée par `index.ts`.
 */
import { definitionsPermises, objetsPermisDesEntrees } from "../plan-scenes-generateurs/objets-permis";
import type { IdPetitObjet } from "../motion/petits-objets/contrat";
import { OBJETS_INSCRITS } from "./registre";
import { restreindreAuxPiecesValidees } from "./pieces-validees";

const AUCUNE: readonly IdPetitObjet[] = Object.freeze([]);

/** Ids des pièces permises, dans l'ordre du registre, sans doublon. Sans entrée, entrée illisible ou aucun permis : `[]` gelé. */
export function piecesPermisesDesEntrees(entrees: unknown): readonly IdPetitObjet[] {
  try {
    const permis = objetsPermisDesEntrees(entrees);
    if (permis.length === 0) return AUCUNE;
    const facecam = (entrees as { bibliothequeVideo?: { profil?: { formatId?: unknown } } }).bibliothequeVideo?.profil?.formatId === "facecam"; // FOND-FLOU-C10-04-b-v20l
    const ids = definitionsPermises(OBJETS_INSCRITS, permis).filter((d) => !facecam || restreindreAuxPiecesValidees([d.id], d.capacite).length > 0).map((d) => d.id as IdPetitObjet);
    return Object.freeze([...new Set(ids)]);
  } catch {
    return AUCUNE;
  }
}
