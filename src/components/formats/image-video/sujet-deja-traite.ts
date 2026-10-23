/**
 * Ordre de l'écran « Déposer l'image » (lot L6), en fonctions pures pour être testé sans navigateur.
 * Une image seule est TOUJOURS un nouveau dépôt : le SERVEUR contrôle d'abord l'image (il répond « image déjà traitée » ou
 * « accord requis ») ; le prix n'est demandé qu'ensuite, et jamais pour une image refusée. Les règles du prix redemandé
 * et du prix gardé sont celles du tableau animé (lot L4).
 */
export { accordApresRefus, PHRASE_PRIX_CHANGE, prixRedemandable, RELANCES_PRIX_MAX } from "../tableau-anime/sujet-deja-traite";

/** Une image seule : le contrôle serveur passe avant la fenêtre de prix. */
export const controleServeurAvantPrix = (): boolean => true;

/** Une demande « Refaire quand même » est déjà partie : un second clic est ignoré (anti double clic). PUR. */
export const clicIgnore = (enCours: boolean): boolean => enCours;

/** Phrase unique d'un lot dont des images sont sautées : combien, lesquelles, et ce qui part quand même. PUR. */
export function phraseImagesSautees(sautees: readonly { nom: string }[], gardees: number): string {
  const n = sautees.length;
  if (!n) return "";
  const noms = sautees.map((s) => s.nom).join(", ");
  const sujet = n === 1 ? "1 image est déjà traitée et sautée" : `${n} images sont déjà traitées et sautées`;
  const suite = gardees > 1 ? `${gardees} vidéos partent.` : gardees === 1 ? "1 seule reste." : "Aucune ne reste.";
  return `${sujet} (${noms}) : ${suite}`;
}
