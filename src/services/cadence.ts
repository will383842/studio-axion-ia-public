/**
 * Service des créneaux occupés (L3-17) : UNE SEULE définition de « occupé ».
 * Un créneau du plan occupe chacun de ses réseaux ayant une heure, sauf s'il est archivé (annuler = archiver).
 * LECTURE SEULE : seul `lister` du dépôt est appelé, jamais d'écriture. Dépôt injecté (doublure en test), aucun appel réel.
 */
import "server-only";
import type { Depot } from "@/domaine/depots";
import { heureAffichageParis } from "@/domaine/plan-editorial/statuts";
import type { CreneauPlan } from "@/services/plan-editorial";

export interface CreneauOccupe {
  creneauId: string;
  reseau: string;
  /** AAAA-MM-JJ (jour de Paris). */
  jour: string;
  /** HH:MM (heure de Paris). */
  heure: string;
  /** Instant de publication, ISO en UTC. */
  instant: string;
}

/** La définition unique : tout statut occupe sauf « archive ». */
export function estOccupe(c: Pick<CreneauPlan, "statut">): boolean {
  return c.statut !== "archive";
}

/** Créneaux occupés dont le jour visé est entre `du` et `au` (inclus), triés par jour, heure, puis id. Plusieurs le même jour sont tous rendus. */
export async function creneauxOccupes(
  depot: Pick<Depot<CreneauPlan>, "lister">, du: string, au: string, options: { reseau?: string } = {},
): Promise<CreneauOccupe[]> {
  const liste = await depot.lister((c) => c.jourVise >= du && c.jourVise <= au && estOccupe(c));
  const rendus: CreneauOccupe[] = [];
  for (const c of liste) {
    for (const [reseau, instant] of Object.entries(c.heuresParReseau)) {
      if (!instant || (options.reseau && reseau !== options.reseau)) continue;
      rendus.push({ creneauId: c.id, reseau, jour: c.jourVise, heure: heureAffichageParis(instant), instant });
    }
  }
  return rendus.sort((a, b) => a.jour.localeCompare(b.jour) || a.instant.localeCompare(b.instant) || a.creneauId.localeCompare(b.creneauId));
}

/** Réseaux occupés un jour donné (sans doublon, triés). */
export async function reseauxOccupes(depot: Pick<Depot<CreneauPlan>, "lister">, jour: string): Promise<string[]> {
  const r = await creneauxOccupes(depot, jour, jour);
  return [...new Set(r.map((o) => o.reseau))].sort();
}
