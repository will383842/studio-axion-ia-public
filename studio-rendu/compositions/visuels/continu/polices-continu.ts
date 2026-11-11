/**
 * Police de la toile continue : Manrope seulement (modèle `../polices.ts`), chargée EN LOCAL. Plus de Bricolage Grotesque, d'Instrument Serif
 * ni d'Inter : titres, accents et texte courant sont tous en Manrope (200 à 800, jamais d'italique).
 * Licence : `../../commune/polices/OFL-Manrope.txt`. Le rendu attend le chargement (jamais une image avec une police de secours).
 */
import { chargerPoliceManrope, policeManropePrete } from "../police-manrope";

export { FAMILLE_MANROPE } from "../police-manrope";

/** Lance le chargement (une fois) : Remotion attend la fin ; une police illisible fait échouer le rendu. */
export function chargerPolicesContinu(): void {
  chargerPoliceManrope();
}

/** Promesse du chargement de la police de la toile (lance le chargement si besoin). */
export function policesContinuPretes(): Promise<void> {
  return policeManropePrete();
}
