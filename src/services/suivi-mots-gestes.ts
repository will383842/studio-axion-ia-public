/** SUI-A · geste de l'opérateur : la session est exigée d'abord, puis le service (lecture seule). */
import "server-only";
import { exigerSession } from "./auth";
import { lireTableauSuivi } from "./suivi-mots";
import type { TableauSuivi } from "@/domaine/guide-reseau/suivi-mots";

export async function gesteLireTableauSuivi(): Promise<TableauSuivi> {
  await exigerSession();
  return lireTableauSuivi();
}
