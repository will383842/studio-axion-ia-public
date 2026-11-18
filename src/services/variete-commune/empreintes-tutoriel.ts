/**
 * Empreinte anti-répétition (E2) du tutoriel d'outil, calculée depuis le plan de scènes validé, dans le vocabulaire commun.
 * Aucun appelant en production. Branchement de la garde : plus tard, dans `tutoriel-branchements.ts`, après le pilote 05 et
 * l'accord du pilote.
 * Module PUR : aucune date du jour, aucun hasard, aucune lecture ; ne modifie jamais ses entrées.
 * On ne compte que ce qui est réellement dessiné : les scènes du plan (pièce principale et calques). La carte de fin est un
 * plan à part (`planCarteFin`) : elle n'est donc jamais dans le plan reçu.
 */
import type { AxeCommun, EmpreinteVideo } from "@/briques/variete-commune/types";
import { VERSION_EMPREINTE } from "@/briques/variete-commune/version";
import { versCommun } from "@/briques/variete-commune/vocabulaire";
import { GABARITS_TUTORIEL } from "@/briques/variete-commune/correspondances/tutoriel";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { avecDosageMotion, type DosageDeLaCommande } from "./empreintes-b";

export const FORMAT_TUTORIEL = "tutoriel-outil";

type Axes = Partial<Record<AxeCommun, string[]>>;

const uniquesTries = (l: readonly string[]): string[] => [...new Set(l)].sort();

const sousTitresConnus = ["sobre", "equilibre", "tres-dynamique"];

export function empreinteTutoriel(
  videoId: string,
  le: string,
  plan: PlanValide,
  choix: { gabarit?: string; sousTitres?: string; dosage?: DosageDeLaCommande | null },
): EmpreinteVideo {
  const pieces = plan.scenes.flatMap((s) => [s.piece, ...(s.calques ?? []).map((c) => c.piece)]);
  const transitions = plan.scenes.flatMap((s) => [s.transition.entree, s.transition.sortie]);
  const axes: Axes = {};
  const pose = (axe: AxeCommun, valeurs: readonly string[]) => { if (valeurs.length) axes[axe] = uniquesTries(valeurs); };
  pose("objets", pieces.map((p) => versCommun("tutoriel", "objets", p)));
  pose("transitions", transitions.map((t) => versCommun("tutoriel", "transitions", t)));
  if (choix.gabarit && (GABARITS_TUTORIEL as readonly string[]).includes(choix.gabarit)) pose("recit", [versCommun("tutoriel", "recit", choix.gabarit)]);
  if (choix.sousTitres && sousTitresConnus.includes(choix.sousTitres)) pose("sousTitres", [versCommun("tutoriel", "sousTitres", choix.sousTitres)]);
  return avecDosageMotion({ version: VERSION_EMPREINTE, videoId, formatId: FORMAT_TUTORIEL, le, axes }, choix.dosage);
}
