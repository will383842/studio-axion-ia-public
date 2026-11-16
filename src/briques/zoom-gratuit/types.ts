/**
 * Zoom gratuit (fiche C8-Z03) : types des fenêtres calculées par le Studio.
 * Studio seul : ce dossier n'est pas copié par le Dockerfile, studio-rendu/** ne l'importe pas (D2-15).
 */
export type TypeZoom = "punch-in" | "lent";

export interface FenetreZoom {
  debutSec: number;
  finSec: number;
  facteur: number;
  type: TypeZoom;
}

export type RaisonExclusion = "plaquette" | "descente" | "transition" | "debut" | "fin";

export interface Exclusion {
  debutSec: number;
  finSec: number;
  raison: RaisonExclusion;
}

export interface OptionsZoom {
  /** Plafonné à 1,08 quoi qu'il arrive. */
  facteurMax: number;
  dureeMinSec: number;
  dureeMaxSec: number;
  parMinuteMax: number;
  ecartMinSec: number;
  /** Point fixe du zoom (les yeux), en fraction de l'image. */
  centre: { x: number; y: number };
}
