/**
 * PLAFOND CLAUDE DU MOIS ATTEINT ? (plan facecam v4, B.11 ; lot D). Serveur seulement, aucune dépense.
 * Lu AVANT tout appel : atteint, le face caméra sort en VERSION SIMPLE (règles fixes, modèles fixes, sans relecture
 * Claude), avec « Plafond du mois atteint — relever ? ». Fichier à part : `fabrication.ts` et `monteur-facecam.ts`
 * l'importent tous deux sans cycle.
 */
import "server-only";
import { centimesDuPlafond } from "@/lib/montants";
import { engageClaudeDuMoisCentimes, plafondMensuelClaudeUsd } from "./generation-claude";

export async function plafondClaudeDuMoisAtteint(): Promise<boolean> {
  const plafond = await plafondMensuelClaudeUsd();
  const engage = await engageClaudeDuMoisCentimes();
  return engage.depense + engage.reserve >= centimesDuPlafond(plafond);
}
