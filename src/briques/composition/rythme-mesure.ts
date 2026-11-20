/** C10-15-b2 : éteint par défaut, seul `true` allume. */
export const RYTHME_MESURE_ACTIF = false;
import type { PlanDeScenes } from "@/briques/plan-scenes/schema";

/** Valeurs « à mesurer », jamais bloquantes : elles ne produisent qu'une réserve « À vérifier ». */
export const SEUIL_PLAGE_CALME_MS = 4000;
export const SEUIL_EVENEMENTS_MIN_PAR_MINUTE = 12;

export type MesureRythme = {
  plusLonguePlageMs: number;
  debutPlageMs: number;
  evenementsParMinute: number;
  evenements: number;
  reserves: string[];
};

const fini = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const secondes = (ms: number) => String(Math.round(ms / 100) / 10).replace(".", ",");

/**
 * Mesure pure du rythme d'un plan de scènes fini. Aucune exception, aucun statut d'échec :
 * un plan vide ou incohérent rend une mesure à 0 et une réserve « À vérifier ».
 */
export function mesurerRythme(plan: Pick<PlanDeScenes, "dureeMs" | "scenes">): MesureRythme {
  const duree = fini(plan?.dureeMs) && plan.dureeMs > 0 ? plan.dureeMs : 0;
  if (duree === 0) {
    return { plusLonguePlageMs: 0, debutPlageMs: 0, evenementsParMinute: 0, evenements: 0, reserves: ["À vérifier : durée du plan nulle ou illisible, rythme non mesurable"] };
  }
  const reserves: string[] = [];
  const bornes = (v: number) => Math.min(Math.max(v, 0), duree);
  const instants = new Set<number>();
  let finMax: number | null = null;
  let incoherent = false;
  for (const s of Array.isArray(plan.scenes) ? plan.scenes : []) {
    if (!fini(s?.debutMs)) { incoherent = true; continue; }
    instants.add(bornes(s.debutMs));
    if (fini(s.finMs)) {
      if (s.finMs < s.debutMs) incoherent = true;
      else finMax = finMax === null ? s.finMs : Math.max(finMax, s.finMs);
    } else incoherent = true;
    for (const c of s.calques ?? []) {
      if (fini(c?.debutMs)) instants.add(bornes(s.debutMs + c.debutMs));
      else incoherent = true;
    }
  }
  if (finMax !== null) instants.add(bornes(finMax));
  const evenements = instants.size;
  const points = [...new Set([0, ...instants, duree])].sort((a, b) => a - b);
  let plusLonguePlageMs = 0;
  let debutPlageMs = 0;
  for (let i = 1; i < points.length; i++) {
    const ecart = points[i] - points[i - 1];
    if (ecart > plusLonguePlageMs) { plusLonguePlageMs = ecart; debutPlageMs = points[i - 1]; }
  }
  const evenementsParMinute = Math.round((evenements / (duree / 60000)) * 10) / 10;
  if (incoherent) reserves.push("À vérifier : scène incohérente (bornes illisibles ou fin avant début)");
  if (plusLonguePlageMs > SEUIL_PLAGE_CALME_MS) reserves.push(`À vérifier : plage sans changement de ${secondes(debutPlageMs)} s à ${secondes(debutPlageMs + plusLonguePlageMs)} s`);
  if (evenementsParMinute < SEUIL_EVENEMENTS_MIN_PAR_MINUTE) reserves.push(`À vérifier : rythme lent (${String(evenementsParMinute).replace(".", ",")} événements par minute)`);
  return { plusLonguePlageMs, debutPlageMs, evenementsParMinute, evenements, reserves };
}
