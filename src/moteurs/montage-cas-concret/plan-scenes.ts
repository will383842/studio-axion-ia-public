/**
 * PLAN DE SCÈNES DU CAS CONCRET (lot R2) — option, ÉTEINTE par défaut (réglage `planScenes.casConcret`) : sans elle, ce
 * module n'est jamais appelé et les écrans gardent leurs propriétés (donc leurs empreintes) d'avant.
 * Pour chaque groupe d'écrans de même horloge (le corps, puis chaque fin) : segments = écrans déjà calés (texte dit,
 * début, fin) → `adapterPlan` (stock niveau 1, IA niveau 2 injectée, niveau 3 interdit) → UNE TRANCHE par écran
 * (`tranchePlan`) posée dans `ProprietesEcran.planScenes`. L'empreinte de rendu d'un écran couvre ses propriétés : seul un
 * écran dont les scènes changent est rendu à nouveau. Le résultat est gardé au journal (clé = entrée) : une reprise ne
 * rappelle pas l'IA.
 */
import { jsonCanonique, fnv1a64 } from "@/briques/plan-scenes/empreinte";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { Remarque } from "@/briques/plan-scenes/validateur";
import { adapterPlan } from "@/briques/plan-scenes-generateurs/adaptateur";
import { tranchePlan } from "@/briques/plan-scenes-generateurs/tranche";

export interface EcranPourPlan {
  id: string;
  texteDit: string;
  debutMs: number;
  finMs: number;
}
export interface GroupePourPlan {
  id: string;
  ecrans: EcranPourPlan[];
}
export interface MemoPlanGroupe {
  entree: string;
  plan: PlanValide | null;
  remarques: Remarque[];
}
export type MemoPlanScenes = Record<string, MemoPlanGroupe>;

export interface ResultatPlanCasConcret {
  /** Tranche du plan par écran, `groupe/écran` ; absent : l'écran garde son dessin existant. */
  tranches: Record<string, PlanValide>;
  remarques: Remarque[];
  memo: MemoPlanScenes;
}

export const FORMAT_PLAN_CAS_CONCRET = { largeur: 1080, hauteur: 1920, fps: 25 as const };

export const cleTranche = (groupe: string, ecran: string) => `${groupe}/${ecran}`;

export async function planScenesCasConcret(o: { groupes: GroupePourPlan[]; appeler?: AppelClaude; memo?: MemoPlanScenes; format?: typeof FORMAT_PLAN_CAS_CONCRET }): Promise<ResultatPlanCasConcret> {
  const format = o.format ?? FORMAT_PLAN_CAS_CONCRET;
  const tranches: Record<string, PlanValide> = {};
  const memo: MemoPlanScenes = {};
  const remarques: Remarque[] = [];
  for (const g of o.groupes) {
    const segments = g.ecrans.map((e) => ({ texte: e.texteDit, debutMs: e.debutMs, finMs: e.finMs }));
    const entree = fnv1a64(jsonCanonique({ format, segments, ia: !!o.appeler }));
    const garde = o.memo?.[g.id];
    const r = garde && garde.entree === entree ? garde : await adapterPlan({ generateur: "cas-concret", script: segments.map((s) => s.texte).join(" "), segments, format, facecam: false }, { appeler: o.appeler }).then((x) => ({ entree, plan: x.plan, remarques: x.remarques }));
    memo[g.id] = r;
    remarques.push(...r.remarques);
    if (!r.plan) continue;
    for (const e of g.ecrans) {
      const t = tranchePlan(r.plan, e.debutMs, e.finMs);
      if (t) tranches[cleTranche(g.id, e.id)] = t;
    }
  }
  return { tranches, remarques, memo };
}
