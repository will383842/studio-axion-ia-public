/**
 * TYPES DES LOGOS D'OUTILS (C8-L01) — lus par le rendu. PUR,.
 * Même forme que `NoeudDessin` de `src/briques/dessins/traces.ts`, avec `fill` facultatif.
 */
export type StatutLogo = "a-valider" | "valide" | "texte-seul" | "interdit";

export type NoeudLogo = [balise: "path", attributs: { d: string; fill?: string }];

export interface DessinLogo {
  /** minX, minY, largeur, hauteur de la vue. */
  vue: [number, number, number, number];
  noeuds: NoeudLogo[];
}
