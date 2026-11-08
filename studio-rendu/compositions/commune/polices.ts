/**
 * Police UNIQUE des vidéos : Manrope (charte Axion 2026, SIL OFL 1.1), chargée EN LOCAL dans Remotion (fichier
 * `polices/Manrope-Variable.ttf`, aucune dépendance réseau au rendu). Le rendu attend son chargement (jamais une image
 * avec une police de secours).
 *
 * Les anciens points d'entrée (titre, Montserrat, Anton, Inter…) sont conservés pour ne pas toucher aux centaines
 * d'appels des compositions : tous désignent maintenant la même famille Manrope et chargent le même fichier.
 */
import { FAMILLE_CSS } from "../../../src/briques/charte/axion-2026";
import { chargerPoliceManrope } from "../visuels/police-manrope";

/** Famille CSS de Manrope dans les rendus (jeton de la charte). */
export const FAMILLE_MANROPE_VIDEO = FAMILLE_CSS;

export const FAMILLE_TITRE = FAMILLE_CSS;
export const FAMILLE_MONTSERRAT = FAMILLE_CSS;
export const FAMILLE_ANTON = FAMILLE_CSS;
export const FAMILLE_INTER_MEDIUM = FAMILLE_CSS;
export const FAMILLE_INTER_SEMIBOLD = FAMILLE_CSS;

/** Charge Manrope (une fois par page de rendu). */
export function chargerPoliceTitre(): void {
  chargerPoliceManrope();
}
export const chargerPoliceMontserrat = chargerPoliceTitre;
export const chargerPoliceAnton = chargerPoliceTitre;
export const chargerPoliceInterMedium = chargerPoliceTitre;
export const chargerPoliceInterSemiBold = chargerPoliceTitre;
