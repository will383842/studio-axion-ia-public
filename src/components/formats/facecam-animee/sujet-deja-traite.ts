/**
 * Ordre de l'écran « Animer mes N vidéos » (lot L7), en fonctions pures pour être testé sans navigateur.
 * Ce format n'a AUCUN prix : le dépôt est lui-même le contrôle (une prise déjà traitée est refusée avant le brouillon, rien n'est
 * créé), donc il n'y a pas de fenêtre de prix à protéger ni de limite de relances de prix.
 */

/** Un second clic pendant l'envoi d'« Animer » ou de « Refaire quand même » est ignoré (anti double clic). PUR. */
export const clicIgnore = (enCours: boolean): boolean => enCours;

/** Phrase d'avertissement quand la prise existe déjà dans un AUTRE type de vidéo (elle ne bloque rien). PUR. */
export function phraseAvertissement(titres: readonly string[]): string {
  const liste = [...new Set(titres)].slice(0, 3).join(" · ");
  return liste ? `Cette vidéo existe déjà dans un autre type de vidéo : ${liste}.` : "";
}

/** Phrase unique d'un envoi dont des prises sont sautées : combien, lesquelles, et ce qui part quand même. PUR. */
export function phrasePrisesSautees(noms: readonly string[], parties: number): string {
  const n = noms.length;
  if (!n) return "";
  const liste = noms.join(", ");
  const sujet = n === 1 ? "1 vidéo est déjà traitée et sautée" : `${n} vidéos sont déjà traitées et sautées`;
  const suite = parties > 1 ? `${parties} vidéos partent.` : parties === 1 ? "1 vidéo part." : "Aucune ne part.";
  return `${sujet} (${liste}) : ${suite}`;
}
