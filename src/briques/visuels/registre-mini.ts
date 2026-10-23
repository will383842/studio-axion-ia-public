export const TYPES_MINI = ["W01", "W02", "W03", "W06", "W07", "W25"] as const;
export type TypeMini = (typeof TYPES_MINI)[number];

export interface DefinitionMini {
  id: TypeMini;
  nom: string;
}

// Noms d'exemple génériques.
export const MINIS: Record<TypeMini, DefinitionMini> = {
  W01: { id: "W01", nom: "Pastille numérotée" },
  W02: { id: "W02", nom: "Coche" },
  W03: { id: "W03", nom: "Flèche" },
  W06: { id: "W06", nom: "Jauge" },
  W07: { id: "W07", nom: "Barre de progression" },
  W25: { id: "W25", nom: "Étoile" },
};
