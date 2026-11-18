/**
 * PLAN DE SCÈNES 16:9 PAR CHAPITRE (fiche VL-05, générateur « Vidéo longue », ÉTEINT). PUR et AUTONOME : n'importe rien
 * du moteur (index, chaîne, entrées) ; seule dépendance, la brique `plan-scenes-generateurs` déjà fusionnée.
 *
 *  - repli de NIVEAU 1, sans IA : `adapterPlan` est appelé SANS fournisseur (`appeler` absent) → aucun appel à Claude, 0 € ;
 *  - format 1920×1080 à 25 images/s ;
 *  - UN plan par chapitre (jamais un plan pour toute la vidéo) : chaque plan reste sous `MAX_JETONS_PLAN_SCENES`
 *    (16 000 jetons, `plan-scenes/generateur.ts`), pour qu'un futur niveau 2 (IA) tienne en un appel par chapitre ;
 *  - les temps restent ceux de la vidéo entière (calés sur la voix recollée) : la plage d'images d'un chapitre se lit
 *    donc directement sur la composition entière (voir `rendu-chapitres.ts`).
 * Le générateur de plan est déclaré `cas-concret` : c'est le seul réglage existant qui convienne (`reglage.ts` n'est pas touché).
 */
import { adapterPlan, type SegmentCale } from "@/briques/plan-scenes-generateurs/adaptateur";
import { MAX_JETONS_PLAN_SCENES } from "@/briques/plan-scenes/generateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { Remarque } from "@/briques/plan-scenes/validateur";

export const FORMAT_PLAN_VIDEO_LONGUE = { largeur: 1920, hauteur: 1080, fps: 25 as const };
export type FormatVideoLongue = typeof FORMAT_PLAN_VIDEO_LONGUE;

/** Estimation prudente : un jeton pour 3 caractères de JSON (le français et le JSON sont plus denses que l'anglais). */
export const CARACTERES_PAR_JETON = 3;

export interface ChapitrePourPlan {
  id: string;
  /** Segments déjà calés sur la voix, en temps de la vidéo ENTIÈRE. */
  segments: SegmentCale[];
  /** Début et fin du chapitre dans la vidéo (ms). Défaut : début du premier segment, fin du dernier. */
  debutMs?: number;
  finMs?: number;
}

export interface PlanChapitre {
  id: string;
  debutMs: number;
  finMs: number;
  /** Plan du chapitre ; `null` : rien à poser, le chapitre garde le dessin existant. */
  plan: PlanValide | null;
  remarques: Remarque[];
  jetonsEstimes: number;
}

export interface ResultatPlanVideoLongue {
  format: FormatVideoLongue;
  chapitres: PlanChapitre[];
  remarques: Remarque[];
  /** Faux dès qu'un problème bloque (chapitres incohérents, plan trop gros). Le détail est dans `problemes`. */
  valide: boolean;
  problemes: string[];
}

/** Jetons estimés d'un plan (PUR). */
export function estimerJetons(plan: PlanValide | null): number {
  return plan ? Math.ceil(JSON.stringify(plan).length / CARACTERES_PAR_JETON) : 0;
}

/** Bornes d'un chapitre : celles données, sinon celles de ses segments. */
function bornes(c: ChapitrePourPlan): { debutMs: number; finMs: number } {
  const debutMs = c.debutMs ?? c.segments[0]?.debutMs ?? 0;
  const finMs = c.finMs ?? c.segments.at(-1)?.finMs ?? 0;
  return { debutMs, finMs };
}

/** Contrôle des chapitres (PUR) : identifiants uniques, durées > 0, ordre croissant sans chevauchement, segments dans le chapitre. */
export function controlerChapitres(chapitres: ChapitrePourPlan[]): string[] {
  const problemes: string[] = [];
  if (!chapitres.length) problemes.push("Aucun chapitre.");
  const vus = new Set<string>();
  let fin = 0;
  for (const c of chapitres) {
    if (!c.id.trim()) problemes.push("Un chapitre n'a pas d'identifiant.");
    if (vus.has(c.id)) problemes.push(`Identifiant de chapitre en double : « ${c.id} ».`);
    vus.add(c.id);
    const b = bornes(c);
    if (!(b.finMs > b.debutMs) || b.debutMs < 0) problemes.push(`Chapitre « ${c.id} » : durée nulle ou négative.`);
    if (b.debutMs < fin) problemes.push(`Chapitre « ${c.id} » : chevauche le précédent.`);
    if (!c.segments.length) problemes.push(`Chapitre « ${c.id} » : aucun segment calé sur la voix.`);
    if (c.segments.some((s) => s.debutMs < b.debutMs || s.finMs > b.finMs || s.finMs < s.debutMs)) problemes.push(`Chapitre « ${c.id} » : un segment sort du chapitre.`);
    fin = Math.max(fin, b.finMs);
  }
  return problemes;
}

/**
 * Un plan par chapitre, niveau 1, sans IA. Ne lance jamais d'erreur : un chapitre incohérent ou un plan trop gros sort dans
 * `problemes` et `valide` passe à faux (le branchement décide quoi en faire).
 */
export async function planVideoLongue(chapitres: ChapitrePourPlan[], format: FormatVideoLongue = FORMAT_PLAN_VIDEO_LONGUE): Promise<ResultatPlanVideoLongue> {
  const problemes = controlerChapitres(chapitres);
  if (format.largeur !== 1920 || format.hauteur !== 1080) problemes.push("Format attendu : 1920×1080.");
  if (problemes.length) return { format, chapitres: [], remarques: [], valide: false, problemes };
  const sortie: PlanChapitre[] = [];
  const remarques: Remarque[] = [];
  for (const c of chapitres) {
    const { debutMs, finMs } = bornes(c);
    // Pas de fournisseur : niveau 1 seulement (aucun appel payant, aucun réseau).
    const r = await adapterPlan({ generateur: "cas-concret", script: c.segments.map((s) => s.texte).join(" "), segments: c.segments, format, facecam: false, dureeMs: finMs }, {});
    const jetonsEstimes = estimerJetons(r.plan);
    if (jetonsEstimes >= MAX_JETONS_PLAN_SCENES) problemes.push(`Chapitre « ${c.id} » : plan estimé à ${jetonsEstimes} jetons, au-dessus de la limite de ${MAX_JETONS_PLAN_SCENES}. Couper le chapitre.`);
    remarques.push(...r.remarques);
    sortie.push({ id: c.id, debutMs, finMs, plan: r.plan, remarques: r.remarques, jetonsEstimes });
  }
  return { format, chapitres: sortie, remarques, valide: problemes.length === 0, problemes };
}
