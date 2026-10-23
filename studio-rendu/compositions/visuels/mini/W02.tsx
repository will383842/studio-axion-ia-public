import { COULEURS } from "../commun/constantes";
import type { ProprietesMini } from "./types";

/** W02 — coche dans une case. */
export function W02({ taille }: ProprietesMini) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 120 120" role="img" aria-hidden>
      <rect x="9" y="9" width="102" height="102" rx="22" fill={COULEURS.creme} stroke={COULEURS.encre} strokeWidth="6" />
      <path d="M32 62 L53 83 L90 36" fill="none" stroke={COULEURS.orange} strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
