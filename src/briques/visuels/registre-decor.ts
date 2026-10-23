// Éléments décoratifs E01–E15 : formes géométriques SVG, SANS aucun texte, dessinées dans la couleur d'accent (orange) et l'encre.
export const TYPES_DECOR = ["E01", "E02", "E03", "E04", "E05", "E06", "E07", "E08", "E09", "E10", "E11", "E12", "E13", "E14", "E15"] as const;
export type TypeDecor = (typeof TYPES_DECOR)[number];

export interface DefinitionDecor {
  id: TypeDecor;
  nom: string;
}

// Noms d'exemple génériques.
export const DECORS: Record<TypeDecor, DefinitionDecor> = {
  E01: { id: "E01", nom: "Disque" },
  E02: { id: "E02", nom: "Anneau" },
  E03: { id: "E03", nom: "Carré arrondi" },
  E04: { id: "E04", nom: "Triangle" },
  E05: { id: "E05", nom: "Losange" },
  E06: { id: "E06", nom: "Croix" },
  E07: { id: "E07", nom: "Demi-disque" },
  E08: { id: "E08", nom: "Trois barres" },
  E09: { id: "E09", nom: "Grille de points" },
  E10: { id: "E10", nom: "Chevrons" },
  E11: { id: "E11", nom: "Zigzag" },
  E12: { id: "E12", nom: "Quart de disque" },
  E13: { id: "E13", nom: "Cercles concentriques" },
  E14: { id: "E14", nom: "Étoile à quatre branches" },
  E15: { id: "E15", nom: "Hexagone" },
};
