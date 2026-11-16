/**
 * Aucun consommateur (C6-H14) : G2-04 et les chantiers 3/4 les liront.
 *
 * Un extrait incrusté (chantiers 3 et 4) est toujours muet. Changer ceci demande une décision de Williams.
 * Pur, sans alias « @/ ».
 */
export const POLITIQUE_SON_EXTRAIT = "muet" as const;

/** Gain du son d'un extrait incrusté : −∞ dB, donc silence complet. */
export function gainExtraitDb(): number {
  return -Infinity;
}
