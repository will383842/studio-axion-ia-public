/**
 * ADAPTATEUR « PLAN DE SCÈNES » DES GÉNÉRATEURS EXISTANTS (lot R2) — script + segments déjà calés → `PlanValide` pour les
 * scènes d'interface, de chiffres et d'accents ; tout le reste (sous-titres, cartes, légendes longues) reste à l'existant.
 *  - niveau 1 : pièces du stock, d'après le texte (`planDeRepli`) ; toujours disponible, même sans LLM ;
 *  - niveau 2 : plan composé par `genererPlan` (fournisseur INJECTÉ, un faux dans les tests) ;
 *  - repli d'un niveau PAR SCÈNE : une scène que le LLM rend invalide ou de niveau 3 prend la pièce du stock au même
 *    endroit ; le niveau 3 (code libre) est interdit ici ;
 *  - jamais d'échec ni de refus : des remarques. Le script de Williams fait foi (les mots sont ceux des segments).
 * Aucun prix, aucun appel réel.
 */
import { CATALOGUE_BRIQUES, type IdPiece } from "../plan-scenes/catalogue";
import { avecEmpreintes } from "../plan-scenes/empreinte";
import { genererPlan, type AppelClaude } from "../plan-scenes/generateur";
import { schemaSceneStrict, type FormatPlan, type MotMinute, type PlanDeScenes, type PlanValide, type ScenePlan } from "../plan-scenes/schema";
import { planDeRepli, validerPlan, type Remarque } from "../plan-scenes/validateur";
import { GENERATEURS_PLAN, type IdGenerateurPlan } from "./reglage";

export { GENERATEURS_PLAN };

export interface SegmentCale {
  texte: string;
  debutMs: number;
  finMs: number;
  /** Mots déjà calés sur la voix (sinon répartis à égalité dans le segment). */
  mots?: MotMinute[];
}

export interface EntreeAdaptateur {
  generateur: IdGenerateurPlan;
  script: string;
  segments: SegmentCale[];
  format: FormatPlan;
  /** Une personne à l'image : rien devant le visage. */
  facecam: boolean;
  dureeMs?: number;
}

export interface DependancesAdaptateur {
  /** Fournisseur du générateur de plan (injecté). Absent : niveau 1 seulement. */
  appeler?: AppelClaude;
}

export interface ResultatAdaptateur {
  /** Absent (null) : aucune scène d'interface, de chiffre ni d'accent, l'existant garde tout. */
  plan: PlanValide | null;
  remarques: Remarque[];
  /** `stock` : pièces du stock ; `llm` : composé par l'IA (réparé par scène). */
  source: "stock" | "llm";
  /** Scènes écartées (laissées à l'existant) : légendes longues. */
  laissees: string[];
}

/** Mots du plan : ceux des segments, dans l'ordre ; non calés, répartis à égalité dans leur segment. */
export function motsDesSegments(segments: SegmentCale[]): MotMinute[] {
  const sortie: MotMinute[] = [];
  for (const s of segments) {
    if (s.mots?.length) {
      sortie.push(...s.mots.map((m) => ({ texte: m.texte, debutMs: Math.round(m.debutMs), finMs: Math.round(m.finMs) })));
      continue;
    }
    const mots = s.texte.split(/\s+/).filter(Boolean);
    const pas = (s.finMs - s.debutMs) / Math.max(1, mots.length);
    mots.forEach((texte, i) => sortie.push({ texte, debutMs: Math.round(s.debutMs + i * pas), finMs: Math.round(s.debutMs + (i + 1) * pas) }));
  }
  return sortie;
}

/** Une légende courte (≤ 5 mots) est un accent ; une légende plus longue reste aux sous-titres et cartes existants. */
function estRetenue(s: ScenePlan): boolean {
  const famille = CATALOGUE_BRIQUES[s.piece as IdPiece].famille;
  if (famille !== "texte") return true;
  const texte = (s.parametres as { texte?: string }).texte ?? "";
  return texte.split(/\s+/).filter(Boolean).length <= 5;
}

/** Repli d'un niveau pour UNE scène : la pièce niveau 1 de la scène, sinon la pièce du stock au même endroit. */
function replierScene(s: ScenePlan, stock: ScenePlan[], remarques: Remarque[]): ScenePlan {
  const sansCalques = { ...s, niveau: 1 as const, calques: undefined, code: undefined } as ScenePlan;
  if (s.niveau !== 3 && schemaSceneStrict.safeParse(s).success) return s;
  if (schemaSceneStrict.safeParse(sansCalques).success && s.niveau !== 3) {
    remarques.push({ code: "REPLI_NIVEAU_1", sceneId: s.id, message: "Composition de la scène trop fragile : pièce simple à la place." });
    return sansCalques;
  }
  const proche = stock.find((x) => x.debutMs <= s.debutMs && s.debutMs < x.finMs) ?? stock[0]!;
  remarques.push({ code: "REPLI_NIVEAU_1", sceneId: s.id, message: "Scène de remplacement tirée du stock (niveau 1)." });
  return { ...proche, id: s.id, mots: s.mots, debutMs: s.debutMs, finMs: s.finMs, position: s.position } as ScenePlan;
}

export async function adapterPlan(e: EntreeAdaptateur, deps: DependancesAdaptateur = {}): Promise<ResultatAdaptateur> {
  const mots = motsDesSegments(e.segments);
  const dureeMs = Math.max(e.dureeMs ?? 0, e.segments.at(-1)?.finMs ?? 0, mots.at(-1)?.finMs ?? 0);
  const contexte = { mots, format: e.format, facecam: e.facecam, dureeMs };
  const remarques: Remarque[] = [];
  const stock = validerPlan(planDeRepli(contexte), contexte);
  let base: PlanValide = stock.plan;
  let source: ResultatAdaptateur["source"] = "stock";
  if (deps.appeler && mots.length) {
    const r = await genererPlan({ script: e.script || mots.map((m) => m.texte).join(" "), mots, format: e.format, facecam: e.facecam }, deps.appeler);
    remarques.push(...r.remarques);
    if (r.source === "llm") {
      // Validé de nouveau avec la durée de Williams (jamais raccourcie) ; un niveau 3 éventuel est replié par le validateur.
      const v = validerPlan(r.plan, contexte);
      remarques.push(...v.remarques);
      base = v.plan;
      source = "llm";
    }
  }
  const retenues: ScenePlan[] = [];
  const laissees: string[] = [];
  for (const s of base.scenes) {
    const sure = replierScene(s, stock.plan.scenes, remarques);
    if (estRetenue(sure)) retenues.push(sure);
    else laissees.push(s.id);
  }
  if (!retenues.length) return { plan: null, remarques, source, laissees };
  const { scenes: _s, ...entete } = base;
  void _s;
  const plan: PlanDeScenes = { ...entete, scenes: retenues };
  return { plan: avecEmpreintes(plan), remarques, source, laissees };
}
