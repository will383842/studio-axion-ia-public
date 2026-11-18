/**
 * BR-OBJETS-b (= C9-36b) — pose les petits objets (gros chiffre, étape, cartes à coche, coche) dans les TROUS d'un plan de
 * scènes, par les règles fixes de `objetsDepuisMots` (aucun appel à Claude, rien d'inventé : valeurs et mots recopiés de ce
 * qui est dit). Fonction PURE ; `permis` vide = le MÊME objet rendu (éteint). Ne lève jamais.
 * Une proposition qui chevauche une scène existante (ou une autre proposition) est abandonnée : jamais deux choses à l'écran.
 */
import { objetsDepuisMots } from "../plan-scenes-objets/regles";
import type { MotMinute, PlanDeScenes, ScenePlan } from "../plan-scenes/schema";

const TRANSITION_OBJET = { entree: "fondu", sortie: "fondu", dureeMs: 400 } as const;

export function poserObjetsAuPlan(plan: PlanDeScenes, mots: MotMinute[], permis: readonly string[]): PlanDeScenes {
  try {
    if (!Array.isArray(permis) || permis.length === 0 || !Array.isArray(mots) || mots.length === 0) return plan;
    const propositions = objetsDepuisMots(mots, { permis });
    if (propositions.length === 0) return plan;
    const occupees: { debutMs: number; finMs: number }[] = plan.scenes.map((s) => ({ debutMs: s.debutMs, finMs: s.finMs }));
    const dureeMs = plan.dureeMs;
    const neuves: ScenePlan[] = [];
    for (const p of propositions) {
      const debutMs = Math.round(p.debutSec * 1000);
      const finMs = Math.min(Math.round(p.finSec * 1000), Math.round(dureeMs));
      if (!(finMs > debutMs)) continue;
      if (occupees.some((o) => debutMs < o.finMs && o.debutMs < finMs)) continue;
      let premier = mots.findIndex((m) => m.debutMs >= debutMs - 1);
      if (premier < 0) premier = mots.length - 1;
      let dernier = premier;
      mots.forEach((m, i) => {
        if (i >= premier && m.debutMs < finMs) dernier = i;
      });
      occupees.push({ debutMs, finMs });
      neuves.push({
        id: `o${neuves.length + 1}`,
        version: 1,
        mots: { premier, dernier },
        debutMs,
        finMs,
        niveau: 1,
        position: "centre",
        transition: { ...TRANSITION_OBJET },
        piece: p.id,
        parametres: p.parametres,
      } as ScenePlan);
    }
    if (neuves.length === 0) return plan;
    return { ...plan, scenes: [...plan.scenes, ...neuves].sort((a, b) => a.debutMs - b.debutMs) };
  } catch {
    return plan;
  }
}
