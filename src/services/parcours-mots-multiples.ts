/**
 * Réglage « Plusieurs mots pour une même personne » du parcours viral. ÉTEINT PAR DÉFAUT. Lu par le parcours de conversation
 * (renvoi, plafonds par personne) et par le réglage Instagram ; écrit uniquement par l'interrupteur « Mode plusieurs mots » de /mots
 * (`ecrireMotsMultiples`, appelée par `parcours-conversation`). Il reste éteint tant que l'essai Facebook n'est pas validé.
 * Échec FERMÉ : lecture impossible, valeur absente ou mal formée => éteint. Seule la valeur `true` allume.
 */
import "server-only";
import { ecrireParametre, lireParametre } from "./_commun";

export const PARAM_MOTS_MULTIPLES = "parcours.mots_multiples";

interface Options {
  /** Lecture de la valeur brute du réglage (remplaçable en test). Par défaut : la table des réglages. */
  lire?: () => Promise<unknown>;
}

const estVraie = (v: unknown): boolean => v === true;

export async function motsMultiplesActifs(options?: Options): Promise<boolean> {
  try {
    const lire =
      options?.lire ??
      (() => lireParametre<unknown>(PARAM_MOTS_MULTIPLES, false));
    return estVraie(await lire());
  } catch {
    return false;
  }
}

/** Écriture du réglage (seule voie : l'interrupteur de /mots, via `parcours-conversation`). Mémoire ET base, par la couche de données normale. */
export async function ecrireMotsMultiples(allume: boolean): Promise<void> {
  await ecrireParametre(PARAM_MOTS_MULTIPLES, allume);
}
