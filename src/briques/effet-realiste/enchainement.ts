/**
 * EFFET RÉALISTE PAR IA — PLACE DANS LA PISTE ET ENCHAÎNEMENTS (lot K). PUR.
 *
 *  - Passages CONDITIONNELS : la vitre brisée (lots F3 / I) posée à l'impact ne sort que si l'effet a réussi ; l'objet
 *    3D (repli gratuit, lot I / I2) ne sort que s'il a raté. `selonEffetsRealistes` filtre les passages d'après les
 *    résultats de la fabrication (un passage sans condition passe toujours).
 *  - Morceaux : le passage reposé entre dans le plan du cadrage comme un morceau du Décor IA (temps de la prise ;
 *    source `effet`) : `planAvecEffets`.
 *  - Plan large : pendant l'effet, le cadre montre toute la fenêtre extraite (la main et l'objet restent visibles).
 */
import type { ResultatEffetRealiste } from "./types";

/** Condition portée par un passage du monteur : sortir seulement si l'effet réaliste `effetId` a réussi / raté. */
export interface ConditionEffetRealiste {
  effetId: string;
  si: "reussi" | "rate";
}

export function lireCondition(p: unknown): ConditionEffetRealiste | null {
  const c = (p as { conditionEffetRealiste?: unknown } | null)?.conditionEffetRealiste as Partial<ConditionEffetRealiste> | undefined;
  return c && typeof c.effetId === "string" && (c.si === "reussi" || c.si === "rate") ? { effetId: c.effetId, si: c.si } : null;
}

/**
 * Passages à garder d'après les résultats : sans résultat pour un effet (pas encore fabriqué, ou chaîne sans l'étape),
 * on garde le repli et on écarte ce qui dépend d'une réussite (prudence : jamais de vitre sans objet lancé).
 */
export function selonEffetsRealistes<P>(passages: P[], resultats: readonly Pick<ResultatEffetRealiste, "id" | "statut">[] | undefined): P[] {
  const reussis = new Set((resultats ?? []).filter((r) => r.statut === "reussi").map((r) => r.id));
  return passages.filter((p) => {
    const c = lireCondition(p);
    if (!c) return true;
    return c.si === "reussi" ? reussis.has(c.effetId) : !reussis.has(c.effetId);
  });
}

export interface MorceauPlan {
  index?: number;
  debutSec: number;
  finSec: number;
  source: string;
  fichierCle?: string;
  fonduSec?: number;
}

/**
 * Plan donné au cadrage : celui du Décor IA (s'il est appliqué) avec les morceaux des effets réussis. Sans décor, un
 * plan « effets seuls » (`effets: true`) dans la fenêtre d'extraction. Un effet remplace son intervalle.
 */
export function planAvecEffets(
  planDecor: Record<string, unknown> | undefined,
  morceaux: readonly { id: string; debutSec: number; finSec: number; fichierCle: string; fonduSec: number; fenetre?: { x: number; y: number; largeur: number; hauteur: number } }[],
  fenetreActuelle: { x: number; y: number; largeur: number; hauteur: number } | undefined,
): Record<string, unknown> | undefined {
  if (!morceaux.length) return planDecor;
  // La fenêtre où les morceaux ont été extraits (gardée avec eux) prime : un recadrage ne les décale jamais.
  const fenetre = morceaux.find((m) => m.fenetre)?.fenetre ?? fenetreActuelle;
  const effets: MorceauPlan[] = morceaux.map((m) => ({ debutSec: m.debutSec, finSec: m.finSec, source: "effet", fichierCle: m.fichierCle, fonduSec: m.fonduSec }));
  const base = planDecor ?? { decorApplique: false, morceaux: [], audio: "origine", ips: 25, ...(fenetre ? { fenetre } : {}) };
  const existants = (Array.isArray(base.morceaux) ? (base.morceaux as MorceauPlan[]) : []).filter((m) => !effets.some((e) => m.debutSec < e.finSec - 1e-6 && e.debutSec < m.finSec - 1e-6) || m.source !== "decor");
  return { ...base, effets: true, ...(base.fenetre || !fenetre ? {} : { fenetre }), morceaux: [...existants, ...effets].sort((a, b) => a.debutSec - b.debutSec) };
}

interface PlanCadre {
  priseDebutSec: number;
  priseFinSec: number;
  cadre: { x: number; y: number; largeur: number; hauteur: number };
}

/** Pendant un effet (temps de la prise), le plan montre toute la fenêtre extraite : la main et l'objet se voient. */
export function plansLargesPendant<P extends PlanCadre>(plans: P[], intervalles: readonly { debutSec: number; finSec: number }[], fenetre: { x: number; y: number; largeur: number; hauteur: number }): P[] {
  if (!intervalles.length) return plans;
  return plans.map((p) => (intervalles.some((i) => p.priseDebutSec < i.finSec - 1e-6 && i.debutSec < p.priseFinSec - 1e-6) ? { ...p, cadre: { ...p.cadre, x: fenetre.x, y: fenetre.y, largeur: fenetre.largeur, hauteur: fenetre.hauteur } } : p));
}

/** Part de plan large autour d'un instant de la prise (0 à 1) : cadre ≥ 85 % de la hauteur de la source. */
export function largeurDesPlans(plans: PlanCadre[] | undefined, hauteurSource: number): ((priseSec: number) => number) | undefined {
  if (!plans?.length || !(hauteurSource > 0)) return undefined;
  return (s) => {
    const p = plans.find((x) => s >= x.priseDebutSec - 1e-6 && s < x.priseFinSec) ?? null;
    if (!p) return 1;
    return Math.min(1, Math.max(0, (p.cadre.hauteur / hauteurSource - 0.55) / 0.3));
  };
}
