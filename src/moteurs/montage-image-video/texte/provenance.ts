/**
 * MODE TEXTE · provenance « texte » : fichier PUR et sans import (utilisable côté client et sans cycle avec la fabrication).
 */
export const PROVENANCE_TEXTE = "texte" as const;
/** Vrai si la clé d'image d'une carte indique qu'elle vient d'un texte (aucun fichier n'existe). */
export const estCleTexte = (cle: string) => cle.startsWith(`${PROVENANCE_TEXTE}:`);
