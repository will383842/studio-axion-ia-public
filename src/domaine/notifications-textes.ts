/**
 * Phrases des notifications (relecture R3, PUR, importable côté client) : l'écran et les messages d'erreur disent
 * la même chose, en mots simples. Jamais de nom de réglage, de sigle ni de nom de service technique (ordre de Will) ;
 * les noms des réglages serveur sont dans docs/OUTILS-REELS-R3.md et au journal du serveur.
 */
export const TELEPHONE_PAS_PRET = "Le téléphone n'est pas encore prêt : à faire régler.";
export const EMAIL_PAS_PRET = "L'e-mail n'est pas encore prêt : à faire régler.";

/** Fin d'un lot d'images (Image → vidéo) : « Lot terminé : 3 faites, 2 mises de côté ». PUR. */
export function phraseFinDeLotIV(r: { faites: number; misesDeCote: number }): string {
  const faites = `${r.faites} ${r.faites > 1 ? "faites" : "faite"}`;
  return r.misesDeCote > 0 ? `Lot terminé : ${faites}, ${r.misesDeCote} ${r.misesDeCote > 1 ? "mises de côté" : "mise de côté"}` : `Lot terminé : ${faites}`;
}
