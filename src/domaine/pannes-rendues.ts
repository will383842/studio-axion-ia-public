/**
 * Pannes « non relié » RENDUES par un moteur (et non levées) : le serveur de rendu ou le stockage est absent, l'échec
 * tombe AVANT tout appel payant. Le travail attend et repart seul (comme une panne levée), au lieu de finir en échec.
 * Liste FERMÉE : aucun autre code (refus de contenu, `*_REFUS`, attente de validation, crédit) n'y entre.
 * Module pur : aucune dépendance.
 */
export const CODES_PANNE_RENDUE = ["TABLEAU_NON_RELIE", "CAS_CONCRET_NON_RELIE", "FACECAM_NON_RELIE", "FACECAM_ANIMEE_NON_RELIE", "IV_NON_RELIE"] as const;

/** Vrai si l'erreur est l'un des 5 codes ET marquée `reessayable: true` (la voix non épinglée du cas concret reste un échec). */
export function estPanneRendue(erreur: { code?: string; reessayable?: boolean } | null | undefined): boolean {
  return !!erreur && erreur.reessayable === true && (CODES_PANNE_RENDUE as readonly string[]).includes(erreur.code ?? "");
}
