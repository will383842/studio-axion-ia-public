/**
 * SCRIPT FACULTATIF (décision de Will, 18/10) — PUR : client et serveur.
 *
 * Pour la face caméra et la face caméra animée seulement (jamais l'avocat, le tableau, le cas concret ni image→vidéo) :
 * le texte n'est ni imposé ni écrit tout seul. Une vidéo déjà filmée se monte sans texte et sans appel Claude ; le texte
 * à lire (recette `ecrire-facecam`, 2,9 mots/s) n'est écrit que si Will touche « Je veux un texte à lire ».
 */
export const FORMATS_SCRIPT_FACULTATIF: readonly string[] = ["facecam", "facecam-animee"];

export const LIBELLE_VEUT_TEXTE = "Je veux un texte à lire";

export function scriptFacultatif(formatId: string): boolean {
  return FORMATS_SCRIPT_FACULTATIF.includes(formatId);
}

/** Titre repris pour une vidéo déjà filmée sans texte : celui du brouillon, à défaut son sujet. */
export function titreDejaFilme(b: { titre: string; sujet: string }): string | undefined {
  return b.titre.trim() || b.sujet.trim() || undefined;
}

/** « Fabriquer » grisé : sans texte, un script facultatif n'attend ni budget ni connexion (rien n'est écrit ni payé). */
export function boutonFabriquerGrise(o: { aTexte: boolean; formatId: string; budgetDepasse: boolean; refus: boolean }): boolean {
  if (!o.aTexte) return !scriptFacultatif(o.formatId);
  return o.budgetDepasse || o.refus;
}
