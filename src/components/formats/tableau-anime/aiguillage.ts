/**
 * AIGUILLAGE DE LA FICHE VIDÉO vers les écrans du tableau animé (tâche TB-21). PUR et léger : la page n'importe que ce
 * fichier pour décider. Si le format redevient `masque`, rien de neuf n'apparaît.
 */
import type { DefinitionFormat } from "@/formats/types";

/** Identifiant du format (même valeur que `src/formats/tableau-anime`). */
export const FORMAT_TABLEAU_ANIME = "tableau-anime";

/** La fiche vidéo montre les écrans du tableau seulement pour ce format, et seulement s'il n'est plus masqué. */
export function ecranTableauVisible(format: Pick<DefinitionFormat, "id" | "statut"> | undefined | null): boolean {
  return !!format && format.id === FORMAT_TABLEAU_ANIME && format.statut !== "masque";
}
