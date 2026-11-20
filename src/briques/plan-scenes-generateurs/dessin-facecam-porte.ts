/**
 * C5-5.08a : porte PURE du dessin du plan de scènes face caméra. NON BRANCHÉE : rien n'appelle ce fichier
 * (C5-5.08 le branchera dans `supplements`, `chaine.ts`). Deux réglages (P-8) + porte de la bibliothèque (§ 3.4).
 * Éteint = plan rendu tel quel (même objet). Ne lève jamais.
 */
import { porteCapacite } from "../bibliotheque-video/moteur";
import { ID } from "../bibliotheque-video/noms";
import type { PlanValide } from "../plan-scenes/schema";
import type { Rectangle } from "../plan-scenes/zones";
import { filtrerPlanFacecam, type RaisonRetrait } from "./dessin-facecam";
import type { LireReglage } from "./reglage";

export const CLE_REGLAGE_DESSIN_FACECAM = "planScenes.facecamDessin";

/** ALLUMÉ par défaut (décision Williams 20/11) : seul `false` exact éteint ; absence, rejet, exception ou autre valeur : `true`. */
export async function dessinFacecamReglage(lire: LireReglage): Promise<boolean> {
  try {
    return (await lire(CLE_REGLAGE_DESSIN_FACECAM, true)) !== false;
  } catch {
    return true;
  }
}

/** Les deux réglages exacts à `true` ET (pas d'entrée bibliothèque, ou entrée qui permet `plan-scenes.facecam`). */
export function dessinFacecamPermis(o: { planScenesFacecam: unknown; dessin: unknown; entrees: unknown }): boolean {
  try {
    if (o.planScenesFacecam !== true || o.dessin !== true) return false;
    const porte = porteCapacite(o.entrees, ID.planScenesFacecam);
    return !porte.bibliotheque || porte.permis === true;
  } catch {
    return false;
  }
}

/** Non permis : le plan passe tel quel (même objet). Permis : filtre C5-5.07. */
export function planFacecamPourSupplements(
  plan: PlanValide | undefined,
  o: { permis: boolean; bande: Rectangle; occupes?: { debutSec: number; finSec: number }[] },
): { plan: PlanValide | undefined; retirees: { id: string; raison: RaisonRetrait }[] } {
  if (!plan) return { plan: undefined, retirees: [] };
  if (o.permis !== true) return { plan, retirees: [] };
  return filtrerPlanFacecam(plan, { bande: o.bande, occupes: o.occupes });
}
