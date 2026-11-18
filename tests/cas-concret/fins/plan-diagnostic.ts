/**
 * Utilitaire de test (17/11, Williams) : sans choix, `planDesFins` ne pose plus aucune fin. Les tests dont le sujet est la
 * fin « diagnostic + lien » elle-même la construisent ici, explicitement, depuis la table (`suiteDeFins`) et les écrans
 * (`ecransDeFin`) : mêmes lignes, mêmes écrans qu'avant, un plan par suite distincte.
 */
import { expect } from "vitest";
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

/**
 * Simule la fin « diagnostic » choisie, D1 à venir (FIX-CC-FIN-CHOIX) ; table source intacte : les deux lignes de la fin au mot
 * de Facebook (`fin-if-mot`, `fin-if-envoi-structure`) reçoivent les phrases de `fin-if-diagnostic-gratuit` et `fin-fb-lien-commentaire`.
 */
export function tableFinChoisieDiagnostic(): FinTable[] {
  const ligne = (id: string) => TABLE_FINS_DIAGNOSTIC.find((l) => l.id === id)!;
  return TABLE_FINS_DIAGNOSTIC.map((l) => (l.id === "fin-if-mot" ? { ...ligne("fin-if-diagnostic-gratuit"), id: l.id } : l.id === "fin-if-envoi-structure" ? { ...ligne("fin-fb-lien-commentaire"), id: l.id } : l));
}

/** Les phrases dites par la fin fabriquée sont, mot pour mot, celles du diagnostic de la table source, dans cet ordre. */
export function verifierPhrasesDiagnostic(appels: readonly { dit: string }[]): void {
  const ligne = (id: string) => TABLE_FINS_DIAGNOSTIC.find((l) => l.id === id)!;
  expect(appels.map((a) => a.dit)).toEqual([ligne("fin-if-diagnostic-gratuit").dit, ligne("fin-fb-lien-commentaire").dit]);
}
