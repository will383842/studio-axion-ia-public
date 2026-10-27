/**
 * Habillage d'un écran (variété du cas concret) : entrée, sortie, mouvement de caméra et transition d'entrée, lus dans
 * `jeu` (`entree`, `sortie`, `camera`, `transition`). PUR : ni `remotion` ni React. Sans `jeu`, ou avec des valeurs v4,
 * l'habillage est neutre (`NEUTRE`) et le composant ne pose aucune enveloppe : l'arbre rendu est celui de la v4.
 *
 * Gardes-fous : la caméra ne dépasse jamais `ECHELLE_CAMERA_MAX` (centrée sur la zone utile, donc les textes restent hors
 * de la bande des sous-titres, mesuré par `tests/cas-concret/variete/habillage.test.ts`) ; l'entrée et la transition ne se
 * posent pas sur le premier écran de la vidéo (`debutMs <= 50` : elle démarre sur un écran vivant ; la caméra et la sortie
 * y restent permises) ; entrée et transition ne sont jamais posées en
 * même temps (la transition l'emporte) ; un raccord L6 l'emporte sur l'entrée, la transition et la sortie.
 */
import type { ProprietesEcran } from "../../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { c01, doux, progres } from "./commun";

/** Zoom maximal de la caméra (3,5 % : les bords du contenu bougent de 19 px au plus sur 1080). */
export const ECHELLE_CAMERA_MAX = 1.035;
/** Dérive latérale maximale (px, sur 1080 de large). */
export const DERIVE_MAX_PX = 16;
export const DUREE_ENTREE_S = 0.35;
export const DUREE_SORTIE_S = 0.3;
export const DUREE_TRANSITION_S = 0.4;
/** Terracotta de la marque (fond fort, volet). */
export const COULEUR_VOLET = COULEURS_DUO.orangeVif;

export type Habillage = {
  opacite: number;
  /** Décalage horizontal du contenu (px, pour une largeur de 1080 ; mis à l'échelle de l'écran). */
  dx: number;
  echelle: number;
  flou: number;
  /** Rognage (clip-path inset, en % de chaque côté) ; `null` : aucun. */
  rognage: { haut: number; droite: number; bas: number; gauche: number } | null;
  /** Voile posé par-dessus : couleur, opacité, décalage horizontal en % de la largeur. */
  voile: { couleur: string; opacite: number; dxPct: number } | null;
  /** Échelle de la caméra (appliquée au tout, origine au centre de la zone utile). */
  camera: { echelle: number; dx: number } | null;
};

export const NEUTRE: Habillage = Object.freeze({ opacite: 1, dx: 0, echelle: 1, flou: 0, rognage: null, voile: null, camera: null }) as Habillage;

const lire = (v: unknown): string => (typeof v === "string" ? v : "");

/** Vrai si le `jeu` de l'écran demande un habillage (au moins une valeur lue ici, hors raccords L6). */
export function habille(p: Pick<ProprietesEcran, "jeu" | "debutMs">): boolean {
  const j = p.jeu;
  if (!j) return false;
  return ["entree", "sortie", "camera", "transition"].some((k) => lire(j[k]) !== "");
}

/**
 * Habillage à l'instant `t` (s depuis le début de l'écran) d'un écran de `duree` secondes.
 */
export function planHabillage(p: Pick<ProprietesEcran, "jeu" | "debutMs">, t: number, duree: number): Habillage {
  const j = p.jeu;
  if (!j) return NEUTRE;
  const premier = p.debutMs <= 50;
  const raccordEntree = lire(j.raccordEntree) !== "";
  const raccordSortie = lire(j.raccordSortie) !== "";
  let h: Habillage = { ...NEUTRE };

  // Transition d'entrée (l'emporte sur l'entrée).
  const transition = premier || raccordEntree ? "" : lire(j.transition);
  const entree = premier || raccordEntree || transition ? "" : lire(j.entree);
  if (transition === "volet-terracotta") {
    // Un volet terracotta traverse l'écran de gauche à droite, le contenu apparaît derrière.
    const x = progres(t, 0, DUREE_TRANSITION_S);
    if (x < 1) h = { ...h, voile: { couleur: COULEUR_VOLET, opacite: 1, dxPct: -100 + 200 * x }, opacite: x < 0.5 ? 0 : 1 };
  } else if (transition === "poussee") {
    const x = doux(progres(t, 0, DUREE_TRANSITION_S));
    h = { ...h, dx: (1 - x) * 1080 * 0.5, opacite: c01(x * 3) };
  } else if (transition === "eclair") {
    const x = progres(t, 0, 0.22);
    if (x < 1) h = { ...h, voile: { couleur: COULEURS_DUO.blanc, opacite: 0.85 * (1 - x), dxPct: 0 } };
  }
  // « raccord-objet » est dessiné par le raccord L6 (`raccordEntree`) : rien ici.

  if (entree === "glissement") {
    const x = doux(progres(t, 0, DUREE_ENTREE_S));
    h = { ...h, dx: (1 - x) * 90, opacite: c01(x * 2.5) };
  } else if (entree === "volet-masque") {
    const x = doux(progres(t, 0, DUREE_ENTREE_S));
    h = { ...h, rognage: x < 1 ? { haut: 0, droite: (1 - x) * 100, bas: 0, gauche: 0 } : null };
  } else if (entree === "zoom-avant") {
    const x = doux(progres(t, 0, DUREE_ENTREE_S));
    // Part de plus près (jamais plus petit que le cadre : pas de bord vide) et se pose ; même plafond que la caméra, origine au centre de la zone utile.
    h = { ...h, echelle: ECHELLE_CAMERA_MAX - (ECHELLE_CAMERA_MAX - 1) * x, opacite: c01(x * 2.5) };
  } else if (entree === "rideau") {
    const x = doux(progres(t, 0, DUREE_ENTREE_S));
    h = { ...h, rognage: x < 1 ? { haut: 0, droite: (1 - x) * 50, bas: 0, gauche: (1 - x) * 50 } : null };
  }

  // Sortie (jamais avec un raccord de sortie L6 ; jamais sur un écran trop court pour la porter).
  const sortie = raccordSortie || duree < 1.2 ? "" : lire(j.sortie);
  const fin = duree - DUREE_SORTIE_S;
  if (sortie && t > fin) {
    const x = progres(t, fin, DUREE_SORTIE_S);
    if (sortie === "poussee") h = { ...h, dx: h.dx - x * 70, opacite: h.opacite * (1 - 0.7 * x) };
    else if (sortie === "flou") h = { ...h, flou: x * 9, opacite: h.opacite * (1 - 0.55 * x) };
  }

  // Caméra : mouvement lent sur toute la durée de l'écran, borné.
  const cam = lire(j.camera);
  if (cam && cam !== "aucun" && !raccordEntree && !raccordSortie) {
    const x = c01(duree > 0 ? t / duree : 0);
    const e = ECHELLE_CAMERA_MAX - 1;
    if (cam === "zoom-lent") h = { ...h, camera: { echelle: 1 + e * x, dx: 0 } };
    else if (cam === "derive-laterale") h = { ...h, camera: { echelle: 1 + e * 0.6, dx: DERIVE_MAX_PX * (0.5 - x) } };
    else if (cam === "punch-in") h = { ...h, camera: { echelle: 1 + e * doux(progres(t, 0, 0.45)), dx: 0 } };
    else if (cam === "zoom-arriere") h = { ...h, camera: { echelle: 1 + e * (1 - x), dx: 0 } };
  }
  // Entrée « zoom-avant » (enveloppe intérieure) × caméra (extérieure) se multiplient à l'écran : le produit reste ≤ plafond.
  if (h.camera && h.echelle * h.camera.echelle > ECHELLE_CAMERA_MAX) h = { ...h, echelle: ECHELLE_CAMERA_MAX / h.camera.echelle };
  return h;
}

/** Montée du mot par mot « cascade » (px) : la v4 monte de 60 ; plafonnée pour que les mots ne passent pas dans la bande des sous-titres. */
export const MONTEE_CASCADE_PX = 80;
export type StyleMotParMot = { monteePx: number; flouPx: number } | null;
/** Style du mot par mot d'un jeu (`motParMot` : « cascade », « souffle ») ; absent ou v4 : la v4. */
export function styleMotParMot(jeu: ProprietesEcran["jeu"]): StyleMotParMot {
  const v = lire(jeu?.motParMot);
  if (v === "cascade") return { monteePx: MONTEE_CASCADE_PX, flouPx: 12 };
  if (v === "souffle") return { monteePx: 0, flouPx: 26 };
  return null;
}

/** Vrai si l'habillage ne change rien à l'image (le composant ne pose alors aucune enveloppe). */
export const estNeutre = (h: Habillage): boolean => h.opacite === 1 && h.dx === 0 && h.echelle === 1 && h.flou === 0 && h.rognage === null && h.voile === null && h.camera === null;
