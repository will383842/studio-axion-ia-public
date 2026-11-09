/** Doublons possibles : même type, même cible, sujets proches (Jaccard ≥ 0,6). */
import type { Id } from "@/domaine/types";
import { normaliser } from "./controles";
import type { Ciblage, TypeAutomatisation } from "./types";

export interface ScriptPourDoublons {
  id: Id;
  sujet: string;
  cible?: string;
  ciblage?: Ciblage;
  typeAutomatisation?: TypeAutomatisation;
}

export const SEUIL_DOUBLON = 0.6;

const VIDES = new Set(["de", "du", "des", "la", "le", "les", "un", "une", "en", "et", "a", "au", "aux", "pour", "sur", "vos", "votre", "d", "l", "ce", "dans"]);

function motsSujet(sujet: string): Set<string> {
  return new Set(normaliser(sujet).split(" ").filter((m) => m && !VIDES.has(m)).map((m) => (m.length > 3 && /[sx]$/.test(m) ? m.slice(0, -1) : m)));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let commun = 0;
  for (const m of a) if (b.has(m)) commun++;
  return commun / (a.size + b.size - commun);
}

function cleCible(s: ScriptPourDoublons): string {
  if (s.ciblage) return `${s.ciblage.niveau}:${normaliser(s.ciblage.libelle)}`;
  return s.cible ? `libre:${normaliser(s.cible)}` : "";
}

/** Groupes (d'au moins 2 identifiants) de scripts qui se ressemblent. */
export function doublonsPossibles(scripts: ScriptPourDoublons[]): Id[][] {
  const eligibles = scripts.filter((s) => s.typeAutomatisation && cleCible(s));
  const mots = new Map(eligibles.map((s) => [s.id, motsSujet(s.sujet)]));
  const parent = new Map(eligibles.map((s) => [s.id, s.id]));
  const racine = (x: Id): Id => {
    while (parent.get(x) !== x) x = parent.get(x)!;
    return x;
  };
  for (let i = 0; i < eligibles.length; i++) {
    for (let j = i + 1; j < eligibles.length; j++) {
      const a = eligibles[i], b = eligibles[j];
      if (a.typeAutomatisation !== b.typeAutomatisation || cleCible(a) !== cleCible(b)) continue;
      if (jaccard(mots.get(a.id)!, mots.get(b.id)!) >= SEUIL_DOUBLON) parent.set(racine(b.id), racine(a.id));
    }
  }
  const groupes = new Map<Id, Id[]>();
  for (const s of eligibles) groupes.set(racine(s.id), [...(groupes.get(racine(s.id)) ?? []), s.id]);
  return [...groupes.values()].filter((g) => g.length >= 2);
}
