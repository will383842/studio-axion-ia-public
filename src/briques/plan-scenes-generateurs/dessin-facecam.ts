/**
 * Filtre PUR du plan de scènes face caméra (C5-5.07) — NON BRANCHÉ (le branchement est C5-5.08, derrière `planScenes.facecamDessin`).
 * Retire les pièces en conflit avec les sous-titres, une carte / un écran partagé, ou le visage.
 * Aucune dépendance au rendu ni aux services.
 */
import { RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";
import type { FormatPlan, PlanValide } from "@/briques/plan-scenes/schema";
import { ZONES, devantLeVisage, seChevauchent, type Rectangle } from "@/briques/plan-scenes/zones";
import { donneesCalque } from "@/briques/sous-titres";
import { sceneAuTemps } from "@/briques/sous-titres/scene";
import type { SegmentRendu } from "@/briques/sous-titres/types-rendu";

export type RatioFacecam = "9:16" | "1:1" | "4:5" | "16:9";
export type RaisonRetrait = "sous-titres" | "carte" | "visage";

/** Même calcul que le constat C5-5.01 : centre des sous-titres du face caméra ± demi-hauteur dessinée (en % de l'image). */
export function bandeSousTitres(ratio: RatioFacecam, format: FormatPlan, centrePct?: number): Rectangle {
  const centre = centrePct ?? RECETTE_COMPOSITION_FACECAM.centreSousTitres[ratio as "9:16"] ?? 62;
  const segment: SegmentRendu = { id: "s", debutSec: 0, finSec: 2, mots: [{ mot: "Exemple", debutSec: 0, finSec: 1 }, { mot: "fictif", debutSec: 1, finSec: 2 }] };
  const d = donneesCalque({ segments: [segment], base: "karaoke", ratio, style: { positionPct: centre } as never });
  const e = sceneAuTemps(d, 1)!;
  const demiPct = (e.taillePx / 2 / format.hauteur) * 100;
  const centrePctDessine = (e.yPx / format.hauteur) * 100;
  return { x: 0, y: centrePctDessine - demiPct, largeur: 100, hauteur: 2 * demiPct };
}

export function filtrerPlanFacecam(
  plan: PlanValide,
  contexte: { bande: Rectangle; occupes?: { debutSec: number; finSec: number }[] },
): { plan: PlanValide; retirees: { id: string; raison: RaisonRetrait }[] } {
  const retirees: { id: string; raison: RaisonRetrait }[] = [];
  const gardees = plan.scenes.filter((s) => {
    let raison: RaisonRetrait | null = null;
    if (devantLeVisage(s.position)) raison = "visage";
    else if (seChevauchent(ZONES[s.position], contexte.bande)) raison = "sous-titres";
    else if ((contexte.occupes ?? []).some((o) => s.debutMs < o.finSec * 1000 && o.debutSec * 1000 < s.finMs)) raison = "carte";
    if (raison) retirees.push({ id: s.id, raison });
    return raison === null;
  });
  return retirees.length ? { plan: { ...plan, scenes: gardees }, retirees } : { plan, retirees };
}
