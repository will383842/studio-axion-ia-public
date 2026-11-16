/**
 * Famille de la retouche (G13-14) : « Gratuit · environ 3 min · 2 scènes sur 7 » ou « Payant : refusé. … ».
 * Une ligne, aucun montant. Texte de la charte (hérite de Manrope), refus en terracotta.
 */
import type { OperationRetouche } from "@/briques/operations";
import { apercuDepuisImpact } from "@/services/retouche-segments/apercu";

export function ApercuFamille({ generateur, operations, impact }: { generateur: string; operations: readonly OperationRetouche[]; impact: { scenes: readonly string[]; total: number } }) {
  const a = apercuDepuisImpact({ generateur, operations, scenes: impact.scenes, total: impact.total });
  return <p className={a.famille === "refusee" ? "text-sm text-accent" : "text-sm text-texte-doux"}>{a.phrase}</p>;
}
