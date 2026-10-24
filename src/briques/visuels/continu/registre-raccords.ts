// Raccords : objets posés à cheval sur une couture. Les composants viennent en P2.
export interface DefinitionRaccord {
  type: "R01" | "R02" | "R03";
  nom: string;
  /** Diamètre (px) de l'objet à cheval sur la couture. */
  diametre: number;
  version: number;
}

export const RACCORDS: DefinitionRaccord[] = [
  { type: "R01", nom: "Sphère", diametre: 420, version: 1 },
  { type: "R02", nom: "Tuile à icône", diametre: 300, version: 1 },
  { type: "R03", nom: "Étincelle", diametre: 240, version: 1 },
];
