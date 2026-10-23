/**
 * SCÈNE DE LA COMPOSITION — BRIQUE COMMUNE (centralisée le 02/10 ; née au lot M4 dans le moteur avocat). PUR, sans
 * React ni Remotion, et SANS alias « @/ » : ce fichier est lu tel quel par les compositions Remotion et par la passe
 * FFmpeg de `studio-rendu` (`compositions/commune/`, `src/composition/`), comme `briques/sous-titres/scene.ts`.
 * Il ne connaît AUCUN format : ce qui change d'un format à l'autre arrive par la RECETTE (`recette.ts`) et se retrouve
 * dans les propriétés (ex. `reductionLarge`). Il dit, à chaque instant, quoi poser et où :
 *
 *   calques IMAGE (avant la LUT) : 1 décor · 2 double · 3 accessoire · 4 recadrage · 5 illustration ;
 *   calques TEXTE (après la LUT) : 6 bis incrustations graphiques · 7 encadré de titre · 8 sous-titres.
 *
 * La LUT, le grain et la vignette (calque 6) sont posés par FFmpeg entre les deux (piste `master-sans-texte`),
 * ce qui permet le recalque gratuit des seuls calques 7-8.
 *
 * Géométrie : la source du double est TOUJOURS un cadre 1080 × 1920 (Avatar V, B.3). En 9:16, le recadrage est un
 * agrandissement du composé décor + double + accessoire (Lanczos, sans renforcement) autour du point d'intérêt, sans
 * jamais découvrir un bord. En 4:5 et 1:1 (composition propre à chaque ratio, B.7), le double est ANCRÉ EN BAS :
 * « large » = double réduit (`reductionLarge` de la recette ; avocat : 4:5 ≈ 85 %, 1:1 ≈ 72 % de la hauteur),
 * « poitrine » = double à 100 % de la hauteur ; le décor reste fixe et s'étend sur les côtés.
 */
import type { DonneesCalque } from "../sous-titres/scene";

/**
 * Formats de la composition. Facecam lot F1 (ajout pur) : 16:9, composé seulement en mode pré-cadré (la piste a déjà
 * la taille 1920 × 1080) ; aucun autre format ne le demande (l'avocat saute toujours le 16:9).
 */
export type RatioScene = "9:16" | "4:5" | "1:1" | "16:9";

/** Taille de l'image par ratio. */
export const DIMENSIONS_SCENE: Record<RatioScene, { largeur: number; hauteur: number }> = {
  "9:16": { largeur: 1080, hauteur: 1920 },
  "4:5": { largeur: 1080, hauteur: 1350 },
  "1:1": { largeur: 1080, hauteur: 1080 },
  "16:9": { largeur: 1920, hauteur: 1080 },
};

/** Cadre de la source du double (webm HeyGen 1080p, `fit: contain`). */
export const SOURCE_DOUBLE = { largeur: 1080, hauteur: 1920 } as const;

/**
 * Réduction du double en plan « large » hors 9:16, quand la recette n'en dit rien : NEUTRE (aucune réduction).
 * E2E-1 n° 10 (03/10) : les valeurs de l'avocat (85 % / 72 %) sont dans SA recette (`REDUCTION_LARGE_AVOCAT`).
 */
export const REDUCTION_LARGE_PAR_DEFAUT: ReductionLarge = { "9:16": 1, "4:5": 1, "1:1": 1 };
/** Ancien nom (lot M4), gardé pour la compatibilité. */
export const REDUCTION_LARGE = REDUCTION_LARGE_PAR_DEFAUT;
/** Réduction du double en plan « large », par ratio (recette du format). Le 16:9 (facecam F1, pré-cadré) n'en a pas. */
export type ReductionLarge = Record<Exclude<RatioScene, "16:9">, number> & Partial<Record<"16:9", number>>;

export type SourceDouble =
  /** webm transparent (HeyGen `matting`), lu image par image (`OffthreadVideo transparent`). */
  | { type: "video"; url: string; transparent: boolean }
  /** Image fixe détourée (maquette, essai). */
  | { type: "image"; url: string }
  /** Double SIMULÉ (aucun visage réel) : silhouette dessinée, pour les essais sans clé. */
  | { type: "silhouette"; tenue: string; peau: string }
  /**
   * Lot R7d : second angle rendu seulement sur ses passages (± 1 s), un webm transparent par passage. Chaque fichier
   * commence à `debutSec` sur la ligne de temps (il a été rendu sur la tranche de l'audio maître de ce moment-là).
   */
  | { type: "tranches"; morceaux: { url: string; debutSec: number; finSec: number }[]; transparent: boolean };

export interface DecorScene {
  /** Image du décor (fond neutre Axion, photo floutée). Absente : la teinte seule. */
  image?: string;
  teinte: string;
  /** Lueur de la lumière de contour (liseré du double, 1-2 px). */
  teinteLumiere?: string;
  directionLumiere: "gauche" | "droite" | "face";
  /** Flou ajouté au décor (px à 1080 de large) ; 0 pour un fond déjà flou. */
  flouPx: number;
  clair: boolean;
}

export interface AccessoireScene {
  url?: string;
  /** Position dans le CADRE SOURCE du double (0-1), donc avant le recadrage (B.3). */
  x: number;
  y: number;
  largeurPct: number;
  flouPx: number;
}

export interface CadrageScene {
  valeur: "large" | "poitrine";
  /** Agrandissement en début et en fin de plan (zoom lent 100 → 106 %), 1 = cadre plein. */
  zoom: number;
  zoomFin: number;
  /** Point d'intérêt dans le cadre (0-1). */
  pointX: number;
  pointY: number;
}

export interface PlanScene {
  debutSec: number;
  finSec: number;
  type: "double" | "illustration";
  angle: "principal" | "second";
  cadrage: CadrageScene;
  illustration?: { url: string; video: boolean };
  /** Facecam lot C (ajout pur) : écran partagé sur ce plan (carte en haut, la personne en bas). Absent : plein cadre. */
  ecranPartage?: EcranPartageScene;
  /**
   * Mission H, brique `multicamera` (ajout pur) : ce morceau montre un angle fabriqué (de côté, contre-plongée) au lieu
   * de la piste principale ; le cadrage (zooms) s'applique sur cet angle. Absent : la piste principale, comme avant.
   */
  camera?: CameraScene;
  /**
   * Lot I (ajout pur) : plan d'illustration qui ne reçoit PAS la LUT du Look des B-roll : carte de motion (charte
   * exacte) ou effet spécial (rendu sur la piste montée, qui a déjà le Look). Absent : comportement d'avant.
   */
  sansLook?: boolean;
  /** Facecam lot G (ajout pur) : Will sur un côté ou en vignette, la carte à côté ou derrière. Absent : plein cadre. */
  miseEnPage?: import("../habillage-facecam/mise-en-page").MiseEnPageScene;
}

/** Angles fabriqués de la multicaméra (la face est la piste principale). */
export type CameraScene = "cote" | "contre-plongee";

/**
 * Écran partagé PAR PASSAGES (facecam lot C, plan v4 B.19 et B.23) : la moitié haute montre une carte de motion design
 * (MP4 rendu par l'opération `composition` sans mode), la moitié basse la personne, cadrée pour que ses yeux tombent à
 * 35-40 % de la demi-hauteur. Entrée en 8 à 10 images avec UNE courbe (sortie expo) : la carte descend, l'image de la
 * personne glisse vers le bas ; sortie en coupe franche.
 */
export interface EcranPartageScene {
  /** Référence de la carte (`entree:<nom>`), vidéo 1080 × `hauteurHaut`. */
  carte: string;
  /** Hauteur de la moitié haute (px) : 960 en 9:16. */
  hauteurHaut: number;
  /** Ligne de l'image composée (px) qui arrive en haut de la moitié basse (cadrage par calque). */
  sourceY: number;
  /** Durée de l'entrée en images (8 à 10 ; 0 : déjà en place, plan qui suit un plan partagé). */
  entreeImages: number;
  /** Instant de la carte (s) au début de ce plan (0 au premier plan du passage). */
  carteDebutSec: number;
  /**
   * Facecam lot F1 (ajout pur) : côte à côte (16:9) — la carte à GAUCHE sur `largeurCarte` px (pleine hauteur), la
   * personne à droite ; `sourceX` = colonne de l'image composée qui arrive au bord gauche de la personne. La carte entre
   * par la gauche pendant que l'image de la personne glisse vers la droite (même courbe). Absent : carte en haut.
   */
  cote?: "gauche";
  largeurCarte?: number;
  sourceX?: number;
}

/** Avancement de l'entrée de l'écran partagé (0 → 1) à l'image `n` du plan : courbe unique, sortie expo. */
export function entreeEcranPartage(n: number, entreeImages: number): number {
  if (entreeImages <= 0) return 1;
  const k = Math.min(1, Math.max(0, n / entreeImages));
  return (1 - Math.pow(2, -10 * k)) / (1 - Math.pow(2, -10));
}

/** Géométrie de l'écran partagé pour un avancement `k` : décalage de l'image de la personne et haut de la carte (px). */
export function geometrieEcranPartage(e: Pick<EcranPartageScene, "hauteurHaut" | "sourceY" | "cote" | "largeurCarte" | "sourceX">, k: number): { decalagePersonne: number; hautCarte: number; decalagePersonneX?: number; gaucheCarte?: number } {
  // Facecam F1 : côte à côte, la carte entre par la gauche, l'image de la personne glisse vers la droite.
  if (e.cote === "gauche" && e.largeurCarte) return { decalagePersonne: 0, hautCarte: 0, decalagePersonneX: (e.largeurCarte - (e.sourceX ?? 0)) * k, gaucheCarte: -e.largeurCarte + e.largeurCarte * k };
  return { decalagePersonne: (e.hauteurHaut - e.sourceY) * k, hautCarte: -e.hauteurHaut + e.hauteurHaut * k };
}

export type ProprietesImageComposition = {
  ratio: RatioScene;
  largeur: number;
  hauteur: number;
  fps: number;
  /** Nombre d'images (durée × fps). */
  images: number;
  decor: DecorScene;
  doubles: { principal: SourceDouble; second?: SourceDouble };
  accessoire?: AccessoireScene;
  /** Liseré de lumière de contour, du côté opposé à la lumière principale (B.3). */
  contour?: { couleur: string; cote: "gauche" | "droite" };
  plans: PlanScene[];
  /** Réduction du double en plan « large » hors 9:16 (recette du format). Absente : `REDUCTION_LARGE_PAR_DEFAUT`. */
  reductionLarge?: ReductionLarge;
  /**
   * Correcteur réel 2 (04/10) : fondu de fin (image au noir et son), en secondes, terminé à la fin de la vidéo. Absent :
   * fin franche (option « fin en boucle », ou format sans fondu).
   */
  fonduFinSec?: number;
  /**
   * Facecam lot C (09/10, plan v4 B.9) : la piste fournie est DÉJÀ à la taille du ratio (1080 × 1920, 1080 × 1350,
   * 1080 × 1080), cadrée en amont (cadrage par calque) : ni bandes ni second recadrage ; le zoom d'un plan (punch-in)
   * reste une fenêtre agrandie autour du point d'intérêt. Absent : comportement d'avant (source 1080 × 1920).
   */
  sourcePreCadree?: boolean;
  /**
   * Facecam lot C (B.8) : la piste est un intermédiaire 10 bits quasi sans perte ; le master sans texte est alors
   * gardé en 10 bits (x264 10 bits, CRF 8) pour qu'il n'y ait qu'UNE compression 8 bits, à l'export. Absent : inchangé.
   */
  source10bits?: boolean;
  /**
   * Mission H, brique `multicamera` (ajout pur) : vidéo de chaque angle fabriqué (même son, même durée que la piste
   * principale), lue par les morceaux qui portent `camera`. Absent : une seule caméra, comme avant.
   */
  cameras?: Partial<Record<CameraScene, SourceDouble>>;
};

/** Cadre de la source du double : la taille du ratio en mode pré-cadré, sinon 1080 × 1920 (Avatar V). */
export function cadreSource(p: Pick<ProprietesImageComposition, "ratio" | "sourcePreCadree">): { largeur: number; hauteur: number } {
  return p.sourcePreCadree ? DIMENSIONS_SCENE[p.ratio] : SOURCE_DOUBLE;
}

export interface EncadreScene {
  lignes: string[];
  deSec: number;
  aSec: number;
  /** Centre du cartouche (px). */
  centreYPx: number;
  taillePx: number;
  rayonPx: number;
  margeXPx: number;
  margeYPx: number;
}

export interface IncrustationScene {
  deSec: number;
  aSec: number;
  type: "montant" | "objet";
  texte?: string;
  couleur?: string;
  url?: string;
  centreXPx: number;
  centreYPx: number;
  /** Montant : taille du texte ; objet : largeur de l'image. */
  taillePx: number;
}

export type ProprietesTexteComposition = {
  ratio: RatioScene;
  largeur: number;
  hauteur: number;
  fps: number;
  images: number;
  encadre?: EncadreScene;
  incrustations: IncrustationScene[];
  sousTitres?: DonneesCalque;
  /**
   * Lot M4b : instants (s) à dessiner, un par image rendue. Le texte ne change qu'à quelques instants (un mot, un
   * groupe, l'encadré) : on ne rend qu'une image par état DIFFÉRENT, FFmpeg la répète ensuite. Absent : une image par
   * image de la vidéo (t = image / fps).
   */
  instants?: number[];
};

const borne = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** Plan affiché à l'instant t (coupes franches : jamais deux plans à la fois). Après la fin : le dernier. */
export function planAuTemps<P extends Pick<PlanScene, "debutSec" | "finSec">>(plans: P[], t: number): P | null {
  if (!plans.length) return null;
  for (const p of plans) if (t >= p.debutSec - 1e-6 && t < p.finSec - 1e-6) return p;
  return t < plans[0].debutSec ? plans[0] : plans[plans.length - 1];
}

/** Agrandissement à l'instant t d'un plan (zoom lent linéaire de `zoom` à `zoomFin`). */
export function zoomAuTemps(plan: Pick<PlanScene, "debutSec" | "finSec" | "cadrage">, t: number): number {
  const d = Math.max(1e-6, plan.finSec - plan.debutSec);
  const k = borne((t - plan.debutSec) / d, 0, 1);
  return plan.cadrage.zoom + (plan.cadrage.zoomFin - plan.cadrage.zoom) * k;
}

export interface Transformation {
  /** Recadrage du composé décor + double + accessoire (9:16) : `scale(echelle)` puis décalage, en px. */
  conteneur: { echelle: number; x: number; y: number };
  /** Boîte du cadre source du double dans l'image (px, avant le recadrage du conteneur). */
  double: { gauche: number; haut: number; largeur: number; hauteur: number };
}

/**
 * Où poser le double (et l'accessoire, dans le même cadre) à l'instant t.
 * 9:16 : double plein cadre, recadrage du composé autour du point d'intérêt, fenêtre bornée (aucun bord découvert).
 * 4:5 / 1:1 : double ancré au bas (bas du double = bas de l'image), réduit en plan large, à 100 % en poitrine.
 */
export function transformation(ratio: RatioScene, plan: Pick<PlanScene, "debutSec" | "finSec" | "cadrage">, t: number, reduction: ReductionLarge = REDUCTION_LARGE_PAR_DEFAUT, sourcePreCadree = false): Transformation {
  const { largeur: W, hauteur: H } = DIMENSIONS_SCENE[ratio];
  const z = Math.max(1, zoomAuTemps(plan, t));
  // Source pré-cadrée (facecam) : elle a déjà la taille du ratio ; même fenêtre agrandie qu'en 9:16, dans tous les ratios.
  if (ratio === "9:16" || sourcePreCadree) {
    const fenetreL = W / z;
    const fenetreH = H / z;
    const x0 = borne(plan.cadrage.pointX * W - fenetreL / 2, 0, W - fenetreL);
    const y0 = borne(plan.cadrage.pointY * H - fenetreH / 2, 0, H - fenetreH);
    return { conteneur: { echelle: z, x: -x0 * z, y: -y0 * z }, double: { gauche: 0, haut: 0, largeur: W, hauteur: H } };
  }
  // Poitrine = 100 % de la hauteur ; large = réduit. Le zoom lent s'applique en plus, toujours ancré en bas.
  const base = plan.cadrage.valeur === "poitrine" ? 1 : (reduction[ratio] ?? 1);
  const lent = plan.cadrage.zoomFin !== plan.cadrage.zoom ? zoomAuTemps(plan, t) / plan.cadrage.zoom : 1;
  const hauteur = H * base * lent;
  const largeur = (hauteur * SOURCE_DOUBLE.largeur) / SOURCE_DOUBLE.hauteur;
  return { conteneur: { echelle: 1, x: 0, y: 0 }, double: { gauche: (W - largeur) / 2, haut: H - hauteur, largeur, hauteur } };
}

/** Contrôle 4:5 / 1:1 (B.7, B.8 `zone-protegee`) : le bas du double touche le bas de l'image, jamais flottant. */
export function basDuDoubleAuBas(ratio: RatioScene, plan: Pick<PlanScene, "debutSec" | "finSec" | "cadrage">, t: number, reduction?: ReductionLarge): boolean {
  const tr = transformation(ratio, plan, t, reduction);
  const bas = tr.conteneur.y + (tr.double.haut + tr.double.hauteur) * tr.conteneur.echelle;
  return bas >= DIMENSIONS_SCENE[ratio].hauteur - 0.5;
}

/* ------------------------------------------------------------------ */
/* Accessoire (micro) : géométrie dans le CADRE SOURCE                  */
/* ------------------------------------------------------------------ */

/**
 * Micro DESSINÉ (aucune image détourée) : la capsule occupe le haut de la boîte, son pied descend jusqu'au BAS du
 * cadre source (le double est toujours ancré en bas : le pied ne flotte jamais, en 9:16 comme en 4:5 et 1:1).
 * `capsuleRatio` = hauteur de la capsule / largeur de la boîte.
 */
export const MICRO_DESSINE = { capsuleRatio: 0.62 } as const;

export interface BoitePx {
  gauche: number;
  haut: number;
  largeur: number;
  hauteur: number;
}

/** Boîte de l'accessoire dans le cadre source (px) : `x` est le centre, `y` le haut ; elle descend jusqu'au bas du cadre. */
export function boiteAccessoire(a: Pick<AccessoireScene, "x" | "y" | "largeurPct">): BoitePx {
  const largeur = (a.largeurPct / 100) * SOURCE_DOUBLE.largeur;
  const haut = a.y * SOURCE_DOUBLE.hauteur;
  return { gauche: a.x * SOURCE_DOUBLE.largeur - largeur / 2, haut, largeur, hauteur: SOURCE_DOUBLE.hauteur - haut };
}

/** Capsule du micro (la partie qui ne doit JAMAIS être coupée), dans le cadre source (px). */
export function boiteCapsule(a: Pick<AccessoireScene, "x" | "y" | "largeurPct">): BoitePx {
  const b = boiteAccessoire(a);
  return { ...b, hauteur: b.largeur * MICRO_DESSINE.capsuleRatio };
}

/**
 * Partie du cadre source VISIBLE dans l'image à l'instant t (px du cadre source). 9:16 : la fenêtre du recadrage ;
 * 4:5 et 1:1 : le cadre entier (le double, réduit et centré, tient toujours dans la largeur).
 */
export function fenetreSource(ratio: RatioScene, plan: Pick<PlanScene, "debutSec" | "finSec" | "cadrage">, t: number, reduction?: ReductionLarge): BoitePx {
  const tr = transformation(ratio, plan, t, reduction);
  if (ratio !== "9:16") return { gauche: 0, haut: 0, largeur: SOURCE_DOUBLE.largeur, hauteur: SOURCE_DOUBLE.hauteur };
  const z = tr.conteneur.echelle;
  return { gauche: -tr.conteneur.x / z, haut: -tr.conteneur.y / z, largeur: DIMENSIONS_SCENE[ratio].largeur / z, hauteur: DIMENSIONS_SCENE[ratio].hauteur / z };
}

/** Marge autour de l'accessoire pour que son flou ne soit pas rogné (3 écarts-types, px). */
export const margeFlou = (flouPx: number) => Math.ceil(3 * Math.max(0, flouPx));

/**
 * Image de l'accessoire seul (composition « CompositionAccessoire », lot M4b) : taille paire, marge de flou comprise, et
 * son coin dans le cadre source ; son bas tombe `margeFlou` px SOUS le bas du cadre (le pied y est rogné net).
 */
export function tailleAccessoire(a: Pick<AccessoireScene, "x" | "y" | "largeurPct" | "flouPx">): { largeur: number; hauteur: number; x: number; y: number } {
  const b = boiteAccessoire(a);
  const m = margeFlou(a.flouPx);
  const pair = (n: number) => Math.ceil(n / 2) * 2;
  return { largeur: pair(b.largeur + 2 * m), hauteur: pair(b.hauteur + 2 * m), x: Math.round(b.gauche - m), y: Math.round(b.haut - m) };
}

/** `a` est entièrement dans `b`, à `marge` px près (le flou du micro déborde un peu). */
export function contenuDans(a: BoitePx, b: BoitePx, marge = 0): boolean {
  return a.gauche >= b.gauche + marge - 1e-6 && a.haut >= b.haut + marge - 1e-6 && a.gauche + a.largeur <= b.gauche + b.largeur - marge + 1e-6 && a.haut + a.hauteur <= b.haut + b.hauteur - marge + 1e-6;
}

/** Deux boîtes se chevauchent-elles (bords exclus) ? */
export function chevauchement(a: BoitePx, b: BoitePx): boolean {
  return a.gauche < b.gauche + b.largeur && b.gauche < a.gauche + a.largeur && a.haut < b.haut + b.hauteur && b.haut < a.haut + a.hauteur;
}

/** Encadré visible à l'instant t (0-3 s, apparition dès la première image, sans fondu). */
export function encadreVisible(e: Pick<EncadreScene, "deSec" | "aSec"> | undefined, t: number): boolean {
  return !!e && t >= e.deSec - 1e-6 && t < e.aSec - 1e-6;
}

/** Incrustations visibles à l'instant t (apparition franche). */
export function incrustationsAuTemps<I extends Pick<IncrustationScene, "deSec" | "aSec">>(liste: I[], t: number): I[] {
  return liste.filter((i) => t >= i.deSec - 1e-6 && t < i.aSec - 1e-6);
}

/* ------------------------------------------------------------------ */
/* Paramètres de l'opération `composition` de `studio-rendu`            */
/* ------------------------------------------------------------------ */

/** Couleurs (calque 6) : LUT par plage de temps (priorité plan > vidéo > visage > format), grain, vignette. */
export interface ParametresCouleurs {
  /** Une entrée par LUT utilisée ; `plages` = instants [début, fin) où elle s'applique. Aucune plage : pas de LUT. */
  luts: { entree: string; intensite: number; plages: [number, number][] }[];
  /** Grain en luminance seulement, % (3-5). */
  grainPct: number;
  /** Taille du grain en px à 1080 de large (1,5-2 px : la recompression ne l'efface pas). */
  grainTaillePx: number;
  /** Assombrissement des coins, %. */
  vignettePct: number;
}

/** Son (B.4, B.7) : chaîne de la voix, ton de pièce, niveau. Toutes les mesures se font sur le fichier exporté. */
export interface ParametresSon {
  /** Entrée de l'audio maître (blancs déjà raccourcis). */
  entreeVoix: string;
  /** Ton de pièce (bouclé, fondu 0,5-1 s, départ aléatoire). Absent : aucun. */
  entreeTonPiece?: string;
  tonPieceDb: number;
  lufs: number;
  toleranceLufs: number;
  creteVraieMaxDbtp: number;
  passeHautHz: number;
  /** Compression douce seulement si l'écart fort / faible (LRA) du son brut dépasse ce seuil (LU). */
  seuilLraCompression: number;
  ratioCompression: number;
  /** Pauses entre les mots (après le premier) : le niveau y est mesuré (−48 à −35 dB). */
  pauses: [number, number][];
  /** Graine du départ aléatoire de la boucle du ton de pièce (stable pour une même vidéo). */
  graine: number;
  /**
   * Lot « bruitages » (02/10, D1, ajout pur) : sons posés sous la voix (entrée, début, gain en dB négatif), coupés
   * sous `passeHautHz` (120), sans aucune remontée de volume. Absent ou vide : la piste de bruitages est vide et la
   * sonie de la voix inchangée (la démonstration M4 reste identique). `gainDb` se lit PAR RAPPORT À LA VOIX : le
   * mixage (`studio-rendu/src/son/bruitages.ts`) mesure le niveau de la voix traitée et celui du son, et pose le son
   * `gainDb` sous la voix (−21 dB : le milieu de 18-24 dB).
   */
  bruitages?: { entree: string; debutSec: number; gainDb: number; passeHautHz: number }[];
}

export interface ParametresExport {
  fps: number;
  /** Débit moyen visé (VBR 2 passes) et plafond, kb/s. */
  debitKbps: number;
  debitMaxKbps: number;
  /**
   * Lot M4b : « crf » = UNE passe à qualité constante (`crf`, 17 par défaut) plafonnée à `debitMaxKbps`, la variante
   * que B.7 admet (« ou CRF 17-18 plafonné à 16 Mb/s ») ; « 2-passes » (ou absent) = VBR 2 passes. La passe 1
   * coûtait un quart du temps processeur d'une vidéo.
   */
  mode?: "crf" | "2-passes";
  crf?: number;
  /**
   * 09/10 : seuil de la note de qualité VMAF de l'export (0-100 ; absent : `STUDIO_RENDU_VMAF_MIN` du conteneur, sinon
   * 93). Sous le seuil : alerte qualité et UNE relance de l'export à un CRF plus bas. 0 : note mesurée, sans suite.
   */
  vmafMin?: number;
  audioKbps: number;
  audioHz: number;
  /**
   * Facecam lot C (B.8) : master 10 bits → l'UNIQUE compression 8 bits se fait ici : texte posé en YUV 4:4:4 10 bits,
   * passage en 4:2:0 8 bits avec tramage (diffusion d'erreur), x264 `aq-mode=3` (pas de bandes sur le fond).
   * Absent : export d'avant, inchangé.
   */
  source10bits?: boolean;
  /**
   * 11/10, tableau animé (ajout pur) : le master 8 bits passe en RVB par `gbrap` (puis `gbrp`). Mesuré avec le FFmpeg
   * 8.1.1 de l'image : la conversion directe `yuv420p → gbrp` laisse NOIRES les colonnes au-delà du dernier multiple
   * de 16 (8 colonnes en 1 080 px de large : 1072 à 1079). Absent : export d'avant, inchangé.
   */
  conversionRvbSure?: boolean;
  /** 11/10 (ajout pur) : mesures `bordNoir*` du fichier exporté (colonnes et rangées noires au bord). Absent : non mesuré. */
  mesurerBords?: boolean;
  /**
   * 12/10, tableau animé style « blocs/2 » (ajout pur) : instants (s) des images où les bords sont mesurés. Un fond
   * encre est plus sombre que le noir de la vidéo : la mesure se fait sur des écrans clairs. Absent : 10, 50 et 90 %.
   */
  instantsBords?: number[];
  /**
   * 14/10, « la vidéo s'arrête net » (ajout pur) : fin propre commune à tous les formats. L'image finale reste posée
   * `tenueSec`, puis image ET son s'effacent ensemble sur `fonduSec` vers `couleur` ; la vidéo exportée dure donc
   * `dureeSec + tenueSec`. `dureeSec` est la durée du master. Absent : coupe sèche d'avant, inchangée.
   */
  finPropre?: { fonduSec: number; tenueSec: number; dureeSec: number; couleur: string };
}

/**
 * 10/10, « zoom demandé = image cassée » : l'export est comparé à la PRISE ÉTALONNÉE (passe image, entrée `entree`, lue
 * à distance) aux instants `paires` (temps de l'export, temps de la référence, cadre du plan dans la référence).
 */
export interface ControleCouleurs {
  entree: string;
  paires: { exportSec: number; referenceSec: number; cadre?: { x: number; y: number; largeur: number; hauteur: number } }[];
}

/** Paramètres d'une demande `composition` envoyée à `studio-rendu` (sérialisables). */
export type ParametresDemandeComposition =
  | {
      mode: "complet";
      ratio: RatioScene;
      dureeSec: number;
      image: ProprietesImageComposition;
      texte: ProprietesTexteComposition;
      couleurs: ParametresCouleurs;
      son: ParametresSon;
      export: ParametresExport;
      /** Dépôts en plus de la vidéo finale : la piste `master-sans-texte` et la vignette. */
      depots: { master: { urlDepot: string; cle: string }; vignette: { urlDepot: string; cle: string } };
      /** 10/10 (ajout pur) : garde-fou des couleurs, export comparé à la prise étalonnée. Absent : rien ne change. */
      controleCouleurs?: ControleCouleurs;
    }
  | {
      /** Recalque gratuit : calques 7-8 (et 6 bis) seulement, posés sur `master-sans-texte` (entrée « master »). */
      mode: "recalque";
      ratio: RatioScene;
      dureeSec: number;
      texte: ProprietesTexteComposition;
      export: ParametresExport;
      son: Pick<ParametresSon, "lufs" | "toleranceLufs" | "creteVraieMaxDbtp" | "pauses">;
      depots: { vignette: { urlDepot: string; cle: string }; master?: { urlDepot: string; cle: string } };
      /**
       * Lot « bruitages » (02/10, D1, ajout pur) : « retirer / ajouter le son » d'un plan après fabrication ne refait
       * QUE le mixage : le son est refait (voix, ton de pièce, bruitages) et remplace celui du master, l'image est
       * recopiée telle quelle ; le nouveau master est déposé (`depots.master`). Gratuit.
       */
      remixage?: { son: ParametresSon };
    };

/** Préfixe d'une référence à une entrée de la demande (remplacée par une adresse locale dans `studio-rendu`). */
export const PREFIXE_ENTREE = "entree:";

/* ------------------------------------------------------------------ */
/* Anciens noms (lot M4, quand la scène vivait dans le moteur avocat)    */
/* ------------------------------------------------------------------ */

/** @deprecated Nom du lot M4 : `ProprietesImageComposition`. */
export type ProprietesImageAvocat = ProprietesImageComposition;
/** @deprecated Nom du lot M4 : `ProprietesTexteComposition`. */
export type ProprietesTexteAvocat = ProprietesTexteComposition;
/** @deprecated Nom du lot M4 : `ParametresDemandeComposition`. */
export type ParametresCompositionAvocat = ParametresDemandeComposition;
