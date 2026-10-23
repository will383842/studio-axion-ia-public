/**
 * PAUME VERS LE HAUT (lot I2) : l'objet REPOSE sur la paume, comme un téléphone posé sur la main tendue à plat.
 * PUR, déterministe, sans alias « @/ » (lu tel quel par Remotion).
 *
 * Entrée : les 21 points MediaPipe Hands d'une main (x, y normalisés sur l'image, z relatif en part de la LARGEUR,
 * plus petit = plus près de la caméra) et, si MediaPipe le donne, le côté de la main (gauche / droite de la personne).
 *
 * Repère de la paume (coordonnées « iso » : x, y, z dans la même unité, la hauteur de l'image ; x vers la droite,
 * y vers le BAS, z vers le fond) :
 *   - centre : milieu entre le poignet (0) et la ligne des jointures (5, 9, 13, 17) ;
 *   - normale : sortant de la PAUME (côté intérieur de la main). Le produit (5 − 0) × (17 − 0) la donne pour une main
 *     droite et son opposé pour une gauche ; le sens de flexion des doigts (ils se replient TOUJOURS vers la paume)
 *     tranche quand le côté manque ou contredit une flexion nette ;
 *   - axe des doigts : poignet → base du majeur, rendu perpendiculaire à la normale.
 *
 * Paume vers le haut = normale tournée vers le haut (au moins 30° au-dessus de l'horizontale) ET main ouverte.
 * Main retournée (dos vers le haut) ou paume montrée de face : pas d'effet (« montrez la paume ouverte vers le haut »).
 */

export type Vec3 = [number, number, number];

/** 21 points MediaPipe Hands : [x, y, z] (x, y normalisés sur l'image, z en part de la largeur). */
export type PointsMain = Vec3[];

/** Côté de la main de la PERSONNE (MediaPipe Tasks, image non retournée). */
export type CoteMain = "gauche" | "droite";

export const PAUME = {
  /** Composante « vers le haut » minimale de la normale de la paume (sin 30°). */
  hautMin: 0.5,
  /** En dessous (dos de la main vers le haut) : main retournée. */
  retourneeMax: -0.3,
  /** Ouverture minimale (0 : poing ; 1 : main à plat). Les doigts légèrement repliés passent. */
  ouvertureMin: 0.45,
  /** Flexion nette des doigts (part de la longueur de la paume) qui l'emporte sur le côté donné par MediaPipe. */
  flexionNette: 0.4,
  /** Flexion minimale pour trancher sans côté connu. */
  flexionMin: 0.2,
} as const;

export const CONSEIL_PAUME = "Montrez la paume ouverte vers le haut, à plat devant vous, comme pour y poser un téléphone.";

const sous = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const plus = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const fois = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const scal = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vect = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norme = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const unitaire = (a: Vec3): Vec3 => {
  const n = norme(a);
  return n > 1e-9 ? fois(a, 1 / n) : [0, 0, 0];
};
const borne = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export const vec3 = { sous, plus, fois, scal, vect, norme, unitaire };

/** Points MediaPipe → coordonnées iso (unité : hauteur de l'image). `largeurSurHauteur` : format de la source. */
export function versIso(points: PointsMain, largeurSurHauteur: number): Vec3[] {
  return points.map((p) => [p[0] * largeurSurHauteur, p[1], p[2] * largeurSurHauteur]);
}

export interface ReperePaume {
  /** Centre de la paume (iso) : milieu entre le poignet et les jointures. */
  centre: Vec3;
  /** Creux de la paume (iso), là où l'objet repose : un peu plus vers les doigts que le centre. */
  creux: Vec3;
  /** Normale sortant de la paume (iso, unitaire). */
  normale: Vec3;
  /** Axe poignet → doigts, perpendiculaire à la normale (iso, unitaire). */
  doigts: Vec3;
  /** Axe latéral = normale × doigts. */
  lateral: Vec3;
  /** Longueur de la paume (poignet → base du majeur, corrigée du raccourci) et largeur (jointures 5 → 17), iso. */
  longueur: number;
  largeur: number;
  /** 0 : poing ; 1 : main à plat. */
  ouverture: number;
  /** Flexion des doigts vers la normale « main droite » (part de la longueur). */
  flexion: number;
  /** Le sens de la paume est-il sûr ? (côté connu ou flexion nette) */
  sur: boolean;
}

const DOIGTS: [number, number][] = [
  [5, 8],
  [9, 12],
  [13, 16],
  [17, 20],
];

/** Repère de la paume d'après les 21 points (iso). Rend null si les points sont incomplets ou dégénérés. */
export function reperePaume(iso: Vec3[], cote?: CoteMain): ReperePaume | null {
  if (iso.length < 21 || iso.some((p) => !p || p.some((v) => !Number.isFinite(v)))) return null;
  const p0 = iso[0];
  const jointures = [iso[5], iso[9], iso[13], iso[17]];
  const milieuJointures = fois(jointures.reduce(plus, [0, 0, 0] as Vec3), 1 / 4);
  const centre = fois(plus(p0, milieuJointures), 0.5);
  const nDroite = unitaire(vect(sous(iso[5], p0), sous(iso[17], p0)));
  if (norme(nDroite) < 0.5) return null;
  const longueurBrute = norme(sous(iso[9], p0));
  const largeur = norme(sous(iso[5], iso[17]));
  // Raccourci : vue de face, une paume à plat paraît courte ; une paume fait ≈ 1,3 fois la largeur des jointures.
  const longueur = Math.max(longueurBrute, largeur * 1.3);
  if (longueur < 1e-4) return null;
  // Flexion : les bouts des doigts sortent du plan de la paume du côté de la paume.
  const flexion = DOIGTS.reduce((s, [b, t]) => s + scal(sous(iso[t], iso[b]), nDroite), 0) / (DOIGTS.length * longueur);
  // Ouverture : distance poignet → bout du doigt rapportée à poignet → base (1 : poing ; ≈ 1,8 : à plat).
  const rapport = DOIGTS.reduce((s, [b, t]) => s + norme(sous(iso[t], p0)) / Math.max(1e-6, norme(sous(iso[b], p0))), 0) / DOIGTS.length;
  const ouverture = borne((rapport - 1.15) / (1.7 - 1.15), 0, 1);
  let signe = 0;
  const signeFlexion = Math.abs(flexion) >= PAUME.flexionMin ? Math.sign(flexion) : 0;
  if (cote) {
    signe = cote === "droite" ? 1 : -1;
    // MediaPipe se trompe parfois de côté : une flexion nette contraire l'emporte.
    if (Math.abs(flexion) >= PAUME.flexionNette && Math.sign(flexion) !== signe) signe = Math.sign(flexion);
  } else signe = signeFlexion;
  const normale: Vec3 = signe ? fois(nDroite, signe) : nDroite;
  const brut = sous(iso[9], p0);
  const doigts = unitaire(sous(brut, fois(normale, scal(brut, normale))));
  const lateral = unitaire(vect(normale, doigts));
  const creux = plus(centre, fois(doigts, 0.3 * norme(brut)));
  return { centre, creux, normale, doigts, lateral, longueur, largeur, ouverture: +ouverture.toFixed(4), flexion: +flexion.toFixed(4), sur: signe !== 0 };
}

export type EtatPaume = { ok: true } | { ok: false; raison: "retournee" | "de-face" | "fermee" | "incertaine" };

/** La paume est-elle ouverte et tournée vers le haut ? */
export function etatPaume(r: ReperePaume | null): EtatPaume {
  if (!r) return { ok: false, raison: "incertaine" };
  if (!r.sur) return { ok: false, raison: "incertaine" };
  const haut = -r.normale[1];
  if (haut <= PAUME.retourneeMax) return { ok: false, raison: "retournee" };
  if (haut < PAUME.hautMin) return { ok: false, raison: "de-face" };
  if (r.ouverture < PAUME.ouvertureMin) return { ok: false, raison: "fermee" };
  return { ok: true };
}

/** Raccourci : repère + état d'un échantillon. */
export function paumeVersLeHaut(points: PointsMain | undefined, largeurSurHauteur: number, cote?: CoteMain): EtatPaume {
  if (!points) return { ok: false, raison: "incertaine" };
  return etatPaume(reperePaume(versIso(points, largeurSurHauteur), cote));
}

/* ------------------------------------------------------------------ */
/* Orientation de l'objet posé                                         */
/* ------------------------------------------------------------------ */

/** Iso (y vers le bas, z vers le fond) → repère de la scène 3D (y vers le haut, z vers la caméra). */
export const versScene = (v: Vec3): Vec3 => [v[0], -v[1], -v[2]];

/** Rotation de `v` autour de l'axe unitaire `k` (Rodrigues). */
export function tourner(v: Vec3, k: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return plus(plus(fois(v, c), fois(vect(k, v), s)), fois(k, scal(k, v) * (1 - c)));
}

/** Quaternion [x, y, z, w] d'une base orthonormée (colonnes X, Y, Z du repère local dans la scène). */
export function quaternionDeBase(X: Vec3, Y: Vec3, Z: Vec3): [number, number, number, number] {
  const m00 = X[0], m01 = Y[0], m02 = Z[0];
  const m10 = X[1], m11 = Y[1], m12 = Z[1];
  const m20 = X[2], m21 = Y[2], m22 = Z[2];
  const trace = m00 + m11 + m22;
  let x: number, y: number, z: number, w: number;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    w = 0.25 / s;
    x = (m21 - m12) * s;
    y = (m02 - m20) * s;
    z = (m10 - m01) * s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }
  const n = Math.hypot(x, y, z, w) || 1;
  return [x / n, y / n, z / n, w / n];
}

export interface OrientationPosee {
  /** Quaternion du repère local de l'objet dans la scène (y haut, z vers la caméra). */
  quaternion: [number, number, number, number];
  /** Normale de la face avant (écran, face du logo) dans la scène. */
  face: Vec3;
  /** Normale de la paume dans la scène (l'objet s'en écarte de sa demi-épaisseur). */
  normalePaume: Vec3;
  /** Inclinaison ajoutée vers la caméra (radians). */
  inclinaison: number;
}

/** Angle maximal entre la face de l'objet et la caméra : au-delà, l'objet est incliné vers elle (lisible). */
export const ANGLE_LISIBLE = (58 * Math.PI) / 180;
export const INCLINAISON_MAX = (24 * Math.PI) / 180;

/**
 * Orientation de l'objet posé sur la paume.
 *   - `a-plat` (téléphone) : dos sur la paume, grand côté le long des doigts, écran incliné vers la caméra juste assez
 *     pour être lisible ; `sensHaut` (+1 / −1) choisit le bout de l'écran tourné vers les doigts (fixé une fois pour
 *     tout le passage, pour que l'écran se lise à l'endroit) ;
 *   - `debout` (logo sur son socle) : socle sur la paume, face tournée vers la caméra.
 */
export function orienterSurPaume(r: ReperePaume, mode: "a-plat" | "debout", sensHaut: 1 | -1 = 1): OrientationPosee {
  const n = unitaire(versScene(r.normale));
  const u = unitaire(versScene(r.doigts));
  const camera: Vec3 = [0, 0, 1];
  if (mode === "debout") {
    let face = sous(camera, fois(n, scal(camera, n)));
    if (norme(face) < 0.15) face = fois(u, -1);
    const Z = unitaire(face);
    const Y = n;
    const X = unitaire(vect(Y, Z));
    return { quaternion: quaternionDeBase(X, Y, unitaire(vect(X, Y))), face: Z, normalePaume: n, inclinaison: 0 };
  }
  const angle = Math.acos(borne(scal(n, camera), -1, 1));
  const inclinaison = borne(angle - ANGLE_LISIBLE, 0, INCLINAISON_MAX);
  let Z = n;
  let Y = fois(u, sensHaut);
  const axe = vect(n, camera);
  if (inclinaison > 0 && norme(axe) > 1e-6) {
    const k = unitaire(axe);
    Z = unitaire(tourner(n, k, inclinaison));
    Y = unitaire(tourner(Y, k, inclinaison));
  }
  Y = unitaire(sous(Y, fois(Z, scal(Y, Z))));
  const X = unitaire(vect(Y, Z));
  return { quaternion: quaternionDeBase(X, Y, Z), face: Z, normalePaume: n, inclinaison: +inclinaison.toFixed(4) };
}

/**
 * Sens de l'écran (+1 : haut de l'écran vers les doigts ; −1 : vers le poignet) qui le rend lisible à l'endroit :
 * le haut de l'écran doit monter dans l'image. Décidé une fois sur le passage (médiane), jamais image par image ;
 * doigts à l'horizontale (cas indécis, sujet au bruit) : vers les doigts, comme un téléphone qu'on tient.
 */
export function sensLisible(reperes: ReperePaume[]): 1 | -1 {
  const montees = reperes.map((r) => -r.doigts[1] - 0.25 * r.doigts[2]).sort((a, b) => a - b);
  if (!montees.length) return 1;
  return montees[Math.floor(montees.length / 2)] >= -0.2 ? 1 : -1;
}

/* ------------------------------------------------------------------ */
/* Occultation par les doigts                                          */
/* ------------------------------------------------------------------ */

/** Segment de doigt (capsule) au premier plan, en coordonnées NORMALISÉES de la source ; `r` en part de la hauteur. */
export interface CapsuleDoigt {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  r: number;
}

/**
 * Segments pouvant passer devant l'objet : le pouce (de sa base au bout) et, pour les quatre doigts, les deux dernières
 * phalanges (les premières restent dans le plan de la paume, sous l'objet).
 */
const CHAINES: number[][] = [
  [2, 3, 4],
  [6, 7, 8],
  [10, 11, 12],
  [14, 15, 16],
  [18, 19, 20],
];

/**
 * Segments de doigts (pouce compris) qui passent DEVANT l'objet : leur profondeur est plus proche de la caméra que la
 * face de l'objet au même endroit de l'image (plan de l'objet passant par `centreObjet`, normale `faceIso`). Hors de
 * l'objet, montrer la vraie image par-dessus ne change rien : seule la profondeur compte.
 */
export function doigtsDevant(iso: Vec3[], r: ReperePaume, centreObjet: Vec3, faceIso: Vec3, largeurSurHauteur: number): CapsuleDoigt[] {
  const capsules: CapsuleDoigt[] = [];
  // Profondeur MediaPipe bruitée : il faut être nettement devant pour cacher l'objet.
  const marge = r.largeur * 0.12;
  const devant = (p: Vec3) => {
    if (Math.abs(faceIso[2]) < 0.08) return false;
    // Profondeur du plan de l'objet à la position (x, y) du point.
    const zPlan = centreObjet[2] - (faceIso[0] * (p[0] - centreObjet[0]) + faceIso[1] * (p[1] - centreObjet[1])) / faceIso[2];
    return p[2] < zPlan - marge;
  };
  CHAINES.forEach((chaine, k) => {
    const rayon = r.largeur * (k === 0 ? 0.13 : 0.1);
    for (let i = 0; i < chaine.length - 1; i++) {
      const a = iso[chaine[i]];
      const b = iso[chaine[i + 1]];
      if (!devant(a) && !devant(b)) continue;
      capsules.push({
        x1: +(a[0] / largeurSurHauteur).toFixed(4),
        y1: +a[1].toFixed(4),
        x2: +(b[0] / largeurSurHauteur).toFixed(4),
        y2: +b[1].toFixed(4),
        r: +rayon.toFixed(4),
      });
    }
  });
  return capsules;
}
