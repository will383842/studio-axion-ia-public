/**
 * Brique 3 (relire le script) : un cas sans script validé s'arrête avant la voix pour que Will relise et valide le
 * script. Cet arrêt n'est pas un échec : l'étape s'affiche « À relire ». PUR, importable côté client.
 */
import type { EtapeTravail, ErreurTravail, StatutTravail } from "@/domaine/types";

/** = `CODE_SCRIPT_A_VALIDER` du moteur (recopié pour ne pas charger le moteur côté client ; un test les compare). */
export const CODE_A_RELIRE = "CAS_CONCRET_SCRIPT_A_VALIDER";

/** La clé de l'étape arrêtée pour la relecture du script ; `null` : aucune (en cours, fini, ou vrai échec). */
export function etapeARelire(t: { statut: StatutTravail; erreur?: ErreurTravail; etapes: readonly Pick<EtapeTravail, "cle" | "statut" | "erreur">[] }): string | null {
  if (t.statut !== "echec") return null;
  const arretee = t.etapes.find((e) => e.statut === "echec");
  return (arretee?.erreur ?? t.erreur)?.code === CODE_A_RELIRE ? (arretee?.cle ?? null) : null;
}
