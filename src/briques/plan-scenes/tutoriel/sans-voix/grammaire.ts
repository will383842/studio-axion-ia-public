/**
 * GRAMMAIRE VISUELLE DU TUTORIEL SANS VOIX « COMPOSÉ » (lot qualité 25-11, QUAL-1) : zones, tailles minimales,
 * durées, courbes et couleurs par NOM de jeton. PUR : aucun React, aucun Remotion, imports RELATIFS seulement
 * (lu tel quel par `studio-rendu`). La géométrie (`geometrie.ts`) n'utilise que ces règles.
 *
 * Règles (PLAN B1, B3) :
 *  - CONTENU : x 5,93 % → 94,07 %, y 5 % → (haut de la bande − 3 %) ; tout ce qui est dessiné reste dedans ;
 *  - BANDE des sous-titres : x 5 % → 95 %, y (basPct − 9) % → (basPct + 6) % ; aucune scène n'y entre, jamais ;
 *  - tout texte ≥ 32 px à 1080 de petit côté (× min(L, H) / 1080 ailleurs) ; ni bleu, ni jaune, ni orange sur ivoire.
 */
import { contrasteWcag } from "../../../charte/axion-2026";
import { CHARTE_AXION, adoucir, decelerer, entre, progression } from "../../../jetons-motion";
import type { CouleurCharte, FormatImage, RectPx, ZonesSansVoix } from "./types";

export { adoucir, decelerer, entre, progression, contrasteWcag };

/** Échelle d'un format : petit côté / 1080. */
export function echelleFormat(format: FormatImage): number {
  return Math.min(format.largeur, format.hauteur) / 1080;
}

/** Tailles minimales de texte (px réels à 1080 de petit côté). Voir `taillesMinPour` pour un autre format. */
export const TAILLES_MIN = {
  /** Titre d'ouverture / repère final. */
  titre: 64,
  /** Titre d'écran / de panneau. */
  titreEcran: 40,
  /** Libellé de carte, rubrique, ligne, alerte, bouton. */
  libelle: 36,
  /** Tout autre texte visible. */
  minimum: 32,
  /** Sous-titres. */
  sousTitres: 52,
  /** Question et carte-phrase (texte principal d'une scène sans écran). */
  principal: 56,
} as const;

/** Les mêmes minimums mis à l'échelle du format (arrondis à l'entier le plus proche). */
export function taillesMinPour(format: FormatImage): Record<keyof typeof TAILLES_MIN, number> {
  const s = echelleFormat(format);
  const r = {} as Record<keyof typeof TAILLES_MIN, number>;
  for (const k of Object.keys(TAILLES_MIN) as (keyof typeof TAILLES_MIN)[]) r[k] = Math.round(TAILLES_MIN[k] * s);
  return r;
}

/**
 * Plancher INTERNE des ajustements de texte (34 px à 1080) : la sortie de scène recule à 0,96, donc 34 × 0,96 ≥ 32 :
 * aucun texte visible ne passe sous 32 px, même pendant la transition.
 */
export const PLANCHER_TEXTE = 34;

/**
 * Plancher ABSOLU d'un texte (33,4 px à 1080) : ultime recours quand un mot long ne tient pas à `PLANCHER_TEXTE`.
 * 33,4 × 0,96 (recul de sortie) ≥ 32 : même en transition, aucun texte visible ne passe sous 32 px.
 */
export const PLANCHER_ABSOLU = 33.4;

/** Interligne UNIQUE de tous les textes du tutoriel sans voix (hauteur d'un bloc = lignes × taille × INTERLIGNE). */
export const INTERLIGNE = 1.12;

/** Opacité des parties NON visées par une mise en valeur (`focus`) : elles s'atténuent ENSEMBLE avec leurs enfants. */
export const OPACITE_ATTENUEE = 0.75;

/** Durées (ms), pas de rebond. */
export const DUREES_MS = {
  entree: 500,
  /** Entre deux scènes (tour 7, transitions vives) : la sortante finit de s'effacer en 130 ms (≤ 0,15 dès +115 ms) AVANT que l'entrante
   *  n'affiche du texte (elle entre de +130 à +330 ms : lisible à ≥ 0,85 avant +350 ms). */
  sortieScene: 130,
  decalageEntreeScene: 130,
  entreeScene: 200,
  transition: 600,
  glisseTransitionPx: 14,
  /** Montée/descente de la mise en valeur d'un `focus` (pas de zoom : contour terracotta + atténuation du reste). */
  camera: 600,
  tri: 500,
  panneau: 500,
  alerteTenue: 3200,
  clic: 500,
  pulseTotal: 1400,
  /** Non utilisé : la mise en valeur n'agrandit rien (plus de zoom, voir `focus`). */
  zoomMax: 1,
  reculSortie: 0.04,
} as const;

/** Caméra douce appliquée à TOUT le groupe d'une scène (échelle 1 → 1,035, dérive ≤ 12 px, courbes douces, sans rebond). */
export const CAMERA = { echelleMax: 0.035, deriveXPx: 6, deriveYPx: 10, periodeMs: 9000 } as const;

/** Couleurs de la charte par NOM. `grisTexte` = gris foncé lisible sur ivoire (contraste ≥ 4,5:1). */
export const COULEURS_HEX: Record<CouleurCharte, string> = {
  ivoire: CHARTE_AXION.ivoire,
  gris: CHARTE_AXION.gris,
  noir: CHARTE_AXION.noir,
  terracotta: CHARTE_AXION.terracotta,
  blanc: "#FFFFFF",
  grisTexte: "#5E5D59",
};

export function hexDe(nom: CouleurCharte): string {
  return COULEURS_HEX[nom];
}

/** Les noms de couleur valides (pour les contrôles). */
export const NOMS_COULEURS: readonly CouleurCharte[] = ["ivoire", "gris", "noir", "terracotta", "blanc", "grisTexte"];

/**
 * Zones d'une image `format` dont la bande des sous-titres est centrée sur `basPct` (% de la hauteur).
 * 4:5 (1080 × 1350, basPct 87) : contenu x 64→1016, y 68→1012 ; bande x 54→1026, y 1053→1255 ; marges ≥ 24 px.
 */
export function zonesSansVoix(format: FormatImage, basPct: number): ZonesSansVoix {
  const { largeur: L, hauteur: H } = format;
  const s = echelleFormat(format);
  const marge = Math.round(24 * s);
  const lat = Math.max(marge, Math.round(0.0593 * L));
  const haut = Math.max(marge, Math.round(0.05 * H));
  const bandeHautPct = basPct - 9;
  const bandeBasPct = basPct + 6;
  const bandeX = Math.round(0.05 * L);
  const bandeY = Math.round((H * bandeHautPct) / 100);
  const bandeBas = Math.min(H - marge, Math.floor((H * bandeBasPct) / 100));
  const contenuBas = Math.floor((H * (bandeHautPct - 3)) / 100);
  const contenu: RectPx = { x: lat, y: haut, largeur: L - 2 * lat, hauteur: Math.max(1, contenuBas - haut) };
  const bande: RectPx = { x: bandeX, y: bandeY, largeur: L - 2 * bandeX, hauteur: Math.max(1, bandeBas - bandeY) };
  return { contenu, bande, margeBordPx: marge };
}

/** Avancement 0 → 1 d'un mouvement qui commence à `debutMs` et dure `dureeMs` (ms absolues). */
export function avancement(tMs: number, debutMs: number, dureeMs: number, courbe: (t: number) => number = decelerer): number {
  return progression(tMs, debutMs, dureeMs, courbe);
}
