/**
 * Dosage de l'animation (X3-03) : écrit le cran dans la commande de fabrication. PURE : aucun import de service, de
 * moteur ni d'argent, jamais importée par le rendu. Aucune date, aucun hasard.
 * Rend une NOUVELLE commande ; l'entrée n'est jamais modifiée.
 */
import type { CommandeFabrication } from "@/domaine/types";
import { NIVEAU_DU_DOSAGE } from "./crans";
import type { DosageMotion } from "./types";

export type ChoisiPar = "video" | "generateur" | "code";

export function appliquerDosage(
  c: CommandeFabrication,
  p: { cran: DosageMotion; choisiPar: ChoisiPar; v4?: boolean },
): CommandeFabrication {
  const sortie: CommandeFabrication = { ...c, dosageMotion: { cran: p.cran, choisiPar: p.choisiPar } };
  // La v4 ne lit pas l'intensité : seul le cran est figé.
  if (p.v4) return sortie;
  const niveau = NIVEAU_DU_DOSAGE[p.cran];
  if (c.intensite) sortie.intensite = { ...c.intensite, niveau };
  if (c.sousTitres) sortie.sousTitres = { ...c.sousTitres, intensite: niveau };
  return sortie;
}
