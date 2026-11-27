/**
 * Plafonds d'une épingle Pinterest (ADR-0015 D10), en un seul endroit PUR (aucun import serveur) : l'envoi
 * (`zernio-corps.ts`) et l'aperçu (client) lisent les mêmes valeurs.
 */
/** Texte alternatif sur Pinterest SEULEMENT : 500 signes. Les autres réseaux restent à 125. */
export const ALT_MAX_PINTEREST = 500;
export const TITRE_EPINGLE_MAX = 100;
export const DESCRIPTION_EPINGLE_MAX = 800;
export const LIEN_EPINGLE_MAX = 2000;
