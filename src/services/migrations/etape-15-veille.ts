/**
 * MIGRATION — étape 15, lot B2 (`docs/BRANCHEMENTS-EXECUTION.md`) : outils surveillés au départ (HeyGen, ElevenLabs,
 * Remotion + LICENSE.md, modèles fal.ai, Claude, WhisperX, FFmpeg, réseaux sociaux), ajoutés s'ils manquent ;
 * « version utilisée » recalée sur le code. Idempotente, testée, AUCUNE suppression ; résumé (ou null si rien n'a
 * changé) rangé dans `rapport.lots["veille"]`.
 */
import type { Depots } from "@/domaine/depots";
import { assurerOutilsDepart } from "@/veille/outils-depart";

export async function etape15Veille(d: Depots, maintenant: string): Promise<Record<string, unknown> | null> {
  const r = await assurerOutilsDepart(d.veilleOutils, maintenant);
  if (!r.ajoutes.length && !r.versionsMisesAJour.length) return null;
  await d.evenements.enregistrer({
    id: `ev-migration-veille-${maintenant}`,
    type: "migration",
    message: r.ajoutes.length ? `Veille des outils : ${r.ajoutes.length > 1 ? `${r.ajoutes.length} outils surveillés` : `${r.ajoutes.length} outil surveillé`}` : `Veille des outils : ${r.versionsMisesAJour.join(", ")}`,
    date: maintenant,
    creeLe: maintenant,
    modifieLe: maintenant,
  });
  return { ...r };
}
