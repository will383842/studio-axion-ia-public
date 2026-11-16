/**
 * Aperçu avant retouche : gratuite ou refusée, scènes refaites sur N, durée annoncée, phrase simple.
 * PUR : aucun accès base, réseau ni rendu ; aucun montant, aucun appel à Claude. Non branché (G13-14 l'affichera).
 */
import type { OperationRetouche } from "@/briques/operations";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { garderPortee, type PorteeOperation } from "@/briques/retouche-portee";
import { impactRetouche } from "@/services/retouche-chat/impact";

/** Durée de la retouche, en secondes : annoncée par le moteur, non mesurée (G13-09). */
export const DUREE_RETOUCHE_SEC: Readonly<Record<string, number>> = {
  "demo-facecam": 2 + 120 + 2,
  "tutoriel-outil": 120,
};

export interface ApercuRetouche {
  famille: "gratuite" | "refusee";
  portees: PorteeOperation[];
  scenes: string[];
  total: number;
  dureeSec: number | null;
  phrase: string;
}

export function apercuRetouche(entree: {
  generateur: string;
  ancien: PlanValide;
  nouveau: PlanValide;
  operations: readonly OperationRetouche[];
}): ApercuRetouche {
  const garde = garderPortee("chat", entree.operations);
  const impact = impactRetouche(entree.ancien, entree.nouveau, entree.operations);
  const base = { portees: garde.portees, scenes: impact.scenes, total: impact.total };
  const dureeSec = Object.prototype.hasOwnProperty.call(DUREE_RETOUCHE_SEC, entree.generateur) ? DUREE_RETOUCHE_SEC[entree.generateur]! : null;
  if (!garde.ok) return { ...base, famille: "refusee", dureeSec, phrase: `Payant : refusé. ${garde.phrase}` };
  const n = impact.scenes.length;
  const parties = ["Gratuit"];
  if (dureeSec !== null) parties.push(`environ ${Math.ceil(dureeSec / 60)} min`);
  parties.push(`${n} scène${n > 1 ? "s" : ""} sur ${impact.total}`);
  return { ...base, famille: "gratuite", dureeSec, phrase: parties.join(" · ") };
}
