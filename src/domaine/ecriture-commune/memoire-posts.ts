/**
 * MÉMOIRE ANTI-COPIE DES POSTS ET COMMENTAIRES (L3-13). PUR : aucune lecture de base. Même esprit que la mémoire des scripts,
 * pour les formatId « post » et « commentaire » ; seuil d'alerte : `TAILLE_ALERTE_POST` mots repris d'affilée. L'alerte ne
 * réécrit jamais le texte. L'avocat et un texte du fondateur (autre origine que « claude » ou « code ») n'entrent jamais.
 */
import { FORMATS_POSTS } from "@/domaine/ecriture-commune/contrat-format";
import { FENETRE_VERSIONS_MEMOIRE } from "@/domaine/ecriture-commune/memoire";
import type { OrigineScript } from "@/domaine/ecriture-commune/ressemblance";
import { reprisesDAffilee, type Reprise } from "@/domaine/proximite-textes";

export { FORMATS_POSTS };
export const TAILLE_ALERTE_POST = 6;

export interface EntreePost {
  texte: string;
  formatId: string;
  date: string;
}

export function formatPostApplicable(formatId: string, origine: OrigineScript = "claude"): boolean {
  return (origine === "claude" || origine === "code") && FORMATS_POSTS.includes(formatId);
}

/** Nouvelle liste avec l'entrée en plus (la plus récente en dernier), limitée aux `max` dernières. N'altère pas l'entrée. */
export function ajouterEntree(liste: readonly EntreePost[], entree: EntreePost, max = FENETRE_VERSIONS_MEMOIRE): EntreePost[] {
  return [...liste, entree].slice(-max);
}

export interface AlertePost {
  alerte: boolean;
  reprises: Reprise[];
}

export function alertePost(texte: string, anterieurs: readonly string[]): AlertePost {
  const reprises = reprisesDAffilee(texte, anterieurs, TAILLE_ALERTE_POST);
  return { alerte: reprises.length > 0, reprises };
}
