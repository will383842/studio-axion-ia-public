/**
 * HISTORIQUE v4 (19/10/2026) — PUR. Ce qu'un plan `elementsV4` laisse dans l'historique : la suite des plaquettes dans l'ordre où elles
 * apparaissent (répétitions comprises, d'où leur compte) et la plaquette d'ouverture. Lu par la CONSIGNE seulement (`blocPlaquettesV4`) : aucune règle n'en dépend.
 */
import type { ElementV4Plan } from "@/domaine/facecam-animee/plan";

export function historiqueV4(elements: readonly Pick<ElementV4Plan, "id" | "debut">[] | undefined): { plaquettesV4: string[]; ouvertureV4?: string } {
  const triees = [...(elements ?? [])].sort((x, y) => x.debut - y.debut);
  return { plaquettesV4: triees.map((e) => e.id), ...(triees.length ? { ouvertureV4: triees[0].id } : {}) };
}
