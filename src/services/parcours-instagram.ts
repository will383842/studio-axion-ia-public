/**
 * Réglage « Instagram : suivre le compte puis répondre OK ». ÉTEINT PAR DÉFAUT ; seul lecteur de production : parcours-conversation (INSTA-C), une fois par passage.
 * Échec FERMÉ : lecture impossible, valeur absente ou mal formée => éteint. Seule la valeur `true` allume.
 */
import "server-only";
import { lireParametre } from "./_commun";

export const PARAM_INSTAGRAM_SUIVRE = "parcours.instagram_suivre";

interface Options {
  /** Lecture de la valeur brute du réglage (remplaçable en test). Par défaut : la table des réglages. */
  lire?: () => Promise<unknown>;
}

const estVraie = (v: unknown): boolean => v === true;

export async function instagramSuivreActif(options?: Options): Promise<boolean> {
  try {
    const lire =
      options?.lire ??
      (() => lireParametre<unknown>(PARAM_INSTAGRAM_SUIVRE, false));
    return estVraie(await lire());
  } catch {
    return false;
  }
}
