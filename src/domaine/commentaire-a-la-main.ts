/**
 * Réseaux dont le premier commentaire est posé à la main, jamais par Buffer. UNE SEULE SOURCE : le studio n'envoie
 * aucun `firstComment` à Buffer pour ces réseaux (le fournisseur, lui, ne change pas). PUR.
 * LinkedIn : décision de Will, le premier commentaire y est posé par Will, à la main.
 */
import type { IdReseau } from "./types";

export const RESEAUX_COMMENTAIRE_A_LA_MAIN: readonly IdReseau[] = ["linkedin"];

export const commentaireALaMain = (reseau: IdReseau): boolean => RESEAUX_COMMENTAIRE_A_LA_MAIN.includes(reseau);

/** Buffer pose-t-il le premier commentaire ? Oui seulement si le réseau l'accepte ET qu'il n'est pas posé à la main. */
export const commentaireParBuffer = (reseau: IdReseau, accepteParBuffer: boolean): boolean => accepteParBuffer && !commentaireALaMain(reseau);
