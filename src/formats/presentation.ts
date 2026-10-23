/** Classes d'affichage des couleurs de blocs de recette (noms de jetons → classes Tailwind). PUR. */
import type { CouleurBloc } from "./types";

export const BORDURES_BLOC: Record<CouleurBloc, string> = {
  orange: "border-orange",
  "orange-vif": "border-orange-vif",
  sauge: "border-sauge",
  ambre: "border-ambre",
  brique: "border-brique",
  "texte-doux": "border-texte-doux",
};

export const TEXTES_BLOC: Record<CouleurBloc, string> = {
  orange: "text-orange-vif",
  "orange-vif": "text-orange-vif",
  sauge: "text-sauge",
  ambre: "text-ambre",
  brique: "text-brique",
  "texte-doux": "text-texte-doux",
};

export const FONDS_BLOC: Record<CouleurBloc, string> = {
  orange: "bg-orange-doux",
  "orange-vif": "bg-orange-doux",
  sauge: "bg-sauge-doux",
  ambre: "bg-ambre-doux",
  brique: "bg-brique-doux",
  "texte-doux": "bg-surface-2",
};
