/**
 * CHARTE `interface-claire/1` — style « interface claire » du face caméra animé (référence LinkedIn analysée le
 * 14/10/2026, `<dossier-de-plan-prive>/ANALYSE-COMPLETE-v2.md`).
 *
 * Couleurs : celles des posts Buffer (décision de Will du 14/10), COPIÉES ici et figées pour que ce générateur reste
 * indépendant de `charte-video/1` (tableau animé). Un changement = une nouvelle version, jamais une retouche.
 * Géométrie et temps : MESURÉS sur la référence (720 × 1280, 30 i/s), exprimés en fractions de l'image et en secondes
 * pour rester justes à toute taille et à toute cadence.
 */

export const VERSION_CHARTE_INTERFACE = "interface-claire/1";

export const COULEURS = Object.freeze({
  /** Bande, corps des cartes, étiquettes claires (crème de la référence). */
  ivoire: "#E9DCC8",
  /** Contours, textes, ombres dures, pastilles (bleu nuit de la référence). */
  encre: "#110A05",
  /** En-têtes de carte, plaques des mots forts, barre de progression, éléments actifs (cyan de la référence). */
  orange: "#B44F29",
  /** Éléments en attente (grisés), filets, mentions. */
  sable: "#BFA88B",
} as const);

/** Polices : Montserrat ExtraBold (titres, sous-titres, étiquettes), Inter Bold (texte des cartes). SIL OFL 1.1. */
export const POLICES = Object.freeze({ titre: "Axion Montserrat ExtraBold", texte: "Axion Inter Bold" } as const);

/** Géométrie mesurée sur la référence, en fraction de la LARGEUR (l) ou de la HAUTEUR (h) de l'image. */
export const GEOMETRIE = Object.freeze({
  /** Bande claire : 21,5 % de la hauteur. */
  bandeH: 0.215,
  /** Poussée de l'image du présentateur quand une carte est là : 17 % de la hauteur (visage 160 → 270 px sur 640). */
  pousseeH: 0.17,
  /**
   * Carte : 81 % de la largeur, centrée (marge 9,5 %), haut à 13 % de la hauteur (cahier des charges de l'architecte du
   * 14/10, mesuré sur la référence : carte de 0,13 à ≥ 0,46 de la hauteur). Hauteur minimale : `cadrage.ts` (CARTE).
   */
  carteL: 0.81,
  carteX: 0.095,
  carteY: 0.13,
  /** En-tête de carte : 4 % de la hauteur. */
  enteteH: 0.04,
  /** Contour épais et ombre dure (mesurés : ≈ 3 px et ≈ 5 px sur 720 de large). */
  contourL: 0.0045,
  ombreL: 0.0075,
  /** Rayon des coins (≈ 14 px sur 720). */
  rayonL: 0.02,
  /** Fenêtre d'illustration : 62 % de la largeur, rapport 4:5 (référence ≈ 55-60 %, agrandie au contrôle côte à côte). */
  fenetreL: 0.62,
  /** Sous-titres : hors carte 66 % de la hauteur, sous la carte 43 %, sous une fenêtre 80 %. */
  sousTitresHors: 0.66,
  sousTitresCarte: 0.43,
  sousTitresFenetre: 0.8,
} as const);

/** Durées mesurées (secondes) : toutes les entrées tiennent en 3 à 7 images à 30 i/s. */
export const TEMPS = Object.freeze({
  /** 4 images à 25 i/s : la prise descend en 3 images pendant que la carte tombe (le visage est déjà dessous). */
  entreeCarte: 0.16,
  sortieCarte: 0.12,
  retourImage: 0.14,
  pop: 0.17,
  glisse: 0.15,
  /** 5-6 images à 25 i/s. */
  entreeFenetre: 0.22,
  sortieFenetre: 0.17,
  motEntree: 0.1,
  trait: 0.12,
  /** Inclinaison des étiquettes et tuiles (degrés). */
  inclinaison: 3,
} as const);

/**
 * Largeur ESTIMÉE (px) d'un texte en Montserrat ExtraBold capitales, à la taille `taille` (px). Estimation volontairement
 * large (capitales de la police ≈ 0,72 em en moyenne, comptées 0,78) : elle sert à réduire une étiquette AVANT qu'elle ne
 * sorte du cadre — mieux vaut une étiquette un peu plus petite qu'un mot coupé (« VOTRE ENTREPRISE AVANCE », 14/10).
 */
export function largeurTexte(texte: string, taille: number, espacement = 0): number {
  let s = 0;
  let n = 0;
  for (const c of texte.toUpperCase()) {
    n++;
    if (/\s/.test(c)) s += 0.3;
    else if (/[MWÆŒ]/.test(c)) s += 1.0;
    else if (/[IJ1|!]/.test(c)) s += 0.38;
    else if (/[.,:;'’()«»\-]/.test(c)) s += 0.4;
    else if (/[?]/.test(c)) s += 0.62;
    else if (/\d/.test(c)) s += 0.72;
    else s += 0.78;
  }
  return s * taille + espacement * n;
}
