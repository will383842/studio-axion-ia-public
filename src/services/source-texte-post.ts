/**
 * TXT-SOURCE · d'où vient le texte que l'on demande au rédacteur du post.
 * Ordre : le script relié à la vidéo ; puis le script gardé par le générateur (brouillon du tableau, script validé de la
 * face caméra animée, écrans du cas concret, fiche de l'image → vidéo) ; le titre seulement en dernier recours, et l'écran
 * le dit. Un script vide, blanc ou illisible compte comme absent (le script provisoire d'un brouillon est vide).
 * PUR : aucune lecture de dépôt, aucun appel ; les moteurs ne sont pas touchés.
 */

export type OrigineSourcePost = "script" | "generateur" | "titre";

const objet = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const plein = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Choisit la source du texte du post (le titre ne sert que sans aucun script). */
export function choisirSourceTextePost(e: { scriptRelie?: string | null; gardes?: readonly unknown[]; titre: string }): { texte: string; origine: OrigineSourcePost } {
  const relie = plein(e.scriptRelie);
  if (relie) return { texte: relie, origine: "script" };
  for (const g of e.gardes ?? []) {
    const t = plein(g);
    if (t) return { texte: t, origine: "generateur" };
  }
  return { texte: e.titre, origine: "titre" };
}

/** Brouillon du tableau : `video.entrees.tableauCreation.donnees.texte` (le texte dit). */
export function scriptGardeTableau(entrees: unknown): string | null {
  return plein(objet(objet(objet(entrees)?.tableauCreation)?.donnees)?.texte);
}

/** Script validé de la face caméra animée : `commande.entrees.facecamAnimee.texteValide` d'une version. */
export function scriptGardeFacecam(entreesDeCommande: unknown): string | null {
  return plein(objet(objet(entreesDeCommande)?.facecamAnimee)?.texteValide);
}

/** Écrans du cas concret ou fiche de l'image → vidéo : les textes dits de chaque écran, dans l'ordre. */
export function scriptGardeEcrans(ecrans: unknown): string | null {
  if (!Array.isArray(ecrans)) return null;
  return plein(ecrans.map((e) => plein(objet(e)?.texteDit)).filter((t): t is string => !!t).join(" "));
}
