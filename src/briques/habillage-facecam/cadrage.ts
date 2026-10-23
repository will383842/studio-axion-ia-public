/**
 * CADRAGE PAR CALQUE (plan v4 B.23). La position du visage vient de la piste du visage (FaceLandmarker, lot B),
 * exprimée en px de l'image composée (1080 × 1920 en 9:16 pré-cadré) ou de la source 4K pour la vignette.
 *   - moitié basse (écran partagé) : yeux à 35-40 % de la demi-hauteur ;
 *   - côté : visage entre 35 et 45 % de la largeur du cadre ;
 *   - vignette : 28 à 35 % de la largeur de l'image, calculée sur la source 4K (pas d'agrandissement d'une image déjà réduite) ;
 *   - image 0 : visage en pleine phrase (premier mot), titre déjà affiché ; fin : 6 à 8 images après le dernier mot,
 *     fondu audio de 50 ms.
 */

export interface VisageCadre {
  /** Milieu des deux yeux (px). */
  yeuxX: number;
  yeuxY: number;
  /** Hauteur du visage, front-menton (px). */
  hauteurVisage: number;
}

export interface Fenetre {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export const CADRAGE_CALQUE = {
  /** Yeux à 35-40 % de la demi-hauteur (milieu visé : 37,5 %). */
  yeuxMoitieBasse: [0.35, 0.4] as const,
  /** Visage entre 35 et 45 % de la largeur du cadre (côté). */
  visageCote: [0.35, 0.45] as const,
  /** Vignette : 28 à 35 % de la largeur de l'image. */
  largeurVignette: [0.28, 0.35] as const,
  /** Fin : 6 à 8 images après le dernier mot ; fondu audio de 50 ms. */
  imagesApresDernierMot: 7,
  fonduAudioFinSec: 0.05,
} as const;

const borne = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/**
 * Moitié basse d'un écran partagé : ligne de l'image (px) qui arrive en haut de la moitié basse, pour que les yeux
 * tombent à 37,5 % de la demi-hauteur, sans jamais découvrir le bas de l'image.
 */
export function sourceYMoitieBasse(visage: Pick<VisageCadre, "yeuxY">, hauteurImage: number, demiHauteur: number, cible = (CADRAGE_CALQUE.yeuxMoitieBasse[0] + CADRAGE_CALQUE.yeuxMoitieBasse[1]) / 2): number {
  return Math.round(borne(visage.yeuxY - cible * demiHauteur, 0, Math.max(0, hauteurImage - demiHauteur)));
}

/** Les yeux sont-ils bien placés dans la moitié basse (contrôle) ? */
export function yeuxBienPlaces(visage: Pick<VisageCadre, "yeuxY">, sourceY: number, demiHauteur: number): boolean {
  const r = (visage.yeuxY - sourceY) / demiHauteur;
  return r >= CADRAGE_CALQUE.yeuxMoitieBasse[0] - 0.005 && r <= CADRAGE_CALQUE.yeuxMoitieBasse[1] + 0.005;
}

/**
 * Côté (« mets-moi à droite / à gauche ») : fenêtre de la source à poser dans un cadre `cadre` (largeur × hauteur),
 * visage à 40 % de la largeur du cadre, compté depuis le bord EXTÉRIEUR (la personne regarde vers l'explication).
 */
export function fenetreCote(visage: VisageCadre, source: { largeur: number; hauteur: number }, cadre: { largeur: number; hauteur: number }, cote: "gauche" | "droite"): Fenetre {
  // Le visage occupe ≈ 38 % de la hauteur du cadre : échelle source → cadre.
  const echelle = Math.min(source.hauteur / cadre.hauteur, (visage.hauteurVisage / 0.38) / cadre.hauteur);
  const l = cadre.largeur * echelle;
  const h = cadre.hauteur * echelle;
  const part = (CADRAGE_CALQUE.visageCote[0] + CADRAGE_CALQUE.visageCote[1]) / 2;
  const xVisage = cote === "gauche" ? part : 1 - part;
  return {
    x: Math.round(borne(visage.yeuxX - xVisage * l, 0, source.largeur - l)),
    y: Math.round(borne(visage.yeuxY - 0.36 * h, 0, source.hauteur - h)),
    largeur: Math.round(l),
    hauteur: Math.round(h),
  };
}

/**
 * Vignette (image dans l'image) : largeur 31 % de l'image, fenêtre prise dans la SOURCE 4K (le visage y remplit ≈ 55 %
 * de la hauteur de la vignette) ; `ratioVignette` = largeur / hauteur de la vignette (3:4 par défaut).
 */
export function vignette(visage4K: VisageCadre, source4K: { largeur: number; hauteur: number }, image: { largeur: number }, ratioVignette = 3 / 4): { largeurPx: number; hauteurPx: number; fenetre: Fenetre } {
  const largeurPx = Math.round((image.largeur * (CADRAGE_CALQUE.largeurVignette[0] + CADRAGE_CALQUE.largeurVignette[1])) / 2 / 2) * 2;
  const hauteurPx = Math.round(largeurPx / ratioVignette / 2) * 2;
  const h = Math.min(source4K.hauteur, visage4K.hauteurVisage / 0.55);
  const l = h * ratioVignette;
  return {
    largeurPx,
    hauteurPx,
    fenetre: { x: Math.round(borne(visage4K.yeuxX - l / 2, 0, source4K.largeur - l)), y: Math.round(borne(visage4K.yeuxY - 0.42 * h, 0, source4K.hauteur - h)), largeur: Math.round(l), hauteur: Math.round(h) },
  };
}

/**
 * Bornes de la vidéo : image 0 = début du premier mot (visage en pleine phrase, aucun temps mort ; le titre est posé
 * dès l'image 0) ; fin = 7 images après la fin du dernier mot, fondu audio de 50 ms (coupe sèche qui boucle).
 */
export function bornesVideo(mots: { debutSec: number; finSec: number }[], fps = 25): { debutSec: number; finSec: number; fonduAudioSec: number } | null {
  if (!mots.length) return null;
  return { debutSec: mots[0].debutSec, finSec: +(mots[mots.length - 1].finSec + CADRAGE_CALQUE.imagesApresDernierMot / fps).toFixed(3), fonduAudioSec: CADRAGE_CALQUE.fonduAudioFinSec };
}
