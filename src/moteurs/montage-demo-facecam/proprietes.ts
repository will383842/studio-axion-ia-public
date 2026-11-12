/**
 * PROPRIÉTÉS DE LA COMPOSITION REMOTION « DemoFacecam » (lot J) — types seulement, chemins relatifs : lus tels quels
 * par `studio-rendu/compositions/demo-facecam/DemoFacecam.tsx`. Les adresses des vidéos arrivent par les ENTRÉES de
 * la demande de rendu (`facecam`, `ecran`), fusionnées dans les propriétés par l'opération `composition`.
 */
import type { PlanValide } from "../../briques/plan-scenes/schema";
import type { DonneesCalque } from "../../briques/sous-titres/scene";
import type { MiseEnPageDemo, RectPx, ZoomEcran } from "./mise-en-page";
import type { ClicEcran, LegendeEcran, SurlignageEcran } from "./pistes";

export const ID_COMPOSITION_DEMO_FACECAM = "DemoFacecam";

export interface GroupeSousTitre {
  debutMs: number;
  finMs: number;
  mots: { texte: string; debutMs: number; finMs: number }[];
}

export type ProprietesDemoFacecam = {
  largeur: number;
  hauteur: number;
  fps: 25;
  /** Images en tout : la parole de Williams (sa durée, jamais raccourcie) puis la carte de fin. */
  images: number;
  dureeParoleMs: number;
  miseEnPage: MiseEnPageDemo;
  /** Adresses signées (remplies par les entrées de la demande) ; vides dans les propriétés par défaut. */
  facecam?: string;
  ecran?: string;
  /** Région de chaque source montrée (pixels de la source) : recadrage propre, sans étirer. */
  recadrageFacecam: RectPx;
  recadrageEcran: RectPx;
  sourceFacecam: { largeur: number; hauteur: number };
  sourceEcran: { largeur: number; hauteur: number };
  /** Temps facecam = temps écran + décalage (deux fichiers) ; 0 pour une seule vidéo. */
  decalageEcranSec: number;
  zooms: ZoomEcran[];
  clics: ClicEcran[];
  surlignages: SurlignageEcran[];
  legendes: LegendeEcran[];
  /** Plan de scènes du lot C posé sur la moitié écran (pièces gestuelles retirées : elles sont devenues zooms et clics). */
  plan: PlanValide;
  sousTitres: GroupeSousTitre[];
  /** Sous-titres du style de la Bibliothèque (calque commun). Absent (rendus déjà en file) : l'ancienne pastille fixe. */
  calqueSousTitres?: DonneesCalque;
  carteFin: { titre: string; sousTitre: string };
};
