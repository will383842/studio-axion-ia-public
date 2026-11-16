/**
 * Choix des transitions d'un plan (C6-H2). PUR : aucun hasard non déterministe, aucune horloge, aucun import par alias
 * (dossier lu par le rendu). Rien n'appelle cette fonction : C6-H4 la branchera derrière
 * `habillage.transitionsPlanScenes`, éteint.
 *
 * Règles : plafond de scènes enrichies, part de coupes franches, jamais deux fois la même de suite, historique évité,
 * scène courte laissée telle quelle, JAMAIS de transition devant le visage (AM-02), plein cadre seulement si permis
 * et hors face caméra, entrées « attend la mesure » exclues (AM-05), liste blanche du catalogue commun.
 */
import { hasard } from "../courbes";
import { devantLeVisage } from "../../plan-scenes/zones";
import type { PlanValide } from "../../plan-scenes/schema";
import { IDS_TRANSITIONS_COMMUNES, TRANSITIONS_COMMUNES } from "./transitions";
import type { HabillagePlan, IdTransition, PlafondsHabillage } from "./types";

/** Les 4 historiques : portés par le plan, jamais « riches », jamais posés ici. */
const HISTORIQUES: readonly string[] = ["fondu", "glisse-haut", "glisse-gauche", "zoom-doux"];
/** Sous 1 200 ms, la scène garde sa transition d'origine. */
const DUREE_MIN_MS = 1200;

export interface OptionsChoix {
  plafonds: PlafondsHabillage;
  graine: number;
  historique?: IdTransition[][];
  permettreAttenteMesure?: boolean;
}

function plusUtilisee(historique: IdTransition[][] | undefined): string | null {
  const n = new Map<string, number>();
  for (const id of (historique ?? []).flat()) n.set(id, (n.get(id) ?? 0) + 1);
  let meilleur: string | null = null;
  let max = 0;
  for (const [id, c] of n) if (c > max) { max = c; meilleur = id; }
  return meilleur;
}

export function choisirTransitions(plan: PlanValide, opts: OptionsChoix): HabillagePlan {
  const { plafonds, graine } = opts;
  const pleinCadrePermis = plafonds.pleinCadrePermis && !plan.facecam;
  const sortie: HabillagePlan = { version: "habillage-1", pleinCadrePermis };
  const scenes = plan.scenes ?? [];
  const n = scenes.length;
  if (n === 0 || plafonds.transitionsRichesMax <= 0) return sortie;

  // La plus forte des deux contraintes gagne (la marge 1e-9 évite l'erreur d'arrondi de 1 − 0,9).
  const parPart = Math.floor(n - plafonds.partCoupesFranchesMin * n + 1e-9);
  const max = Math.min(Math.floor(plafonds.transitionsRichesMax), parPart);
  if (max <= 0) return sortie;

  const eviter = plusUtilisee(opts.historique);
  const reserve = IDS_TRANSITIONS_COMMUNES.filter((id) => {
    if (HISTORIQUES.includes(id)) return false;
    const def = TRANSITIONS_COMMUNES[id];
    if (def.attendMesure && opts.permettreAttenteMesure !== true) return false;
    if (def.emprise === "plein-cadre" && !pleinCadrePermis) return false;
    return true;
  });
  if (reserve.length === 0) return sortie;

  // Scènes éligibles, classées par un tirage déterministe (graine * 1000 + rang).
  const eligibles = scenes
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.finMs - s.debutMs >= DUREE_MIN_MS && !(plan.facecam && devantLeVisage(s.position)))
    .map((e) => ({ ...e, h: hasard(graine * 1000 + e.i) }))
    .sort((a, b) => a.h - b.h || a.i - b.i)
    .slice(0, max)
    .sort((a, b) => a.i - b.i);

  const transitions: NonNullable<HabillagePlan["transitions"]> = {};
  let precedente: string | null = null;
  for (const { s, i } of eligibles) {
    let pool = reserve.filter((id) => id !== precedente);
    const sansFrequente = pool.filter((id) => id !== eviter);
    if (sansFrequente.length > 0) pool = sansFrequente;
    const id = pool[Math.floor(hasard(graine * 1000 + 500 + i) * pool.length) % pool.length] as IdTransition;
    const cote = hasard(graine * 1000 + 250 + i) < 0.5 ? "entree" : "sortie";
    transitions[s.id] = { [cote]: id };
    precedente = id;
  }
  if (Object.keys(transitions).length > 0) sortie.transitions = transitions;
  return sortie;
}
