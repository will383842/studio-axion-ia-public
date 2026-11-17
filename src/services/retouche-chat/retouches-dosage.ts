/**
 * RETOUCHES DE DOSAGE (X3-12a) — « Plus calme » et « Sans animations », en opérations typées, SANS Claude.
 * Constructeur pur et non branché : lit le plan, rend 0, 1 ou 2 retouches (ordre fixe). Aucune lecture de dépôt,
 * aucun appel réseau. Les sous-titres ne sont pas des pièces : ils restent. L'entrée dans `retouchesRapides`
 * est l'objet de X3-12b.
 */
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { TRANSITIONS } from "@/briques/plan-scenes/zones";
import type { RetoucheRapide } from "./retouches-rapides";
import { lireOperations } from "./schema";

/** Transition la plus sobre : le fondu (déduit de `TRANSITIONS`). */
const SOBRE = TRANSITIONS.find((t) => t === "fondu") ?? TRANSITIONS[0];
/** Pas d'adoucissement du zoom (le schéma borne `facteur` entre 1 et 2,5). */
const PAS_ZOOM = 0.1;

type SceneLue = PlanValide["scenes"][number];

const lireFacteur = (p: unknown): number | undefined =>
  p && typeof p === "object" && typeof (p as { facteur?: unknown }).facteur === "number" ? (p as { facteur: number }).facteur : undefined;

/** Zoom d'une scène : `present` s'il y a une pièce zoom, `facteur` s'il est lisible (même logique que `retouches-rapides`). */
function zoomDe(s: SceneLue): { present: boolean; facteur?: number } {
  const calque = s.calques?.find((c) => c.piece === "zoom-camera");
  if (calque) return { present: true, facteur: lireFacteur(calque.parametres) };
  return s.piece === "zoom-camera" ? { present: true, facteur: lireFacteur(s.parametres) } : { present: false };
}

export function retouchesDosage(plan: PlanValide): RetoucheRapide[] {
  const liste: RetoucheRapide[] = [];
  const ajouter = (id: string, libelle: string, demande: string, brutes: unknown[]) => {
    const { operations } = lireOperations(brutes);
    if (operations.length === brutes.length && operations.length > 0) liste.push({ id, libelle, demande, operations });
  };

  const zoomees = plan.scenes.map((s) => ({ id: s.id, ...zoomDe(s) })).filter((z) => z.present);
  const transitionNonSobre = plan.scenes.some((s) => s.transition.entree !== SOBRE || s.transition.sortie !== SOBRE);

  const adoucis = zoomees.flatMap((z) =>
    z.facteur !== undefined && z.facteur > 1 ? [{ type: "ajuster-zoom", sceneId: z.id, facteur: Math.max(1, Math.round((z.facteur - PAS_ZOOM) * 100) / 100) }] : [],
  );
  if (transitionNonSobre || adoucis.length > 0)
    ajouter("plus-calme", "Plus calme", "Rendre la vidéo plus calme.", [...(transitionNonSobre ? [{ type: "changer-transition", entree: SOBRE, sortie: SOBRE }] : []), ...adoucis]);

  // Pièces posées = calques, hors zoom (traité par `ajuster-zoom`).
  const pieces = plan.scenes.flatMap((s) => (s.calques ?? []).filter((c) => c.piece !== "zoom-camera").map((c) => ({ type: "retirer-piece", sceneId: s.id, piece: c.piece })));
  if (pieces.length > 0 || zoomees.length > 0)
    ajouter("sans-animations", "Sans animations", "Retirer les animations de la vidéo.", [
      ...pieces,
      { type: "changer-transition", entree: SOBRE, sortie: SOBRE },
      ...zoomees.map((z) => ({ type: "ajuster-zoom", sceneId: z.id, facteur: 1 })),
    ]);

  return liste;
}
