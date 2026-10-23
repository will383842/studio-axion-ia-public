/**
 * Ordre de l'écran « Écrire le script pour moi » (lot L4), en fonctions pures pour être testé sans navigateur.
 * Nouvelle vidéo = pas de brouillon ET pas d'autre accroche : le SERVEUR contrôle d'abord le sujet (il répond « sujet déjà
 * traité » ou « accord requis »), et le prix n'est demandé qu'ensuite. Une écriture sur un brouillon existant (reprise,
 * autre accroche, « Réécrire ») garde l'ordre d'avant : le prix d'abord, aucun contrôle de sujet.
 */
export function controleServeurAvantPrix(o: { videoId?: string; accroche?: number }): boolean {
  return !o.videoId && o.accroche === undefined;
}

/** Nombre de fois qu'un prix redemandé par le serveur est reproposé avant de s'arrêter (jamais de boucle sans fin). */
export const RELANCES_PRIX_MAX = 2;

/** Phrase quand le prix a été redemandé trop de fois de suite. */
export const PHRASE_PRIX_CHANGE = "Le prix a changé plusieurs fois, réessayez.";

/**
 * Le serveur redemande un prix : on le repropose tant que `essai` (nombre de fois déjà reproposé) est sous la limite.
 * Le premier « accord requis » d'une nouvelle vidéo (essai 0) passe toujours : trois fenêtres de prix au plus (1 + 2 relances).
 */
export const prixRedemandable = (essai: number): boolean => essai < RELANCES_PRIX_MAX;

/**
 * Prix déjà confirmé à garder avec un refus « sujet déjà traité » : aucun si la confirmation était périmée (les vidéos ont
 * changé) — le prix est alors redemandé avant l'écriture payante.
 */
export const accordApresRefus = (refus: { jetonPerime?: boolean }, accord: number | undefined): number | undefined => (refus.jetonPerime ? undefined : accord);
