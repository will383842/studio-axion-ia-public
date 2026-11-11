/**
 * Polices des visuels de carrousels : UNE SEULE, Manrope (variable 200 à 800, SIL OFL 1.1, licence `../commune/polices/OFL-Manrope.txt`),
 * chargée EN LOCAL dans Remotion (aucune dépendance réseau au rendu) par `./police-manrope.ts`. Une page ne contient que Manrope.
 * Les anciens points d'entrée (titre, texte courant, annotations) sont conservés pour les gabarits : tous chargent Manrope, avec le même nom
 * de famille. Manrope n'a pas l'espace fine insécable (U+202F, avant « ? ! ; ») : aucune face de repli n'est déclarée ici (à traiter par une fiche suivante).
 * Le rendu attend le chargement (jamais une image avec une police de secours).
 */
import { chargerPoliceManrope, FAMILLE_MANROPE, policeManropePrete } from "./police-manrope";

export const FAMILLE_TITRE = FAMILLE_MANROPE;
export const FAMILLE_INTER = FAMILLE_MANROPE;
export const FAMILLE_KALAM = FAMILLE_MANROPE;

/** Manrope pour les titres (ExtraBold, 800). */
export function chargerPoliceTitre(): void {
  chargerPoliceManrope();
}

/** Promesse du chargement de la police des titres (lance le chargement si besoin) : sert à l'attendre, sans sonder `document.fonts`. */
export function policeTitrePrete(): Promise<void> {
  return policeManropePrete();
}

/** Manrope pour le texte courant, les étiquettes et les légendes (500 à 700). */
export function chargerPoliceInter(): void {
  chargerPoliceManrope();
}

/** Promesse du chargement du texte courant (lance le chargement si besoin). */
export function policeInterPrete(): Promise<void> {
  return policeManropePrete();
}

let kalamDemandee = false;

/** Manrope pour les annotations des gabarits L9 (plus de police manuscrite). */
export function chargerPoliceKalam(): void {
  kalamDemandee = true;
  chargerPoliceManrope();
}

/** Promesse du chargement pour les annotations, ou `undefined` si la page ne les a pas demandées (aucune attente inutile). */
export function policeKalamPrete(): Promise<void> | undefined {
  return kalamDemandee ? policeManropePrete() : undefined;
}
