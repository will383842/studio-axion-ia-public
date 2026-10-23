/** Recette d'une famille de formats (plan v5 B.4.0). PUR. */
import type { ModeDeclinaison } from "@/domaine/types";
import type { FamilleFormat, RecetteScript } from "../types";

/** Ce qu'une famille fixe : les champs du générateur de `RecetteScript`, tous hérités par ses formats. */
export type RecetteFamille = Omit<Partial<RecetteScript>, "blocs" | "regles" | "criteres" | "references" | "motsParSeconde" | "annotations" | "herite"> & {
  famille: FamilleFormat;
  /** Déclinaison par défaut des formats de la famille (le format peut la changer). */
  declinaison: ModeDeclinaison;
};
