import { COULEURS } from "../commun/constantes";
import type { ProprietesMini } from "./types";

/** W07 — barre de progression aux deux tiers. */
export function W07({ taille }: ProprietesMini) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 120 120" role="img" aria-hidden>
      <rect x="6" y="40" width="108" height="40" rx="20" fill={COULEURS.creme} stroke={COULEURS.encre} strokeWidth="6" />
      <rect x="6" y="40" width="74" height="40" rx="20" fill={COULEURS.orange} stroke={COULEURS.encre} strokeWidth="6" />
    </svg>
  );
}
