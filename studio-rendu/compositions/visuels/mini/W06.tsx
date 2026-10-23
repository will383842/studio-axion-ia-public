import { COULEURS } from "../commun/constantes";
import type { ProprietesMini } from "./types";

/** W06 — jauge en demi-cercle avec son aiguille. */
export function W06({ taille }: ProprietesMini) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 120 120" role="img" aria-hidden>
      <path d="M12 86 A48 48 0 0 1 108 86" fill="none" stroke={COULEURS.encre} strokeWidth="24" strokeLinecap="butt" />
      <path d="M12 86 A48 48 0 0 1 60 38" fill="none" stroke={COULEURS.orange} strokeWidth="14" strokeLinecap="butt" />
      <path d="M12 86 A48 48 0 0 1 108 86" fill="none" stroke={COULEURS.creme} strokeWidth="4" strokeDasharray="2 20" />
      <path d="M60 86 L84 52" stroke={COULEURS.encre} strokeWidth="8" strokeLinecap="round" />
      <circle cx="60" cy="86" r="11" fill={COULEURS.encre} />
    </svg>
  );
}
