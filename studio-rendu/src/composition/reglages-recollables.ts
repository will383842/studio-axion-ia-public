/**
 * Réglages d'export « recollables » (G11-03) : de quoi que des segments encodés séparément puissent être recollés
 * bout à bout sans réencodage. ÉTEINT : personne ne passe l'option (`reglagesVideo(e, { recollable: true })`), le
 * tableau d'arguments reste identique au caractère près. La mesure G13-09 n'est pas faite ; rien ne l'allume.
 * Fichier lu par le rendu : aucun import `@/…`, aucun import du Studio.
 */

/** Paires option / valeur ajoutées, chacune une seule fois, en valeurs explicites (jamais celles par défaut de FFmpeg). */
export const REGLAGES_RECOLLABLES: ReadonlyArray<readonly [string, string]> = [
  ["-refs", "3"],
  ["-video_track_timescale", "12800"],
  ["-fps_mode", "cfr"],
  ["-threads", "4"],
];

/** PURE. Ajoute les réglages recollables à `base` (copie) ; une option déjà présente est remplacée, jamais doublée. */
export function argumentsRecollables(base: readonly string[]): string[] {
  const propres = [...base];
  for (const [option] of REGLAGES_RECOLLABLES) {
    for (let i = propres.indexOf(option); i !== -1; i = propres.indexOf(option)) propres.splice(i, 2);
  }
  return [...propres, ...REGLAGES_RECOLLABLES.flat()];
}
