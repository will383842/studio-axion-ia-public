/** Entrée de la banque de dessins (TB-07). PUR, SANS alias « @/ ». */
export interface EntreeDessin {
  /** Identifiant, = nom du fichier de tracé et de l'entrée (ex. « loupe »). Valeur de `dessinId` dans la fiche de scènes. */
  id: string;
  nom: string;
  motsCles: readonly string[];
  /** Chemin du SVG depuis la racine du dépôt. */
  trace: string;
  /** Identifiant de l'entrée au registre des droits (`src/briques/droits`). */
  droitId: string;
  version: number;
}
