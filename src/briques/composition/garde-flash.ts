import type { PlanDeScenes } from "@/briques/plan-scenes/schema";

/** Valeurs « à mesurer », jamais bloquantes : elles ne produisent qu'une réserve « À vérifier ». */
export const FENETRE_FLASH_MS = 1000;
export const SEUIL_FLASHS_PAR_FENETRE = 3;

/** Transitions de la famille « lumière » : un éclat bref (flash ivoire, reflet). */
const TRANSITIONS_FLASH: ReadonlySet<string> = new Set(["flash-ivoire", "reflet-entree"]);

export type MesureFlash = {
  flashs: number;
  maxParSeconde: number;
  debutFenetreMs: number;
  reserves: string[];
};

const fini = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const secondes = (ms: number) => String(Math.round(ms / 100) / 10).replace(".", ",");

/**
 * Mesure pure : compte, par fenêtre glissante d'1 s, les flashs d'un plan de scènes fini
 * (entrée au début de la scène, sortie à fin − durée). Jamais bloquante : plus de 3 flashs
 * dans la fenêtre donne seulement une réserve « À vérifier ». Aucune exception, aucune horloge.
 */
export function mesurerFlashs(plan: Pick<PlanDeScenes, "dureeMs" | "scenes">): MesureFlash {
  const instants: number[] = [];
  for (const s of Array.isArray(plan?.scenes) ? plan.scenes : []) {
    const t = s?.transition;
    if (!t || !fini(s.debutMs)) continue;
    if (TRANSITIONS_FLASH.has(t.entree)) instants.push(s.debutMs);
    if (TRANSITIONS_FLASH.has(t.sortie) && fini(s.finMs)) instants.push(s.finMs - (fini(t.dureeMs) ? t.dureeMs : 0));
  }
  instants.sort((a, b) => a - b);
  let maxParSeconde = 0;
  let debutFenetreMs = 0;
  let fin = 0;
  for (let i = 0; i < instants.length; i++) {
    if (fin < i) fin = i;
    while (fin < instants.length && instants[fin] < instants[i] + FENETRE_FLASH_MS) fin++;
    if (fin - i > maxParSeconde) { maxParSeconde = fin - i; debutFenetreMs = instants[i]; }
  }
  const reserves: string[] = [];
  if (maxParSeconde > SEUIL_FLASHS_PAR_FENETRE) {
    reserves.push(`À vérifier : ${maxParSeconde} flashs en 1 s à partir de ${secondes(debutFenetreMs)} s (limite ${SEUIL_FLASHS_PAR_FENETRE})`);
  }
  return { flashs: instants.length, maxParSeconde, debutFenetreMs, reserves };
}
