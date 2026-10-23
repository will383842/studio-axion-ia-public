import { COULEURS } from "../commun/constantes";
import type { ProprietesMini } from "./types";

/** W25 — étoile à cinq branches. */
export function W25({ taille }: ProprietesMini) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 120 120" role="img" aria-hidden>
      <path d="M60 8 L75 43 L113 46 L84 71 L93 108 L60 88 L27 108 L36 71 L7 46 L45 43 Z" fill={COULEURS.orange} stroke={COULEURS.encre} strokeWidth="6" strokeLinejoin="round" />
    </svg>
  );
}
