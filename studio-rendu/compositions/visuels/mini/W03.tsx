import { COULEURS } from "../commun/constantes";
import type { ProprietesMini } from "./types";

/** W03 — flèche vers la droite. */
export function W03({ taille }: ProprietesMini) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 120 120" role="img" aria-hidden>
      <path d="M10 46 H66 V20 L112 60 L66 100 V74 H10 Z" fill={COULEURS.orange} stroke={COULEURS.encre} strokeWidth="6" strokeLinejoin="round" />
    </svg>
  );
}
