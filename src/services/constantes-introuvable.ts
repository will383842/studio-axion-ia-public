/** RAP-3 · seuils du retrait groupé des rapatriées introuvables (constantes pures, sans dépendance). */
/** Réponses « introuvable » à des passages DISTINCTS exigées avant qu'une rapatriée soit retirable en groupe. */
export const CONSTATS_INTROUVABLE_REQUIS = 2;
/** Délai minimal depuis le premier constat « introuvable ». */
export const DELAI_RETRAIT_INTROUVABLE_MS = 24 * 3_600_000;
/** Une mesure d'écart n'est « vérifiée » que si elle date de moins d'une heure. */
export const VALIDITE_MESURE_ECART_MS = 3_600_000;

/** Mesure d'écart minimale (forme de `EcartCalendrier`, sans dépendance). */
export interface MesureEcartMinimale {
  luLe: string;
  verifie: boolean;
  absents: number;
  /** Jamais mesuré : aucune mesure n'a été écrite (la mesure rendue n'est alors qu'un gabarit). */
  jamaisMesuree?: boolean;
}

/** VRAI seulement pour une mesure VÉRIFIÉE, de moins d'une heure, sans écart « absents » : jamais « non vérifié », jamais « jamais mesuré ». */
export function mesureVerifieeRecente(m: MesureEcartMinimale | null | undefined, maintenantMs: number): boolean {
  if (!m || m.jamaisMesuree || !m.verifie || m.absents > 0) return false;
  const lu = Date.parse(m.luLe);
  return Number.isFinite(lu) && maintenantMs - lu <= VALIDITE_MESURE_ECART_MS;
}
