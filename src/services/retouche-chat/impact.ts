/**
 * IMPACT (lot R1) — ce que la retouche refait : les scènes à l'empreinte changée (`scenesARerendre`), plus celles dont
 * les mots lus changent ; la voix n'est touchée QUE par `modifier-script` (le texte lu est celui de Williams).
 * Phrase en mots simples pour le chat : « 2 scènes sur 7 seront refaites, la voix ne change pas. »
 */
import type { OperationRetouche } from "@/briques/operations";
import { scenesARerendre } from "@/briques/plan-scenes/empreinte";
import type { PlanValide } from "@/briques/plan-scenes/schema";

export interface ImpactRetouche {
  /** Identifiants des scènes du nouveau plan à re-rendre, dans l'ordre du plan. */
  scenes: string[];
  total: number;
  voixTouchee: boolean;
  phrase: string;
}

export function phraseImpact(i: Pick<ImpactRetouche, "scenes" | "total" | "voixTouchee">): string {
  const n = i.scenes.length;
  const voix = i.voixTouchee ? "la voix sera refaite" : "la voix ne change pas";
  if (n === 0) return `Aucune scène ne change, ${voix}.`;
  return `${n} scène${n > 1 ? "s" : ""} sur ${i.total} ${n > 1 ? "seront refaites" : "sera refaite"}, ${voix}.`;
}

export function impactRetouche(ancien: PlanValide, nouveau: PlanValide, operations: readonly OperationRetouche[]): ImpactRetouche {
  const voixTouchee = operations.some((o) => o.type === "modifier-script") && ancien.mots.some((m, i) => nouveau.mots[i]?.texte !== m.texte);
  const changees = new Set(scenesARerendre(ancien, nouveau));
  if (voixTouchee)
    for (const s of nouveau.scenes)
      if (nouveau.mots.slice(s.mots.premier, s.mots.dernier + 1).some((m, j) => ancien.mots[s.mots.premier + j]?.texte !== m.texte)) changees.add(s.id);
  const scenes = nouveau.scenes.filter((s) => changees.has(s.id)).map((s) => s.id);
  const base = { scenes, total: nouveau.scenes.length, voixTouchee };
  return { ...base, phrase: phraseImpact(base) };
}
