/**
 * CAL-24 : règles pures de « Dupliquer » et du lien « Voir sur le réseau ». Aucun appel, aucun accès aux données : ce fichier peut être lu
 * des deux côtés (écran et action).
 */

export const LIBELLE_VOIR_SUR_RESEAU = "Voir sur le réseau";

/** Marque posée en tête du texte d'une copie : la personne la relit et l'adapte au nouveau réseau avant de valider. */
export const MARQUE_A_ADAPTER = "À adapter : ";

/** Ajoute la marque une seule fois (une copie de copie ne la double pas). Un texte vide donne la marque seule. */
export function marquerAAdapter(texte: string): string {
  const propre = (texte ?? "").trim();
  if (propre.startsWith(MARQUE_A_ADAPTER.trim())) return propre;
  return propre ? `${MARQUE_A_ADAPTER}${propre}` : MARQUE_A_ADAPTER.trim();
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
