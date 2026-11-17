/**
 * Utilitaire de test (17/11, Williams) : sans choix, `planDesFins` ne pose plus aucune fin. Les tests dont le sujet est la
 * fin « diagnostic + lien » elle-même la construisent ici, explicitement, depuis la table (`suiteDeFins`) et les écrans
 * (`ecransDeFin`) : mêmes lignes, mêmes écrans qu'avant, un plan par suite distincte.
 */
import { ErreurFin, suiteDeFins, TABLE_FINS_DIAGNOSTIC, type FinTable } from "@/briques/fins";
import { FINS_DIAGNOSTIC, type ReseauCas } from "@/formats/cas-concret";
import type { FinPlanifiee, PlanDesFins } from "@/moteurs/montage-cas-concret/fiche";
import { ecransDeFin } from "@/moteurs/montage-cas-concret/fins";

export interface DemandePlanDiagnostic {
  reseaux: readonly ReseauCas[];
  mot: string;
  motDit?: string;
  table?: readonly FinTable[];
}

/** Le plan où chaque réseau a sa fin « diagnostic + lien » (une fin par suite distincte, comme `planDesFins`). */
export function planDiagnostic(d: DemandePlanDiagnostic): PlanDesFins {
  const table = d.table ?? TABLE_FINS_DIAGNOSTIC;
  const options = { mot: d.mot, ...(d.motDit ? { motDit: d.motDit } : {}) };
  const groupes = new Map<string, { reseaux: ReseauCas[]; ids: readonly string[] }>();
  for (const reseau of new Set(d.reseaux)) {
    const ids = FINS_DIAGNOSTIC[reseau];
    const g = groupes.get(ids.join("|")) ?? { reseaux: [], ids };
    groupes.set(ids.join("|"), g);
    g.reseaux.push(reseau);
  }
  const fins: FinPlanifiee[] = [];
  const sansFin: PlanDesFins["sansFin"] = [];
  for (const { reseaux, ids } of groupes.values()) {
    try {
      const appels = suiteDeFins(reseaux[0], [...ids], options, table);
      fins.push({ id: `fin-${reseaux.join("-")}`, reseaux, appels, ecrans: ecransDeFin(appels, d.mot) });
    } catch (e) {
      if (!(e instanceof ErreurFin)) throw e;
      sansFin.push({ reseaux, raison: e.message });
    }
  }
  return { fins, reduites: [], sansFin };
}
