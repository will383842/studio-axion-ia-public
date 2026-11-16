/**
 * Réglage « Instagram : suivre le compte puis répondre OK ». ÉTEINT PAR DÉFAUT ; seul lecteur de production : parcours-conversation (INSTA-C), une fois par passage.
 * Échec FERMÉ : lecture impossible, valeur absente ou mal formée => éteint. Seule la valeur `true` allume.
 */
import "server-only";
import { ecrireParametre, lireParametre } from "./_commun";

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

/**
 * Réglage « Instagram ouvert au public ». ÉTEINT PAR DÉFAUT ; seul lecteur de production : parcours-conversation (INSTA-C).
 * Tant qu'il n'est pas exactement `true`, Instagram ne sert QUE les auteurs listés dans PARCOURS_ESSAI_AUTEURS. Échec FERMÉ.
 * AUCUN écrivain : l'ouverture au public sera un geste serveur décidé plus tard par le fondateur.
 */
export const PARAM_INSTAGRAM_PUBLIC = "parcours.instagram_public";

export async function instagramPublicActif(options?: Options): Promise<boolean> {
  try {
    const lire =
      options?.lire ??
      (() => lireParametre<unknown>(PARAM_INSTAGRAM_PUBLIC, false));
    return estVraie(await lire());
  } catch {
    return false;
  }
}

/** Écriture du réglage (seule voie : l'interrupteur de /mots, via `parcours-conversation`). Mémoire ET base, par la couche de données normale. */
export async function ecrireInstagramSuivre(allume: boolean): Promise<void> {
  await ecrireParametre(PARAM_INSTAGRAM_SUIVRE, allume);
}
