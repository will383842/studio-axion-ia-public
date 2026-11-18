/**
 * CAL-24 : règles pures de « Dupliquer » et du lien « Voir sur le réseau ». Aucun appel, aucun accès aux données : ce fichier peut être lu
 * des deux côtés (écran et action).
 */

export const LIBELLE_VOIR_SUR_RESEAU = "Voir sur le réseau";

/**
 * Drapeau « À adapter » d'une copie : il est rangé À CÔTÉ du texte (jamais dedans). Le texte de la copie reste celui de l'original, sans marque :
 * un clic Valider sans relecture ne publie donc jamais le mot « À adapter » sur un réseau. Valeur : `true` tant que la copie n'a pas été relue.
 */
export const LIBELLE_A_ADAPTER = "À adapter";

export function cleAAdapter(creneauIdCopie: string): string {
  return `calendrier.copie-a-adapter.${creneauIdCopie}`;
}

/** Où le Studio range le lien d'une copie vers son original (la clé de fiche de l'original est la valeur). */
export function cleLienCopie(creneauIdCopie: string): string {
  return `calendrier.copie.${creneauIdCopie}`;
}

/** Identifiant du créneau d'une copie : une même clé de formulaire donne toujours la même copie (double clic sans doublon). */
export function idCopie(cleFormulaire: string): string {
  return `copie-${cleFormulaire}`;
}

/**
 * L'adresse de la publication sur le réseau, ou `null` : seule une publication publiée avec une adresse web lisible (http ou https)
 * offre « Voir sur le réseau ». Une adresse absente, vide, relative ou d'un autre genre (javascript:, data:, ftp:) ne donne aucun lien.
 */
export function lienVoirSurReseau(publication: { statut?: string; urlPubliee?: string | null }): string | null {
  if (publication?.statut !== "publiee") return null;
  const brute = typeof publication.urlPubliee === "string" ? publication.urlPubliee.trim() : "";
  if (!brute) return null;
  try {
    const u = new URL(brute);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || !u.hostname) return null;
    return brute;
  } catch {
    return null;
  }
}
