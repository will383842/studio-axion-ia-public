/**
 * PLAN COMMUN DES ÉCRANS « Cas concret MD » (R1a) : ce qui est visible à une image donnée, pour les pièces que tous
 * les types partagent — entrée de l'écran, fond, marque, étiquette, mot par mot, ligne, entrée d'un objet, biais,
 * surgissement, fil d'étapes, éclair. Grammaire d'animation portée de la vidéo de référence (`v8-a.html` : fonctions
 * `mots`, `entrer`, `biais`, `surgir`, `onde`).
 *
 * PUR : aucune importation de `remotion` ni de React (les tests l'appellent directement). Toute couleur, police et
 * taille vient de la charte `charte-duo/1` et de la brique `ecrans-motion`. Déterministe : tout se calcule depuis le
 * numéro d'image.
 */
import { motsBalises, type BoitePx, type Fond, type PoliceEcrans, type ProprietesEcran, type TextePose } from "../../../../src/briques/ecrans-motion";
import { COULEURS_DUO, FONDS, POLICES_DUO, TAILLES_DUO } from "../../../../src/briques/habillage/charte-duo";

/* ------------------------------------------------------------------ */
/* Temps et courbes                                                     */
/* ------------------------------------------------------------------ */

/** Borne dans [0, 1]. */
export const c01 = (x: number) => Math.max(0, Math.min(1, x));
/** Progrès d'une animation qui commence à `debut` et dure `duree` (s), au temps `t`. */
export const progres = (t: number, debut: number, duree: number) => (duree <= 0 ? (t >= debut ? 1 : 0) : c01((t - debut) / duree));
/** Sortie douce (cubique). */
export const doux = (x: number) => 1 - Math.pow(1 - c01(x), 3);
/** Entrée et sortie douces (cubique). */
export const va = (x: number) => {
  const y = c01(x);
  return y < 0.5 ? 4 * y * y * y : 1 - Math.pow(-2 * y + 2, 3) / 2;
};
/** Petit dépassement puis repos. */
export const rebond = (x: number) => {
  const c = 1.7;
  const y = c01(x);
  return 1 + (c + 1) * Math.pow(y - 1, 3) + c * Math.pow(y - 1, 2);
};
/** Instant (s) depuis le début de l'écran, à l'image `image`. */
export const instant = (image: number, fps: number) => image / fps;
/** Heure (s, depuis le début de l'écran) d'un événement de l'écran, ou `null`. */
export function heureEvenement(p: Pick<ProprietesEcran, "evenements">, cible: string): number | null {
  const e = p.evenements.find((x) => x.cible === cible);
  return e ? e.ms / 1000 : null;
}

/* ------------------------------------------------------------------ */
/* Couleurs et polices (charte `charte-duo/1`)                          */
/* ------------------------------------------------------------------ */

/** Couleur de la charte avec une opacité (suffixe alpha hexadécimal). */
export function teinte(couleur: string, opacite: number): string {
  const a = Math.round(c01(opacite) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${couleur.slice(0, 7)}${a}`;
}

/** Les couleurs d'un fond : fond, texte, accent, secondaire, et les couleurs du dégradé. */
export function couleursDuFond(fond: Fond) {
  const f = FONDS[fond];
  return {
    ...f,
    degrade:
      fond === "sombre"
        ? { centre: COULEURS_DUO.nuitLueur, milieu: COULEURS_DUO.nuitHaut, bord: COULEURS_DUO.nuit }
        : { centre: COULEURS_DUO.ivoireHaut, milieu: COULEURS_DUO.ivoire, bord: COULEURS_DUO.ivoire },
    marque: fond === "sombre" ? COULEURS_DUO.blanc : COULEURS_DUO.encre,
    ombre: teinte(fond === "sombre" ? COULEURS_DUO.nuit : COULEURS_DUO.encre, fond === "sombre" ? 0.7 : 0.3),
    lueur: teinte(COULEURS_DUO.orangeVif, 0.75),
    lueurLarge: teinte(COULEURS_DUO.orangeVif, 0.45),
  };
}

/** Famille CSS d'une police des écrans (noms déclarés par la charte, chargés par `commune/polices.ts`). */
export const famille = (police: PoliceEcrans) => (police === "anton" ? POLICES_DUO.affiche.famille : POLICES_DUO.texte.famille);
/** Graisse CSS d'une police des écrans. */
export const graisse = (police: PoliceEcrans) => (police === "anton" ? POLICES_DUO.affiche.graisse : POLICES_DUO.texte.graisse);

/* ------------------------------------------------------------------ */
/* Écran                                                               */
/* ------------------------------------------------------------------ */

/** Durée de l'entrée d'un écran (s). */
export const ENTREE_ECRAN_S = 0.2;

/** Entrée de l'écran : opacité et léger recul (0,2 s), visible dès la première image de la vidéo. */
export function planEntreeEcran(p: Pick<ProprietesEcran, "debutMs">, t: number) {
  const e = progres(t, 0, ENTREE_ECRAN_S);
  return { opacite: p.debutMs <= 50 ? 1 : c01(0.35 + e), echelle: 1.04 - 0.04 * doux(e) };
}

/** La marque « axion-ia.com », en haut de la zone sûre, dans la couleur du fond. */
export function planMarque(p: Pick<ProprietesEcran, "marque" | "fond" | "hauteur">, boite: BoitePx) {
  return {
    texte: p.marque,
    boite,
    taille: TAILLES_DUO.marque * p.hauteur,
    couleur: couleursDuFond(p.fond).marque,
    famille: famille("inter-gras"),
    approcheEm: 0.083,
  };
}

/** L'étiquette en capitales espacées, couleur d'accent ; apparaît avec l'écran. */
export function planEtiquette(fond: Fond, pose: TextePose, t: number) {
  return { texte: pose.texte, boite: pose.boite, taille: pose.tailleRendue, couleur: couleursDuFond(fond).accent, famille: famille("inter-gras"), approcheEm: pose.approche, opacite: progres(t, 0, ENTREE_ECRAN_S) };
}

/** Réglages du mot par mot (vidéo de référence) : pas entre deux mots, durée d'un mot, montée, flou. */
export const MOT_PAR_MOT = Object.freeze({ pasS: 0.09, dureeS: 0.34, monteePx: 60, flouPx: 12 });

/**
 * Mot par mot : chaque mot entre à son tour (opacité, montée de 60 px, flou de 12 px), décalé de 90 ms, en 340 ms.
 * `ecoule` = temps (s) depuis le départ du premier mot.
 */
export function planMotParMot(texte: string, ecoule: number, pas: number = MOT_PAR_MOT.pasS, duree: number = MOT_PAR_MOT.dureeS) {
  return motsBalises(texte).map((m, i) => {
    const x = progres(ecoule - i * pas, 0, duree);
    return { mot: m.mot, accent: m.accent, opacite: x, decalageY: (1 - doux(x)) * MOT_PAR_MOT.monteePx, flou: x < 1 ? (1 - x) * MOT_PAR_MOT.flouPx : 0 };
  });
}

/** Instant (s) où le dernier mot d'un texte est entièrement visible. */
export const finMotParMot = (texte: string, pas: number = MOT_PAR_MOT.pasS, duree: number = MOT_PAR_MOT.dureeS) => Math.max(0, motsBalises(texte).length - 1) * pas + duree;

/** Une ligne de texte (Inter) qui monte de 20 px en 0,3 s. */
export function planLigne(t: number, debut: number) {
  const x = progres(t, debut, 0.3);
  return { opacite: x, decalageY: (1 - doux(x)) * 20 };
}

/** Entrée d'un objet (« entrer ») : opacité rapide, montée de `dy` px et léger zoom. */
export function planEntreeObjet(x: number, dy = 90) {
  return { opacite: c01(x * 2.5), decalageY: (1 - doux(x)) * dy, echelle: 0.93 + 0.07 * doux(x) };
}

/** Biais 3D lent d'un objet (« biais ») : rotations en degrés, au temps `t` (s). */
export function planBiais(t: number, rotY = -11, rotX = 5) {
  return { perspective: 1900, rotY: rotY + 3 * Math.sin(t * 0.9), rotX: rotX + 1.6 * Math.cos(t * 0.7) };
}

/** Surgissement (« surgir ») d'une pastille ou d'une coche, avec rebond. */
export function planSurgir(x: number, rotation = 0) {
  return { opacite: c01(x * 3), echelle: 0.6 + 0.4 * rebond(x), rotation };
}

/** Impulsion d'un visuel (événement `objet`) : l'objet grossit de 6 % puis revient, en 0,35 s ; 1 hors de l'impulsion. */
export function planImpulsion(t: number, debut: number | null): number {
  return debut === null ? 1 : 1 + 0.06 * Math.sin(Math.PI * progres(t, debut, 0.35));
}

/** Onde d'un toucher (« onde ») sur un écran de téléphone. */
export function planOnde(x: number) {
  return { opacite: x > 0 && x < 1 ? 1 - x : 0, echelle: 0.4 + x };
}

/**
 * Fil d'avancement des étapes : 0 au début de la première étape, 100 % à la fin de la dernière.
 * `avance` = part écoulée de l'écran courant (0 à 1).
 */
export function planFilEtapes(numero: number, nombreEtapes: number, avance: number) {
  const n = Math.max(1, nombreEtapes);
  return { fraction: c01((Math.max(1, Math.min(numero, n)) - 1 + c01(avance)) / n), couleur: COULEURS_DUO.orangeVif };
}

/** Durée de l'éclair orange (s). */
export const DUREE_ECLAIR_S = 0.14;

/** Éclair orange (moment clé) : opacité au temps `t` d'un éclair parti à `debut`. */
export function planEclair(t: number, debut: number | null) {
  if (debut === null || t < debut || t >= debut + DUREE_ECLAIR_S) return { opacite: 0, couleur: COULEURS_DUO.orangeVif };
  return { opacite: 0.55 * (1 - progres(t, debut, DUREE_ECLAIR_S)), couleur: COULEURS_DUO.orangeVif };
}

/** Puce (pastille blanche à coche verte) : couleurs et taille de la charte. */
export function planPuce(texte: string, taille: number) {
  return { texte, taille, fond: COULEURS_DUO.blanc, texteCouleur: COULEURS_DUO.encre, coche: COULEURS_DUO.vert, cocheTrait: COULEURS_DUO.blanc, famille: famille("inter-gras") };
}

/** Propriétés communes à tout objet redessiné : sa boîte, l'instant, le fond, ses textes ou sa capture. */
export type ProprietesObjet = {
  boite: BoitePx;
  /** Instant (s) depuis le début de l'écran. */
  t: number;
  /** Instant (s) depuis le début de la vidéo (mouvements lents continus). */
  tVideo: number;
  fond: Fond;
  textes?: string[];
  /** `departY` : page entière, part de sa hauteur montrée d'emblée (0 = haut). */
  capture?: { src: string; sorte: "image" | "video" | "page-entiere"; largeur: number; hauteur: number; departY?: number };
};
