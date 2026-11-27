import "server-only";

/** S-13-d : le tableau livre « prête avec remarques » (S-13-b) : variété en remarque, pas en refus. ÉTEINT par défaut. */
export const PARAM_PRETE_AVEC_REMARQUES = "tableau.preteAvecRemarques";

/** Vrai SEULEMENT si la valeur lue est exactement `true` (absente, `"true"`, `1`, lecture en échec : éteint). SEUL lecteur de la clé. */
export async function preteAvecRemarquesActive(lire?: <T>(id: string, defaut: T) => Promise<T>): Promise<boolean> {
  try {
    const l = lire ?? (await import("./_commun")).lireParametre;
    return (await l<unknown>(PARAM_PRETE_AVEC_REMARQUES, false)) === true;
  } catch {
    return false;
  }
}
