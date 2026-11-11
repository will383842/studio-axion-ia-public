/**
 * TRANCHE D'UN PLAN (lot R2) — les scènes d'un plan qui tombent dans [debutMs, finMs[, décalées pour commencer à 0.
 * Sert aux générateurs qui rendent leur vidéo par morceaux (un écran du Cas concret) : l'empreinte de la tranche ne
 * dépend ni de la place du morceau dans la vidéo ni des mots des autres morceaux, donc seul un morceau dont les scènes
 * changent est rendu à nouveau.
 */
import { avecEmpreintes } from "../plan-scenes/empreinte";
import type { PlanDeScenes, PlanValide, ScenePlan } from "../plan-scenes/schema";

export function tranchePlan(plan: PlanValide, debutMs: number, finMs: number): PlanValide | null {
  const dureeMs = Math.max(0, finMs - debutMs);
  const scenes = plan.scenes
    .filter((s) => s.finMs > debutMs && s.debutMs < finMs)
    .map((s, i) => {
      const { empreinte: _e, ...reste } = s;
      void _e;
      return {
        ...reste,
        // Identifiant par rang dans la tranche (les identifiants du plan entier changent dès qu'une scène s'ajoute avant).
        id: `t${i + 1}`,
        // Les indices de mots n'ont de sens que dans le plan entier : neutralisés pour une empreinte stable.
        mots: { premier: 0, dernier: 0 },
        debutMs: Math.max(0, s.debutMs - debutMs),
        finMs: Math.min(dureeMs, s.finMs - debutMs),
        calques: s.calques,
      } as ScenePlan;
    })
    .filter((s) => s.finMs > s.debutMs);
  if (!scenes.length) return null;
  const { scenes: _s, ...entete } = plan;
  void _s;
  const tranche: PlanDeScenes = { ...entete, dureeMs, mots: [], scenes };
  return avecEmpreintes(tranche);
}
