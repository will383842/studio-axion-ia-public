/**
 * X1-16 — BARRE DE TEMPS FINE. PUR : largeur = temps écoulé / durée, jamais d'exception, toujours dans [0, 1].
 * Imports relatifs seulement (lu par le rendu). Aucune courbe, aucune horloge, aucun hasard : même entrée = même image.
 * Ajout pur : rien ne l'importe en production, non inscrit.
 */
import { accentSur, avecOpacite, type FondAxion } from "../../jetons-motion";

/** Épaisseur de la barre, en % de la hauteur du cadre (plafond de la fiche : 0,6 %). */
export const EPAISSEUR_MAX_POURCENT = 0.6;

/** Marges protégées du réseau visé, en % du cadre (forme de `ZoneProtegee`, copiée). */
export interface MargesBoutons {
  haut: number;
  droite: number;
  bas: number;
  gauche: number;
}

export interface BarreTemps {
  /** Temps écoulé / durée, 0..1. */
  progression: number;
  /** Boîte de la barre en % du cadre, dans la zone sûre : posée sur le bord bas de la zone, hors des boutons. */
  boite: { x: number; y: number; largeur: number; hauteur: number };
  /** Terracotta de la charte. */
  couleur: string;
  /** Rail : même y et même hauteur que la barre, pleine largeur de la zone, terracotta atténué ; indépendant du temps. La barre est toujours incluse dans le rail. */
  rail: { boite: { x: number; y: number; largeur: number; hauteur: number }; couleur: string };
}

/** Opacité du rail (teinte de la charte atténuée). */
export const OPACITE_RAIL = 0.28;

const borne01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const marge = (n: number): number => (Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);

export function barreTemps(p: { image: number; dureeImages: number; zone: MargesBoutons; fond: FondAxion }): BarreTemps {
  const progression = p.dureeImages > 0 ? borne01(p.image / p.dureeImages) : 0;
  const gauche = marge(p.zone.gauche);
  const droite = marge(p.zone.droite);
  const largeurZone = Math.max(0, 100 - gauche - droite);
  const hauteur = EPAISSEUR_MAX_POURCENT;
  const y = Math.max(0, 100 - marge(p.zone.bas) - hauteur);
  return {
    progression,
    boite: { x: gauche, y, largeur: largeurZone * progression, hauteur },
    couleur: accentSur(p.fond, "terracotta"),
    rail: { boite: { x: gauche, y, largeur: largeurZone, hauteur }, couleur: avecOpacite(accentSur(p.fond, "terracotta"), OPACITE_RAIL) },
  };
}
