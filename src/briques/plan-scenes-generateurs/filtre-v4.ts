/**
 * BR-FA-PLAN-FILTRE-a — filtre PUR du plan de scènes face caméra animée : aucune pièce ne se pose PENDANT une plaquette v4
 * (`VideoAnimeeV4.tsx` dessine le plan de scènes par-dessus). NON BRANCHÉ (le branchement est BR-FA-PLAN-FILTRE-b). Ne lève jamais.
 * Modèle : `dessin-facecam.ts` (retirer ce qui chevauche).
 */
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";

export interface IntervalleMs {
  debutMs: number;
  finMs: number;
}

/** Marge de sécurité de part et d'autre d'une plaquette (ms). */
export const MARGE_V4_MS = 200;

const bon = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Intervalles (ms) des éléments v4 du plan du réalisateur (`elementsV4[].debut/fin`, en secondes). Un élément absurde est ignoré. PUR. */
export function intervallesV4(plan: PlanFacecamAnimee): IntervalleMs[] {
  try {
    const elements = Array.isArray(plan?.elementsV4) ? plan.elementsV4 : [];
    const r: IntervalleMs[] = [];
    for (const e of elements) {
      if (!e || !bon(e.debut) || !bon(e.fin) || e.fin <= e.debut) continue;
      r.push({ debutMs: Math.round(e.debut * 1000), finMs: Math.round(e.fin * 1000) });
    }
    return r;
  } catch {
    return [];
  }
}

/**
 * Retire toute scène dont l'intervalle chevauche `[debutMs - marge, finMs + marge]` d'un élément. Garde l'ordre et les empreintes ;
 * rien à retirer (ou entrée absurde) → le plan reçu, tel quel ; plus aucune scène → `scenes: []`. PUR.
 */
export function retirerPiecesSousV4(plan: PlanValide, elements: readonly IntervalleMs[], margeMs = MARGE_V4_MS): PlanValide {
  try {
    if (!plan || !Array.isArray(plan.scenes) || !Array.isArray(elements)) return plan;
    const marge = bon(margeMs) && margeMs >= 0 ? margeMs : MARGE_V4_MS;
    const valides = elements.filter((e) => e && bon(e.debutMs) && bon(e.finMs) && e.finMs > e.debutMs);
    if (!valides.length) return plan;
    const gardees = plan.scenes.filter((s) => !valides.some((e) => s.debutMs < e.finMs + marge && e.debutMs - marge < s.finMs));
    return gardees.length === plan.scenes.length ? plan : { ...plan, scenes: gardees };
  } catch {
    return plan;
  }
}
