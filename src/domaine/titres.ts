/**
 * TITRES ET TEXTES COURTS coupés AU MOT (constat du 12/10 : un titre de brouillon coupé à 80 caractères au milieu d'un
 * mot, « … toutes s », sur la page de la vidéo). PUR.
 */

/** Longueur des titres coupés par l'ancien code (`texte.slice(0, 80)`). */
export const TITRE_COUPE_MAX = 80;

const espaces = (t: string) => t.replace(/\s+/g, " ").trim();

/** Coupe au dernier mot entier qui tient dans `max` caractères, suivi de « … » (jamais au milieu d'un mot). */
export function couperAuMot(texte: string, max: number): string {
  const t = espaces(texte);
  if (t.length <= max) return t;
  const coupe = t.slice(0, Math.max(0, max - 1));
  const fin = coupe.lastIndexOf(" ");
  const debut = (fin > 0 ? coupe.slice(0, fin) : coupe).replace(/[\s,;:.!?…—–-]+$/u, "");
  return `${debut}…`;
}

/**
 * Titre à afficher : un titre enregistré coupé à 80 caractères par l'ancien code (pile 80 caractères, sans ponctuation
 * finale) perd son mot coupé et prend « … » ; tout autre titre est rendu tel quel.
 */
export function titreAffiche(titre: string): string {
  const t = espaces(titre);
  if (t.length !== TITRE_COUPE_MAX || /[.!?…»)"]$/.test(t)) return t;
  const fin = t.lastIndexOf(" ");
  return fin > 0 ? `${t.slice(0, fin).replace(/[\s,;:.!?—–-]+$/u, "")}…` : t;
}
