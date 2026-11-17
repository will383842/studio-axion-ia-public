/**
 * C2-U20a (AM-09) : ESCALIER de lignes de texte, GÉOMÉTRIE seule (2 à 6 lignes décalées en diagonale, de plus en plus
 * grandes). PUR : ni React, ni Remotion, aucun alias `@/`, aucune horloge, aucun hasard. Lu par le rendu.
 * Éteint : seul `ESCALIER_ACTIF = true` allumerait, et rien n'importe ce fichier (le dessin est C2-U20b). `null` = repli
 * sur le gabarit « groupe » d'aujourd'hui. Jamais dans la v4. Manrope Bold, mesurée à sa vraie largeur.
 */
import { largeurLigne } from "./mesure";

/** Interrupteur : seul `true` allumerait. Éteint ici, rien ne l'allume. */
export const ESCALIER_ACTIF = false;

export const ESCALIER = Object.freeze({
  /** Décalage horizontal par ligne, en fraction de la largeur de l'image. */
  decalageParLigne: 0.12,
  /** Échelle de la dernière ligne (la première vaut 1). */
  tailleMax: 1.4,
  /** Interligne, en multiple de la taille (0,8 à 0,9). */
  interligne: 0.85,
  lignesMin: 2,
  lignesMax: 6,
});

export interface ZoneSureEscalier {
  xPx: number;
  yPx: number;
  largeurPx: number;
  hauteurPx: number;
}

export interface LigneEscalierGeo {
  /** Texte exactement tel qu'entré. */
  texte: string;
  xPx: number;
  yPx: number;
  largeurPx: number;
  hauteurPx: number;
  taillePx: number;
  /** 1 pour la première ligne, jusqu'à `ESCALIER.tailleMax` pour la dernière. */
  echelle: number;
}

export interface GeometrieEscalier {
  lignes: LigneEscalierGeo[];
}

const EPS = 1e-6;

/**
 * Place les lignes dans la zone sûre, ou renvoie `null` (repli sur le gabarit groupe) si le nombre de lignes n'est pas
 * de 2 à 6, si une ligne est vide, ou si une ligne sortirait de la zone sûre. `taillePx` = taille de la 1re ligne.
 */
export function geometrieEscalier(lignes: readonly string[], largeur: number, _hauteur: number, zone: ZoneSureEscalier, taillePx: number): GeometrieEscalier | null {
  const n = lignes.length;
  if (n < ESCALIER.lignesMin || n > ESCALIER.lignesMax) return null;
  if (!(taillePx > 0) || !(largeur > 0)) return null;
  const sortie: LigneEscalierGeo[] = [];
  let y = zone.yPx;
  for (let i = 0; i < n; i++) {
    const mots = lignes[i].split(/\s+/).filter(Boolean);
    if (mots.length === 0) return null;
    const echelle = 1 + (i / (n - 1)) * (ESCALIER.tailleMax - 1);
    const taille = taillePx * echelle;
    const largeurPx = largeurLigne(mots, "Manrope Bold", taille);
    const hauteurPx = taille * ESCALIER.interligne;
    const x = zone.xPx + i * ESCALIER.decalageParLigne * largeur;
    if (x < zone.xPx - EPS || x + largeurPx > zone.xPx + zone.largeurPx + EPS) return null;
    if (y + hauteurPx > zone.yPx + zone.hauteurPx + EPS) return null;
    sortie.push({ texte: lignes[i], xPx: x, yPx: y, largeurPx, hauteurPx, taillePx: taille, echelle });
    y += hauteurPx;
  }
  return { lignes: sortie };
}
