/**
 * C6-H4b : habillage commun (transitions dessinées de C6-H1/H2) des tranches du cas concret. PUR, NON BRANCHÉ : rien
 * n'appelle ce fichier ; C6-H4 (après 0d) l'appellera dans `planScenesCasConcret`, derrière
 * `habillage.transitionsPlanScenes` (C6-H4a). Éteint (`actif !== true`) = tranches rendues telles quelles (même objet).
 * Jamais devant le visage (règle de `choisirTransitions`).
 *
 * Le choix se fait sur le plan ENTIER du groupe (sous 10 scènes, `choisirTransitions` ne pose rien), puis il est
 * reporté sur les tranches, dont `tranchePlan` renumérote les scènes `t1`, `t2`…
 */
import { choisirTransitions } from "@/briques/motion/habillage-commun/choix";
import type { HabillagePlan, IdTransition, PlafondsHabillage, PlanHabille } from "@/briques/motion/habillage-commun/types";
import { fnv1a64 } from "@/briques/plan-scenes/empreinte";
import type { PlanValide } from "@/briques/plan-scenes/schema";

/** Graine entière ≥ 0, déterministe, tirée d'une clé (ex. « v1/g1 »). */
export function graineHabillage(cle: string): number {
  return Number.parseInt(fnv1a64(cle).slice(0, 8), 16);
}

export function habillerTranches(o: {
  actif: boolean;
  plan: PlanValide;
  ecrans: readonly { cle: string; debutMs: number; finMs: number }[];
  tranches: Readonly<Record<string, PlanValide>>;
  plafonds: PlafondsHabillage;
  graine: number;
  historique?: IdTransition[][];
}): Readonly<Record<string, PlanValide>> {
  if (o.actif !== true) return o.tranches;
  const h = choisirTransitions(o.plan, { plafonds: o.plafonds, graine: o.graine, historique: o.historique });
  const choisies = h.transitions;
  if (!choisies || Object.keys(choisies).length === 0) return o.tranches;

  const sortie: Record<string, PlanValide> = { ...o.tranches };
  let change = false;
  for (const e of o.ecrans) {
    const tranche = o.tranches[e.cle];
    if (!tranche) continue;
    const transitions: NonNullable<HabillagePlan["transitions"]> = {};
    // Même filtre et même ordre que `tranchePlan` : la k-ième scène gardée s'appelle `t${k + 1}`.
    o.plan.scenes
      .filter((s) => s.finMs > e.debutMs && s.debutMs < e.finMs)
      .forEach((s, k) => {
        const t = choisies[s.id];
        if (t && s.debutMs >= e.debutMs && s.finMs <= e.finMs) transitions[`t${k + 1}`] = { ...t };
      });
    if (Object.keys(transitions).length === 0) continue;
    const habillee: PlanHabille = {
      ...tranche,
      habillageCommun: { version: "habillage-1", pleinCadrePermis: h.pleinCadrePermis, transitions },
    };
    sortie[e.cle] = habillee;
    change = true;
  }
  return change ? sortie : o.tranches;
}
