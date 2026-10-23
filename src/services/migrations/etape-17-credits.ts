/**
 * MIGRATION — étape 17 (D2, `docs/LOT-INTENSITE-CREDITS-EXECUTION.md`) : crédits et voix par format.
 * - Aucune donnée inventée : aucune recharge de départ n'est créée (le solde suivi reste « inconnu » tant que Will n'a
 *   pas déclaré sa dernière recharge ; le solde HeyGen se lit chez HeyGen).
 * - Voix par format : aucun choix de Will réécrit (le réglage est vide tant qu'il ne l'a pas fait).
 * - Seul rattrapage : une réservation restée « active » alors que son travail est terminé, arrêté ou en échec (arrêt du
 *   serveur au mauvais moment) est libérée (jamais effacée : son statut change).
 * Idempotente : un second passage ne change rien (renvoie null).
 */
import type { Depots } from "@/domaine/depots";

export async function etape17Credits(d: Depots, maintenant: string): Promise<Record<string, unknown> | null> {
  let liberees = 0;
  let consommees = 0;
  for (const r of await d.reservations.lister((x) => x.statut === "active" && !!x.travailId)) {
    const t = await d.travaux.obtenir(r.travailId!);
    if (t && (t.statut === "en_file" || t.statut === "en_cours")) continue;
    const issue = t?.statut === "termine" ? "consommee" : "liberee";
    await d.reservations.modifier(r.id, { statut: issue, libereeLe: maintenant });
    if (issue === "consommee") consommees++;
    else liberees++;
  }
  return liberees || consommees ? { reservationsLiberees: liberees, reservationsConsommees: consommees } : null;
}
