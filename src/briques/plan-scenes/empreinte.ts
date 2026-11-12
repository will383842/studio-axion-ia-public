/**
 * EMPREINTE PAR SCÈNE (lot C) — hachage PUR (FNV-1a 64 bits, sans `node:crypto` : lisible aussi dans Remotion) du
 * contenu canonique d'une scène (clés triées), avec ce qui change son image (format, face caméra, habillage, version
 * du schéma). Le champ `empreinte` et la `version` de la scène n'y entrent pas. Seule une scène dont l'empreinte
 * change est re-rendue.
 */
import type { PlanDeScenes, PlanValide, ScenePlan } from "./schema";
import { VERSION_PLAN_SCENES } from "./schema";

export function jsonCanonique(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(jsonCanonique).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${jsonCanonique(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

const BASE = BigInt("0xcbf29ce484222325");
const PREMIER = BigInt("0x100000001b3");
const MASQUE = BigInt("0xffffffffffffffff");

export function fnv1a64(texte: string): string {
  let h = BASE;
  for (const octet of new TextEncoder().encode(texte)) {
    h ^= BigInt(octet);
    h = (h * PREMIER) & MASQUE;
  }
  return h.toString(16).padStart(16, "0");
}

type Contexte = Pick<PlanDeScenes, "format" | "facecam" | "habillage">;

export function empreinteScene(scene: ScenePlan, contexte: Contexte): string {
  const { empreinte: _e, version: _v, ...contenu } = scene as ScenePlan & { empreinte?: string };
  void _e;
  void _v;
  return fnv1a64(jsonCanonique({ v: VERSION_PLAN_SCENES, format: contexte.format, facecam: contexte.facecam, habillage: contexte.habillage, scene: contenu }));
}

export function avecEmpreintes(plan: PlanDeScenes): PlanValide {
  return { ...plan, scenes: plan.scenes.map((s) => ({ ...s, empreinte: empreinteScene(s, plan) })) };
}

/** Identifiants des scènes du nouveau plan à rendre (nouvelles ou changées). */
export function scenesARerendre(ancien: PlanValide, nouveau: PlanValide): string[] {
  const avant = new Map(ancien.scenes.map((s) => [s.id, s.empreinte]));
  return nouveau.scenes.filter((s) => avant.get(s.id) !== s.empreinte).map((s) => s.id);
}
