/**
 * MIGRATION — étape 18, réservée à D3 (`docs/LOT-INTENSITE-CREDITS-EXECUTION.md`) : calage (rien à migrer a priori : laissée vide si inutile).
 * Posée VIDE par l'architecte le 02/10 pour que les développeurs en parallèle ne se disputent pas `services/migrations.ts`.
 * Règles (contrat d'exécution) : idempotente, testée, AUCUNE suppression ; renvoie un résumé (ou null si rien n'a changé),
 * rangé dans `rapport.lots["calage"]`.
 */
import type { Depots } from "@/domaine/depots";

export async function etape18Calage(d: Depots, maintenant: string): Promise<Record<string, unknown> | null> {
  void d;
  void maintenant;
  return null;
}
