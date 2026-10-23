/**
 * Types du MOTEUR DE RENDU des sous-titres, SANS AUCUN import : `scene.ts`, `style.ts`, `mesure.ts` et
 * `typographie.ts` sont lus tels quels par Remotion (`studio-rendu`, paquet à part, sans l'alias « @/ »).
 * Copies structurelles des types du domaine (`domaine/types.ts`) ; `index.ts` vérifie à la compilation qu'ils
 * restent compatibles.
 */
export type GabaritRendu = "karaoke" | "minimal" | "impact" | "bandeau";
export type BaseRendu = "karaoke" | "minimal";
export type StyleGroupeRendu = "base" | "impact" | "bandeau";
export type PositionGroupeRendu = "auto" | "haut" | "milieu" | "bas";

export interface MotRendu {
  mot: string;
  debutSec: number;
  finSec: number;
  enValeur?: boolean;
}

export interface SegmentRendu {
  id: string;
  debutSec: number;
  finSec: number;
  mots: MotRendu[];
  style?: StyleGroupeRendu;
  importance?: number;
  souligne?: number | null;
  position?: PositionGroupeRendu;
  inclinaison?: number;
  verrouille?: boolean;
}

/** Ce que le rendu lit d'un style de la Bibliothèque. */
export interface StyleBibliothequeRendu {
  gabarit?: GabaritRendu;
  animation: "aucune" | "mot-par-mot" | "pop" | "surlignage";
  casse: "normale" | "majuscules";
  position: "haut" | "centre" | "bas";
  /** Style nommé « Pastille Axion » (ajout pur). */
  pastille?: "axion" | "axion-ardoise";
}

/** Ce que le rendu lit de la marque : ses couleurs par jeton. */
export interface MarqueRendu {
  couleurs: { nom: string; jeton: string; valeur: string }[];
}
