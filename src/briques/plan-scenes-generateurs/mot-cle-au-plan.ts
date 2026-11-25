/**
 * BR-MOT-CLE-a — pose le MOT-CLÉ DE RECHERCHE (X1-13 / X1-18) au plan de scènes : une scène `legende` d'un seul mot, en haut,
 * style `bandeau` (choix de Williams, 25/11), dans les 3 premières secondes. Le mot est un mot DIT (`motCleDeRecherche`), jamais reformulé.
 * Fonction PURE, ne lève jamais ; le MÊME objet est rendu quand rien ne se pose. Aucun appelant (éteint) ; la constante
 * `MOT_CLE_RECHERCHE_ACTIF` n'est PAS lue ici. À appeler APRÈS le tri de l'adaptateur (`estRetenue` jette une légende d'un mot).
 * Posée seulement si `[debutMs, finMs)` ne chevauche AUCUNE scène (même test que `objets-au-plan.ts`).
 */
import { motCleDeRecherche } from "../composition/mot-cle-recherche";
import type { MotMinute, PlanDeScenes, ScenePlan } from "../plan-scenes/schema";
import { SCENE_MIN_MS } from "../plan-scenes/zones";

/** Durée visée du mot-clé (ms) : au-dessus du minimum de lecture d'un mot (650 ms) et de `SCENE_MIN_MS`. */
export const DUREE_MOT_CLE_MS = 1200;
/** Longueur maximale du mot posé (lettres). */
export const LETTRES_MOT_CLE_MAX = 24;
export const STYLE_MOT_CLE = "bandeau" as const;
const TRANSITION_MOT_CLE = { entree: "fondu", sortie: "fondu", dureeMs: 400 } as const;

export function poserMotCleAuPlan(
  plan: PlanDeScenes,
  mots: readonly MotMinute[],
  sujet: string,
  motsInterditsEnPlus: readonly string[] = [],
): PlanDeScenes {
  try {
    if (!Array.isArray(mots) || mots.length === 0 || !plan || !Array.isArray(plan.scenes)) return plan;
    const m = motCleDeRecherche(mots, sujet, motsInterditsEnPlus);
    if (m.type !== "mot") return plan;
    if ([...m.texte].length > LETTRES_MOT_CLE_MAX || /\s/.test(m.texte)) return plan;
    const debutMs = Math.round(m.debutMs);
    const duree = Math.round(plan.dureeMs);
    const suivante = plan.scenes.filter((s) => s.debutMs >= debutMs).reduce((min, s) => Math.min(min, s.debutMs), Infinity);
    const finMs = Math.min(Math.max(Math.round(m.finMs), debutMs + DUREE_MOT_CLE_MS), duree, suivante);
    if (!(finMs - debutMs >= DUREE_MOT_CLE_MS) || finMs - debutMs < SCENE_MIN_MS) return plan;
    if (plan.scenes.some((s) => debutMs < s.finMs && s.debutMs < finMs)) return plan;
    const indice = mots.findIndex((x) => x.debutMs === m.debutMs && x.finMs === m.finMs);
    if (indice < 0) return plan;
    let n = 1;
    while (plan.scenes.some((s) => s.id === `mc${n}`)) n++;
    const scene = {
      id: `mc${n}`,
      version: 1,
      mots: { premier: indice, dernier: indice },
      debutMs,
      finMs,
      niveau: 1,
      position: "haut",
      transition: { ...TRANSITION_MOT_CLE },
      piece: "legende",
      parametres: { texte: m.texte, sousTexte: "", style: STYLE_MOT_CLE },
    } as ScenePlan;
    return { ...plan, scenes: [...plan.scenes, scene].sort((a, b) => a.debutMs - b.debutMs) };
  } catch {
    return plan;
  }
}
