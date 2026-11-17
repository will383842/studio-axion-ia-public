/**
 * PROPRIÉTÉS DE RENDU DU MONTAGE « DONNÉES » (G4-09a) — PUR, imports de TYPES seulement, sur le modèle de
 * `montage-tutoriel-outil/proprietes.ts`. La composition porte ce nom ; elle est branchée par G4-09b, pas ici.
 * La vidéo = le plan de scènes validé (pièces de données, pas de visage) + la voix (absente : muette) + les sous-titres.
 */
import type { DonneesCalque } from "../../briques/sous-titres/scene";
import type { FormatPlan, HabillagePlan, PlanValide } from "../../briques/plan-scenes/schema";

export const COMPOSITION_DONNEES = "MontageDonnees";

type RatioDonnees = "9:16" | "1:1" | "4:5" | "16:9";
const TAILLES: Record<RatioDonnees, { largeur: number; hauteur: number }> = { "9:16": { largeur: 1080, hauteur: 1920 }, "4:5": { largeur: 1080, hauteur: 1350 }, "1:1": { largeur: 1080, hauteur: 1080 }, "16:9": { largeur: 1920, hauteur: 1080 } };

export function formatDuRatioDonnees(ratio: RatioDonnees): FormatPlan {
  return { ...TAILLES[ratio], fps: 25 };
}

/** Habillage : fond ivoire, accent terracotta (l'orange n'existe que sur noir). */
export const HABILLAGE_DONNEES: HabillagePlan = { fond: "ivoire", accent: "terracotta" };

export type ProprietesMontageDonnees = {
  plan: PlanValide;
  /** Adresse signée de la voix ; absente : variante muette (sous-titres seuls). */
  audio?: string;
  /** Calque des sous-titres (brique coupée : absent). */
  sousTitres?: DonneesCalque;
};

/** Fabrique pure : aucun champ vide n'est posé. */
export function proprietesMontageDonnees(entree: { plan: PlanValide; audio?: string; sousTitres?: DonneesCalque }): ProprietesMontageDonnees {
  return { plan: entree.plan, ...(entree.audio ? { audio: entree.audio } : {}), ...(entree.sousTitres ? { sousTitres: entree.sousTitres } : {}) };
}

export function dureeImagesDonnees(p: Pick<ProprietesMontageDonnees, "plan">): number {
  return Math.max(1, Math.ceil((p.plan.dureeMs * p.plan.format.fps) / 1000));
}
