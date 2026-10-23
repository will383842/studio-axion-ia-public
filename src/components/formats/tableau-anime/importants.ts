/**
 * « Mots importants » d'une scène dans la correction à la main : ce que le champ montre (« mot, mot »), lu dans les
 * lignes de la scène. PUR (écran et services).
 */
import type { SceneTableau } from "@/moteurs/montage-tableau/fiche";

export function importantsDeLaScene(s: Pick<SceneTableau, "elements">): string {
  return [...new Set(s.elements.flatMap((e) => (e.type === "ligne" ? (e.importants ?? []) : [])))].join(", ");
}
