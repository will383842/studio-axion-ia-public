/**
 * RETOUCHES RAPIDES (S3-05) — quelques boutons de retouche en opérations typées, SANS Claude. Pur : lit le plan,
 * rend la liste des retouches applicables. `demande` est la phrase écrite au journal quand le bouton est appliqué
 * (par l'action `appliquer` existante de la route, qui revalide). Jamais `modifier-script`, jamais d'ajout de pièce.
 */
import type { OperationRetouche } from "@/briques/operations";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { TRANSITIONS } from "@/briques/plan-scenes/zones";
import { lireOperations } from "./schema";

export interface RetoucheRapide {
  id: string;
  libelle: string;
  demande: string;
  operations: OperationRetouche[];
}

/** Transition la plus sobre : le fondu (déduit de `TRANSITIONS`, pas inventé). */
const SOBRE = TRANSITIONS.find((t) => t === "fondu") ?? TRANSITIONS[0];
/** Pas d'adoucissement du zoom (le schéma borne `facteur` entre 1 et 2,5). */
const PAS_ZOOM = 0.1;

type SceneLue = PlanValide["scenes"][number];

function facteurZoom(s: SceneLue): number | undefined {
  const lire = (p: unknown) => (p && typeof p === "object" && typeof (p as { facteur?: unknown }).facteur === "number" ? (p as { facteur: number }).facteur : undefined);
  const calque = s.calques?.find((c) => c.piece === "zoom-camera");
  if (calque) return lire(calque.parametres);
  return s.piece === "zoom-camera" ? lire(s.parametres) : undefined;
}

export function retouchesRapides(plan: PlanValide): RetoucheRapide[] {
  const liste: RetoucheRapide[] = [];
  const ajouter = (id: string, libelle: string, demande: string, brutes: unknown[]) => {
    const { operations } = lireOperations(brutes);
    if (operations.length === brutes.length && operations.length > 0) liste.push({ id, libelle, demande, operations });
  };

  if (plan.scenes.length > 0) {
    ajouter("plus-dynamique", "Plus dynamique", "Rendre la vidéo un peu plus dynamique.", [{ type: "ajouter-dynamisme", intensite: "leger" }]);
    ajouter("beaucoup-plus-dynamique", "Beaucoup plus dynamique", "Rendre la vidéo beaucoup plus dynamique.", [{ type: "ajouter-dynamisme", intensite: "fort" }]);
  }

  const zooms = plan.scenes.flatMap((s) => {
    const f = facteurZoom(s);
    return f !== undefined && f > 1 ? [{ type: "ajuster-zoom", sceneId: s.id, facteur: Math.max(1, Math.round((f - PAS_ZOOM) * 100) / 100) }] : [];
  });
  if (zooms.length) ajouter("zooms-plus-doux", "Zooms plus doux", "Rendre les zooms plus doux.", zooms);

  if (plan.habillage.fond !== "noir") ajouter("fond-sombre", "Fond sombre", "Passer la vidéo sur fond sombre.", [{ type: "changer-habillage", habillage: { fond: "noir" } }]);
  if (plan.habillage.fond !== "ivoire") ajouter("fond-clair", "Fond clair", "Passer la vidéo sur fond clair.", [{ type: "changer-habillage", habillage: { fond: "ivoire" } }]);

  if (plan.scenes.some((s) => s.transition.entree !== SOBRE || s.transition.sortie !== SOBRE))
    ajouter("transitions-plus-simples", "Transitions plus simples", "Utiliser des transitions plus simples.", [{ type: "changer-transition", entree: SOBRE, sortie: SOBRE }]);

  const derniere = [...plan.scenes].reverse().find((s) => s.calques?.length);
  const piece = derniere?.calques?.[derniere.calques.length - 1]?.piece;
  if (derniere && piece) ajouter("retirer-derniere-piece", "Retirer la dernière pièce ajoutée", "Retirer la dernière pièce ajoutée.", [{ type: "retirer-piece", sceneId: derniere.id, piece }]);

  return liste.slice(0, 8);
}
