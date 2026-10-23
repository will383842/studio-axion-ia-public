/**
 * AIGUILLAGE DE LA FICHE VIDÉO ET DU MENU vers les écrans du « Cas concret MD » (tâche U2). PUR et léger : la page et la
 * navigation n'importent que ce fichier pour décider.
 */
import type { DefinitionFormat } from "@/formats/types";

/** Identifiant du format (même valeur que `src/formats/cas-concret`). */
export const FORMAT_CAS_CONCRET = "cas-concret";

type FormatLu = Pick<DefinitionFormat, "id" | "statut"> | undefined | null;

/** La fiche vidéo montre « Vos fichiers » pour ce format, quel que soit son statut (les vidéos d'essai existent masquées). */
export function ficheCasConcretVisible(format: FormatLu): boolean {
  return !!format && format.id === FORMAT_CAS_CONCRET;
}

/** Le menu mène à l'écran seulement pour ce format et seulement s'il n'est plus masqué. */
export function menuCasConcretVisible(format: FormatLu): boolean {
  return !!format && format.id === FORMAT_CAS_CONCRET && format.statut !== "masque";
}

/** Carte « Nouvelle vidéo » : le cas concret a son propre écran, jamais l'assistant générique (comme le tableau animé). */
export function adresseNouvelleVideoCasConcret(format: FormatLu): string | null {
  return menuCasConcretVisible(format) ? "/cas-concret" : null;
}
