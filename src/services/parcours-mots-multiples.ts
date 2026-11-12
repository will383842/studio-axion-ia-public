/**
 * Réglage « Plusieurs mots pour une même personne » du parcours viral. ÉTEINT PAR DÉFAUT et sans aucun effet aujourd'hui :
 * aucun code de production ne le lit. Il reste éteint tant que l'essai Facebook n'est pas validé.
 * Échec FERMÉ : lecture impossible, valeur absente ou mal formée => éteint. Seuls `true`, `1` et `"oui"` allument.
 */
import "server-only";
import { lireParametre } from "./_commun";

export const PARAM_MOTS_MULTIPLES = "parcours.mots_multiples";

interface Options {
  /** Lecture de la valeur brute du réglage (remplaçable en test). Par défaut : la table des réglages. */
  lire?: () => Promise<unknown>;
}

const estVraie = (v: unknown): boolean => v === true || v === 1 || v === "oui";

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
