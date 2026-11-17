/**
 * APERÇU DE LA FIN EN OUVERTURE (X1-12) : choisit, dans le plan de LA MÊME vidéo, une scène de résultat
 * (≤ 1,2 s, sans visage) à montrer en ouverture. Pur : aucun service, aucun réglage, aucun rendu. Non branché.
 * Décision E1-3 : permis seulement pour le tutoriel et la démo (le résultat y est une vraie capture).
 * Honnêteté : rien n'est inventé, la scène renvoyée est une scène du plan reçu.
 */
import type { PlanDeScenes } from "../plan-scenes/schema";
import { devantLeVisage, type Position } from "../plan-scenes/zones";

/** Éteint par défaut : seul `true` allume. */
export const APERCU_OUVERTURE_ACTIF = false;
/** Durée maximale de l'aperçu (ms). */
export const DUREE_APERCU_MAX_MS = 1200;

const GENERATEURS_PERMIS = ["tutoriel-outil", "demo-facecam"] as const;
/** Pièces qui montrent un résultat. */
const PIECES_RESULTAT: readonly string[] = ["tableau-de-bord", "graphique", "carte-kpi", "liste-crm", "avant-apres", "jauge"];

export type ApercuFin = { type: "rien" } | { type: "apercu"; sceneId: string; debutMs: number; finMs: number };

/** Vrai seulement pour le tutoriel et la démo (décision E1-3). */
export function apercuPermisPour(generateur: string): boolean {
  return (GENERATEURS_PERMIS as readonly string[]).includes(generateur);
}

type SceneLue = { id: string; piece: string; debutMs: number; finMs: number; position: Position; calques?: { zone: Position }[] };

/** Plan lu (structurel) : accepte tout plan de scènes, sans le modifier. */
export function apercuDeLaFin(plan: Pick<PlanDeScenes, "facecam" | "scenes">, generateur: string): ApercuFin {
  if (!apercuPermisPour(generateur)) return { type: "rien" };
  const scenes = plan.scenes as unknown as SceneLue[];
  let choisie: SceneLue | undefined;
  for (const s of scenes) {
    if (!PIECES_RESULTAT.includes(s.piece) || !(s.finMs > s.debutMs)) continue;
    if (plan.facecam && (devantLeVisage(s.position) || (s.calques ?? []).some((c) => devantLeVisage(c.zone)))) continue;
    // la plus proche de la fin ; à égalité, la première du plan
    if (!choisie || s.finMs > choisie.finMs) choisie = s;
  }
  if (!choisie) return { type: "rien" };
  return { type: "apercu", sceneId: choisie.id, debutMs: choisie.debutMs, finMs: Math.min(choisie.finMs, choisie.debutMs + DUREE_APERCU_MAX_MS) };
}
