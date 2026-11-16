/**
 * EMPREINTE DE RENDU RELATIVE À LA SCÈNE (D4-F6) — parade du « mot coupé » : couper un mot décale les temps absolus
 * de toutes les scènes suivantes, donc `empreinteScene` (qui hache `debutMs`/`finMs`/`mots`) change pour elles toutes.
 * Ici, seul ce qui change l'image compte : durée, texte des mots lus et leurs temps RELATIFS au début de la scène,
 * plus format, face caméra, habillage et version du schéma. PUR : aucun disque, aucun `node:crypto` (lisible dans
 * Remotion), imports relatifs seulement. Rien ne l'importe en production.
 */
import { fnv1a64, jsonCanonique } from "./empreinte";
import type { PlanDeScenes, ScenePlan } from "./schema";
import { VERSION_PLAN_SCENES } from "./schema";

type Contexte = Pick<PlanDeScenes, "format" | "facecam" | "habillage"> & { mots: PlanDeScenes["mots"] };

export function empreinteRendu(scene: ScenePlan, plan: Contexte): string {
  const { debutMs, finMs, mots, empreinte: _e, version: _v, ...contenu } = scene as ScenePlan & { empreinte?: string };
  void _e;
  void _v;
  const lus = plan.mots.slice(mots.premier, mots.dernier + 1).map((m) => ({ texte: m.texte, debutMs: m.debutMs - debutMs, finMs: m.finMs - debutMs }));
  return fnv1a64(
    jsonCanonique({
      v: VERSION_PLAN_SCENES,
      format: plan.format,
      facecam: plan.facecam,
      habillage: plan.habillage,
      scene: { ...contenu, dureeMs: finMs - debutMs, mots: lus },
    }),
  );
}

/** Identifiants des scènes du nouveau plan à redessiner : leur empreinte de rendu n'existe pas dans l'ancien plan (par id, puis par empreinte). */
export function scenesARedessiner(ancien: PlanDeScenes, nouveau: PlanDeScenes): string[] {
  const parId = new Map(ancien.scenes.map((s) => [s.id, empreinteRendu(s, ancien)]));
  const connues = new Set(parId.values());
  return nouveau.scenes.filter((s) => {
    const e = empreinteRendu(s, nouveau);
    return parId.get(s.id) !== e && !connues.has(e);
  }).map((s) => s.id);
}
