import { COULEURS } from "../commun/constantes";
import type { ProprietesMini } from "./types";

/** W01 — pastille numérotée : le rang est montré par des points (jamais de chiffre), de 1 à 9. */
export function W01({ taille, rang = 1 }: ProprietesMini) {
  const n = Math.max(1, Math.min(9, Math.floor(rang)));
  return (
    <svg width={taille} height={taille} viewBox="0 0 120 120" role="img" aria-hidden>
      <circle cx="60" cy="60" r="54" fill={COULEURS.orange} stroke={COULEURS.encre} strokeWidth="6" />
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx={36 + (i % 3) * 24} cy={36 + Math.floor(i / 3) * 24} r="8" fill={COULEURS.creme} stroke={COULEURS.encre} strokeWidth="3" />
      ))}
    </svg>
  );
}
