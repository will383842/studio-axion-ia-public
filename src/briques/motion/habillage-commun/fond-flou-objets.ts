/**
 * Fond flou sous le carton magazine (C10-04b) : calcul PUR des fenêtres à partir du plan de scènes validé.
 * Une fenêtre par scène (ou calque de niveau 2) qui porte `objet-carton-magazine`, avec les valeurs de
 * `FOND_FLOU_DEFAUT`. Le flou vise le décor, jamais le visage (`cible: "decor"`, comme `fond-flou-carte.ts`).
 * Aucun hasard, aucune date. Plan sans carton : liste vide.
 */
import type { PlanValide } from "../../plan-scenes/schema";
import { FOND_FLOU_DEFAUT, type FenetreFondFlou } from "./fond-flou-carte";

const CARTON_MAGAZINE = "objet-carton-magazine";

export function fondFlouObjets(plan: PlanValide | undefined): FenetreFondFlou[] {
  if (!plan) return [];
  const brutes: { debutSec: number; finSec: number }[] = [];
  for (const s of plan.scenes) {
    if (s.finMs <= s.debutMs) continue;
    if (s.piece === CARTON_MAGAZINE) brutes.push({ debutSec: s.debutMs / 1000, finSec: s.finMs / 1000 });
    else for (const c of s.calques ?? []) if (c.piece === CARTON_MAGAZINE && s.debutMs + c.debutMs < s.finMs) brutes.push({ debutSec: (s.debutMs + c.debutMs) / 1000, finSec: s.finMs / 1000 });
  }
  brutes.sort((a, b) => a.debutSec - b.debutSec || a.finSec - b.finSec);
  const fenetres: FenetreFondFlou[] = [];
  for (const b of brutes) {
    const derniere = fenetres[fenetres.length - 1];
    if (derniere && b.debutSec <= derniere.finSec + 1e-6) derniere.finSec = Math.max(derniere.finSec, b.finSec);
    else fenetres.push({ ...b, ...FOND_FLOU_DEFAUT, cible: "decor" });
  }
  return fenetres;
}
