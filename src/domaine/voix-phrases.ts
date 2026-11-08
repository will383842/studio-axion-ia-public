/**
 * VOIX NATURELLE, lot E (PUR). Ce qui est envoyé à la voix : une ponctuation à la fin de CHAQUE phrase. Sans elle, la
 * voix lit « Bonjour à vous Merci » d'un trait et la fin de la phrase ne retombe pas (elle donne l'impression de
 * continuer). Le texte de Williams n'est jamais modifié : seule la copie envoyée à la voix reçoit les points.
 */

/** Une phrase se termine déjà par . ? ! … (guillemets ou parenthèse fermants tolérés après). */
const FIN_DE_PHRASE = /[.?!…][\s\u00a0]*["»”)\]]*\s*$/u;

/** Virgule, point-virgule ou deux-points laissés en bout de phrase : remplacés par un point. */
const FIN_OUVERTE = /[,;:]+["»”)\]]*\s*$/u;

/**
 * Une phrase prête pour la voix. Vide → vide. Déjà ponctuée → telle quelle (espaces de bord retirés). Virgule ou
 * deux-points final → point. Sinon → point ajouté, après un guillemet fermant s'il y en a un (« oui » → « oui ».).
 */
export function ponctuerPhrase(phrase: string): string {
  const t = phrase.trim();
  if (!t) return "";
  if (FIN_DE_PHRASE.test(t)) return t;
  const ouverte = FIN_OUVERTE.exec(t);
  if (ouverte) {
    const guillemet = /["»”)\]]+$/u.exec(ouverte[0].trim())?.[0] ?? "";
    return `${t.slice(0, ouverte.index).trimEnd()}.${guillemet}`;
  }
  return `${t}.`;
}

/** Les phrases mises bout à bout pour la voix : un point à chacune, un espace entre deux, les vides ignorées. */
export function joindrePhrasesPourVoix(phrases: readonly string[]): string {
  return phrases.map(ponctuerPhrase).filter(Boolean).join(" ");
}

/** Format qui ne sait pas refaire UNE phrase (avatar, image → vidéo, face caméra animée) : dit en clair, sans argent. */
export const RETOUCHE_PAS_DISPONIBLE = "Refaire une seule phrase n'est pas possible pour ce format : pour ce changement, il faut refaire la vidéo. Votre vidéo reste telle quelle.";
