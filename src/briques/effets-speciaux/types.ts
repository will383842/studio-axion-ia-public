/**
 * EFFETS SPÉCIAUX À LA DEMANDE (facecam, lot F3 : L11b reporté après la v1). Types partagés entre le moteur (calcul
 * PUR des poses et des éclats) et les compositions Remotion (`studio-rendu/compositions/commune/effets/`). PUR, sans
 * alias « @/ » : lu tel quel par Remotion.
 *
 * Quatre effets, JAMAIS automatiques (seulement « Monteur, … » ou le fil « Discuter avec mon monteur ») :
 *   - `objet-main`      : un objet 3D (logo Axion extrudé par défaut) posé sur la paume, qui suit la main ;
 *   - `vitre-brisee`    : l'image se fissure depuis un point, les éclats tombent et révèlent le plan suivant ;
 *   - `ecran-plie`      : l'image se plie en deux comme une feuille puis s'envole ;
 *   - `zoom-traversant` : la caméra plonge à travers l'écran, le plan suivant s'ouvre par un iris.
 */

export type IdEffetSpecial = "objet-main" | "vitre-brisee" | "ecran-plie" | "zoom-traversant";
export type StyleTransition = Exclude<IdEffetSpecial, "objet-main">;

/** Objets 3D proposés (générés en géométrie simple, aucune ressource externe). */
export const OBJETS_MAIN = ["logo-axion", "telephone", "cube", "sphere", "piece", "etoile", "coeur"] as const;
export type ObjetMain = (typeof OBJETS_MAIN)[number];

/** Point en pixels de l'image de sortie. */
export interface PointPx {
  x: number;
  y: number;
}

/** Boîte en pixels de l'image de sortie : x, y, largeur, hauteur. */
export type BoitePx = [number, number, number, number];

/** Fenêtre de la SOURCE (prise préparée, positions normalisées 0-1) montrée dans l'image de sortie (recadrage). */
export interface FenetreSource {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

/** Lumière de la vraie prise, accordée à l'objet 3D (direction, couleurs, intensité). */
export interface Lumiere {
  /** −1 : la lumière vient de la gauche de l'image ; +1 : de la droite. */
  directionX: number;
  /** −1 : d'en bas ; +1 : d'en haut. */
  directionY: number;
  /** Couleur de la lumière principale (`#RRGGBB`). */
  teinte: string;
  /** Couleur de l'ambiance (ombres). */
  ambiance: string;
  /** 0,5 (pièce sombre) à 1,4 (très lumineuse). */
  intensite: number;
  /** Lot I2 : température de couleur estimée de la lumière principale (K), d'après `teinte`. */
  temperatureK?: number;
}

/**
 * Lot I2 — carte d'environnement construite à partir de l'image de la PRISE (panorama équirectangulaire minuscule,
 * RVB 0-255 à la suite) : les reflets du métal et du verre montrent la vraie pièce, pas un studio inventé.
 */
export interface CarteEnvironnement {
  largeur: number;
  hauteur: number;
  pixels: number[];
}

/** Lot I2 — caractère de l'image de la prise, pour que l'objet ne paraisse pas « collé ». */
export interface CaracterePrise {
  /** Flou de la prise autour de la main (px de sortie) : profondeur de champ et mise au point. */
  flouPx: number;
  /** Grain (écart type du bruit, 0-255) mesuré sur les zones unies. */
  grain: number;
}

/** Segment de doigt au premier plan (px de sortie) : la vraie image est remise par-dessus l'objet, bords adoucis. */
export interface CapsulePx {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  r: number;
}

/** Lot I2 — objet POSÉ sur la paume (21 points MediaPipe) : orientation complète, doigts devant, mouvement. */
export interface PoseSurPaume {
  /** Quaternion [x, y, z, w] de l'objet dans la scène (y vers le haut, z vers la caméra). */
  quaternion: [number, number, number, number];
  /** Normale de la paume dans la scène : l'objet repose sur ce plan. */
  normale: [number, number, number];
  /** Inclinaison ajoutée vers la caméra (radians), pour un écran lisible. */
  inclinaison: number;
  /** Doigts et pouce au premier plan. */
  doigts: CapsulePx[];
  /** Déplacement de la paume depuis l'image précédente (px) : flou de mouvement. */
  vitesseX: number;
  vitesseY: number;
}

/** Pose de l'objet sur UNE image de sortie (calculée d'avance, la composition ne fait que dessiner). */
export interface PoseObjet {
  /** Centre de l'objet (px). */
  x: number;
  y: number;
  /** Taille de l'objet (px, diamètre apparent). */
  taille: number;
  /** Centre de la paume (px) : ombre portée et reflet orange sur la main. */
  paumeX: number;
  paumeY: number;
  /** 0 : invisible ; 1 : pleinement là (apparition en ressort, disparition rapide). */
  visible: number;
  /** Progrès de l'éclat d'apparition (0 → 1), −1 hors éclat. */
  eclat: number;
  /** Progrès de l'éclat de disparition (0 → 1), −1 hors disparition. */
  fuite: number;
  /** Rotations de l'objet (radians) : rotation propre, inclinaison suivant le mouvement de la main. */
  rotY: number;
  rotX: number;
  rotZ: number;
  /** L'objet a été écarté du visage sur cette image (garde-fou « le visage n'est jamais caché »). */
  ecarte: boolean;
  /** Lot I2 : présent quand l'objet repose sur la paume (x, y = point de contact ; rotX/Y/Z = micro-oscillation). */
  surPaume?: PoseSurPaume;
}

/** Propriétés de la composition `EffetObjetMain`. */
export type ProprietesEffetObjetMain = {
  largeur: number;
  hauteur: number;
  fps: number;
  images: number;
  /** Vidéo de la piste montée (ou image fixe si `sourceImage`). `entree:<nom>` en production. */
  source: string;
  sourceImage?: boolean;
  /** Première image de la source montrée (temps du montage × fps). */
  debutSourceImage: number;
  objet: ObjetMain;
  poses: PoseObjet[];
  lumiere: Lumiere;
  /** Lot I2 : reflets d'après l'image de la prise (absente : environnement construit d'après la lumière). */
  environnement?: CarteEnvironnement;
  /** Lot I2 : flou et grain de la prise (absent : net, grain léger). */
  prise?: CaracterePrise;
  /** Lot I2 : suréchantillonnage du rendu 3D (1 à 3 ; 2 par défaut). */
  surEchantillonnage?: number;
};

/** Propriétés de la composition `EffetTransition` (vitre, pli, zoom traversant). */
export type ProprietesEffetTransition = {
  largeur: number;
  hauteur: number;
  fps: number;
  images: number;
  style: StyleTransition;
  /** Plan qui se brise : sa DERNIÈRE image avant l'effet est figée. */
  avant: { source: string; image?: boolean; debutImage: number };
  /** Plan révélé (le plan suivant, ou une carte déjà rendue). */
  apres: { source: string; image?: boolean; debutImage: number };
  /** Image de la composition où l'effet commence, et sa durée (images). */
  debutEffetImage: number;
  dureeEffetImages: number;
  /** Point d'impact (vitre), de pliure ou de plongée (zoom) — toujours hors du visage. */
  point: PointPx;
  /** Visage du plan révélé (px) : les éclats l'évitent. */
  visageApres?: BoitePx;
  graine: number;
};
