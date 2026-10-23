/**
 * MIGRATION — étape 20 (vérification de bout en bout n° 2, données n° 2 et n° 11) : les exemples de démonstration
 * semés au premier démarrage de la production (anciens sujets de droit du travail : idées, calendrier, vidéos, scripts)
 * sont MASQUÉS, jamais effacés ni réécrits.
 * - Le réglage « Afficher les exemples » est coupé (`afficherExemples = false`) : tous les écrans filtrent déjà les
 *   documents `estDemo` sur ce réglage (`filtreExemples`). Will peut le rallumer à tout moment (Réglages > Exemples).
 * - Les liens privés de démonstration encore ouverts (dont l'ancien `/v/<code>` de la démonstration) sont coupés :
 *   `revoqueLe` est posé, la ligne reste (la page répond « Ce lien n'est plus actif »).
 * - Un événement « migration » est écrit au journal.
 * Une seule fois : la trace `migrations.exemplesMasques` empêche de recouper le réglage si Will le rallume ensuite.
 * Rejouable sans effet (renvoie null au second passage). Aucune suppression.
 */
import type { Depots } from "@/domaine/depots";

export const TRACE_EXEMPLES_MASQUES = "migrations.exemplesMasques";

export async function etape20Exemples(d: Depots, maintenant: string): Promise<Record<string, unknown> | null> {
  if (await d.parametres.obtenir(TRACE_EXEMPLES_MASQUES)) return null;

  const reglage = await d.parametres.obtenir("afficherExemples");
  const etaitAffiche = (reglage?.valeur as boolean | undefined) ?? true;
  await d.parametres.enregistrer({ id: "afficherExemples", valeur: false, creeLe: reglage?.creeLe ?? maintenant, modifieLe: maintenant });

  const liens = await d.partages.lister((p) => !!p.estDemo && !p.revoqueLe);
  for (const p of liens) await d.partages.modifier(p.id, { revoqueLe: maintenant });

  await d.parametres.enregistrer({
    id: TRACE_EXEMPLES_MASQUES,
    valeur: { appliqueeLe: maintenant, etaitAffiche, liensCoupes: liens.map((p) => p.id) },
    creeLe: maintenant,
    modifieLe: maintenant,
  });
  await d.evenements.enregistrer({
    id: `ev-migration-exemples-${maintenant}`,
    type: "migration",
    message: `Exemples de démonstration masqués (Réglages > Exemples pour les revoir)${liens.length ? ` ; ${liens.length} lien${liens.length > 1 ? "s" : ""} privé${liens.length > 1 ? "s" : ""} d'exemple coupé${liens.length > 1 ? "s" : ""}` : ""}. Rien n'est effacé.`,
    date: maintenant,
    creeLe: maintenant,
    modifieLe: maintenant,
  });
  return { exemplesMasques: etaitAffiche, liensCoupes: liens.length };
}
