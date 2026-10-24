import { COULEURS, POLICE_TITRE } from "../commun/constantes";
import { chargerPoliceTitre } from "../polices";
import type { ProprietesMini } from "./types";

/**
 * Le rang est dessiné en CHIFFRE (Inter Display Black) par le code, jamais par le spec : décision de design à confirmer.
 * Passer à `false` rétablit les points (de 1 à 9) sans toucher à rien d'autre.
 */
export const RANG_CHIFFRE = true;

/** W01 — pastille numérotée : le rang est montré par un chiffre (`RANG_CHIFFRE`), sinon par des points, de 1 à 9. */
export function W01({ taille, rang = 1 }: ProprietesMini) {
  const n = Math.max(1, Math.min(9, Math.floor(rang)));
  if (RANG_CHIFFRE) chargerPoliceTitre();
  return (
    <svg width={taille} height={taille} viewBox="0 0 120 120" role="img" aria-hidden>
      <circle cx="60" cy="60" r="54" fill={COULEURS.orange} stroke={COULEURS.encre} strokeWidth="6" />
      {RANG_CHIFFRE ? (
        <text x="60" y="60" textAnchor="middle" dominantBaseline="central" fontFamily={POLICE_TITRE} fontSize="64" fill={COULEURS.creme} stroke={COULEURS.encre} strokeWidth="2.5" paintOrder="stroke">
          {n}
        </text>
      ) : (
        Array.from({ length: n }, (_, i) => <circle key={i} cx={36 + (i % 3) * 24} cy={36 + Math.floor(i / 3) * 24} r="8" fill={COULEURS.creme} stroke={COULEURS.encre} strokeWidth="3" />)
      )}
    </svg>
  );
}
