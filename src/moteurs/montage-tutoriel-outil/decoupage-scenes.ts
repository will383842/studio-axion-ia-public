/**
 * T-EXT-14 : découpage d'une vidéo finie en MORCEAUX DE PLAN (JSON), depuis le plan de scènes validé.
 * Pur : ni disque, ni processus, ni horloge, ni réglage, aucun appel. Rien ne l'importe en production.
 * Un morceau = le plan autonome d'UNE scène (rendable seul, sans sous-titres) ; les bornes sont celles du plan,
 * jamais recalculées. La carte de fin n'est pas dans `plan.scenes` : elle n'est jamais découpée.
 */
import { fnv1a64, jsonCanonique } from "@/briques/plan-scenes/empreinte";
import { schemaPlanStrict, type MotMinute, type PlanValide, type SceneValide } from "@/briques/plan-scenes/schema";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import { ID_VOLET, poserCapturesVolet } from "@/briques/plan-scenes/poser-captures-volet";
import type { EtapeCalee } from "./calage-scenario";
import type { RoleEtapeScenario } from "./scenario-maquette";

export interface MorceauPlan {
  sceneId: string;
  /** Version de la scène. */
  version: number;
  role: RoleEtapeScenario | "sans-role";
  debutMs: number;
  finMs: number;
  dureeMs: number;
  empreinteScene: string;
  /** fnv1a64(jsonCanonique(plan)). */
  empreinteMorceau: string;
  /** Plan autonome d'UNE scène (début à 0). */
  plan: PlanValide;
  /** Mots couverts, joints par une espace (paroles : jamais citées dans une erreur). */
  texteDit: string;
}

export type ResultatDecoupage = { ok: true; morceaux: MorceauPlan[] } | { ok: false; erreurs: string[] };

const copie = <T>(v: T): T => structuredClone(v);

function roleDe(scene: SceneValide, etapes: readonly EtapeCalee[]): MorceauPlan["role"] {
  let meilleur: MorceauPlan["role"] = "sans-role";
  let recouvrement = 0;
  for (const e of etapes) {
    const r = Math.min(scene.finMs, e.finMs) - Math.max(scene.debutMs, e.debutMs);
    if (r > recouvrement) {
      recouvrement = r;
      meilleur = e.role; // égalité : la première garde la place (comparaison stricte)
    }
  }
  return meilleur;
}

/** Plan d'une seule scène, décalé à 0 ; `null` si les indices de mots sont impossibles. */
function planDuMorceau(plan: PlanValide, scene: SceneValide): PlanValide | null {
  const { premier, dernier } = scene.mots;
  if (!Number.isInteger(premier) || !Number.isInteger(dernier) || premier < 0 || dernier < premier || dernier >= plan.mots.length) return null;
  const dureeMs = scene.finMs - scene.debutMs;
  const decale = (n: number) => Math.max(0, n - scene.debutMs);
  const mots: MotMinute[] = plan.mots.slice(premier, dernier + 1).map((m) => ({ texte: m.texte, debutMs: decale(m.debutMs), finMs: decale(m.finMs) }));
  const sceneSeule = { ...copie(scene), debutMs: 0, finMs: dureeMs, mots: { premier: 0, dernier: dernier - premier } } as SceneValide;
  return { version: plan.version, format: copie(plan.format), facecam: false, dureeMs, habillage: copie(plan.habillage), mots, scenes: [sceneSeule] };
}

/** Le morceau repasse le validateur ; toute modification de la scène (repli, recalage) = non rendable seule. */
function rendableSeul(morceau: PlanValide): boolean {
  if (!schemaPlanStrict.safeParse(morceau).success) return false;
  const { plan: relu } = validerPlan(copie(morceau), { mots: morceau.mots, format: morceau.format, facecam: false, dureeMs: morceau.dureeMs, ...(poserCapturesVolet(morceau, null) !== morceau ? { objetsPermis: [ID_VOLET] } : {}) });
  const sans = (p: PlanValide) => jsonCanonique({ ...p, scenes: p.scenes.map(({ empreinte: _e, ...s }) => (void _e, s)) });
  return sans(relu) === sans(morceau);
}

export function decouperEnMorceaux(entree: { plan: PlanValide; etapes?: readonly EtapeCalee[] }): ResultatDecoupage {
  const { plan, etapes = [] } = entree;
  if (!plan || !Array.isArray(plan.scenes) || plan.scenes.length === 0) return { ok: false, erreurs: ["Plan sans scène."] };
  const erreurs: string[] = [];
  const morceaux: MorceauPlan[] = [];
  let finPrecedente = 0;
  for (const scene of plan.scenes) {
    const refus = (message: string) => erreurs.push(message);
    if (scene.debutMs < finPrecedente) refus(`Scène ${scene.id} : chevauche la précédente ou n'est pas dans l'ordre.`);
    finPrecedente = Math.max(finPrecedente, scene.finMs);
    if (scene.niveau === 3) {
      refus(`Scène ${scene.id} : niveau 3, jamais réutilisée.`);
      continue;
    }
    if (!(scene.finMs > scene.debutMs)) {
      refus(`Scène ${scene.id} : durée nulle ou négative.`);
      continue;
    }
    const seul = planDuMorceau(plan, scene);
    if (!seul) {
      refus(`Scène ${scene.id} : mots hors du plan (${plan.mots.length} mots).`);
      continue;
    }
    if (!rendableSeul(seul)) {
      refus(`Scène ${scene.id} : non rendable seule.`);
      continue;
    }
    morceaux.push({
      sceneId: scene.id,
      version: scene.version,
      role: roleDe(scene, etapes),
      debutMs: scene.debutMs,
      finMs: scene.finMs,
      dureeMs: scene.finMs - scene.debutMs,
      empreinteScene: scene.empreinte,
      empreinteMorceau: fnv1a64(jsonCanonique(seul)),
      plan: seul,
      texteDit: seul.mots.map((m) => m.texte).join(" "),
    });
  }
  return erreurs.length ? { ok: false, erreurs } : { ok: true, morceaux };
}
