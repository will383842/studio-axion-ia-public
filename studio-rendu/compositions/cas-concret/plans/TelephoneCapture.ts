/**
 * PLAN DE L'OBJET `telephone-capture` (R3) : un vrai écran du site dans un téléphone (référence : fonction `tel`,
 * blocs `s7`, `s8`, `s10`). La capture est montrée ENTIÈRE, jamais rognée :
 * - `image` : toute l'image dans l'écran du téléphone (cadrée en largeur, bandes au-dessus et au-dessous si elle est
 *   plus large que l'écran), avec une légère respiration ;
 * - `page-entiere` : cadrée en largeur, la page défile doucement jusqu'au bas pendant l'écran, depuis le haut ou depuis
 *   son décalage de départ (`departY`, la partie utile montrée d'emblée : le calendrier d'une page de rendez-vous) ;
 * - `video` (film de frappe) : tout le film dans l'écran ; la progression de l'écran pilote le temps du film.
 * Une onde orange marque le point touché (événement `onde`, sinon à la fin du défilement ou de la frappe).
 *
 * PUR : ni `remotion` ni React. Le temps vient de `p.t` (instant de l'écran, lu à l'image courante).
 */
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { FPS_ECRANS, type BoitePx } from "../../../../src/briques/ecrans-motion";
import { c01, couleursDuFond, doux, planOnde, progres, teinte, va } from "./commun";
import { cadrer, heureObjet, RATIOS_OBJETS, type ContexteObjet } from "./Objet";
import { animDe, arrivee, bouger } from "./anim-objets";

/** Proportions du téléphone de la référence (`.tel` : 470 × 920, coins de 76 px, bord de 14 px, écran à coins de 62 px). */
const TELEPHONE = Object.freeze({ largeur: 470, rayon: 76, bord: 14, rayonEcran: 62 });

/** Cadre d'un téléphone dans une boîte : corps, bord, écran (boîte de l'écran relative au corps). */
export function cadreTelephone(boite: BoitePx, fond: ContexteObjet["fond"] = "ivoire") {
  const corps = cadrer(RATIOS_OBJETS["telephone-capture"]!, boite);
  const k = corps.largeur / TELEPHONE.largeur;
  const bord = TELEPHONE.bord * k;
  return {
    corps,
    k,
    rayon: TELEPHONE.rayon * k,
    bord,
    ecran: { x: bord, y: bord, largeur: corps.largeur - 2 * bord, hauteur: corps.hauteur - 2 * bord },
    rayonEcran: TELEPHONE.rayonEcran * k,
    couleur: COULEURS_DUO.encre,
    ombre: couleursDuFond(fond).ombre,
  };
}

/** Départ et marge de fin du défilement ou de la frappe (s). */
const DEBUT_MOUVEMENT = { "page-entiere": 0.1, video: 0.3, image: 0 } as const;
const MARGE_FIN_S = 0.3;

/** Progression (0 à 1) du défilement ou de la frappe à l'instant `t` d'un écran de `duree` s. */
export function progressionCapture(sorte: "image" | "video" | "page-entiere", t: number, duree: number): { progression: number; finS: number } {
  const debut = DEBUT_MOUVEMENT[sorte];
  const longueur = Math.max(0.6, duree - debut - MARGE_FIN_S);
  return { progression: sorte === "image" ? 0 : va(progres(t, debut, longueur)), finS: debut + longueur };
}

/**
 * Boîte de la capture dans l'écran du téléphone (px relatifs à l'écran), à l'instant `t`. Proportions de la capture
 * toujours gardées ; `image` et `video` y tiennent entières ; `page-entiere` prend la largeur et défile.
 */
export function boiteCapture(c: { sorte: "image" | "video" | "page-entiere"; largeur: number; hauteur: number; departY?: number; cle?: string }, ecran: { largeur: number; hauteur: number }, t: number, duree: number): BoitePx {
  const W = ecran.largeur;
  const H = ecran.hauteur;
  const w = Math.max(1, c.largeur);
  const h = Math.max(1, c.hauteur);
  if (c.sorte === "image" && c.cle?.startsWith(PREFIXE_IMAGE_DU_CAS)) return cadrageAnnonce(w, h, W, t, duree);
  if (c.sorte === "page-entiere") {
    const s = W / w;
    const hs = h * s;
    const course = Math.max(0, hs - H);
    const depart = Math.min(course, Math.max(0, c.departY ?? 0) * hs);
    return { x: 0, y: -(depart + (course - depart) * progressionCapture("page-entiere", t, duree).progression), largeur: W, hauteur: hs };
  }
  const s = Math.min(W / w, H / h);
  const l = w * s;
  const hs = h * s;
  const marge = (H - hs) / 2;
  // Respiration de l'image (référence : 5 px à l'échelle du téléphone), bornée par les bandes : jamais rognée.
  const respiration = c.sorte === "image" ? Math.min(Math.max(0, marge), 5 * (W / 442)) * Math.sin(t * 1.4) : 0;
  return { x: (W - l) / 2, y: marge + respiration, largeur: l, hauteur: hs };
}

/** Clés des images déclarées par un cas (l'annonce de la v4) : cadrées et zoomées comme `tel7`. */
export const PREFIXE_IMAGE_DU_CAS = "visuels-cas-concret/";
/** `tel7` de la v4 : image de 505 px dans l'écran de 442 px, zoom de 1,02 à 1,12 (origine 50 % / 40 %), montée −10 → −70 px. */
export const CADRAGE_ANNONCE_V4 = Object.freeze({ largeurRel: 505 / 442, zoom: [1.02, 1.12] as const, montee: [-10, -70] as const, origineY: 0.4, departMontee: 0.2 });

/**
 * V4-3 · l'image du cas (l'annonce) comme la v4 : plus large que l'écran (légèrement rognée sur les côtés), zoom lent
 * et montée douce pendant tout l'écran (`v4.html`, plan `s7`).
 */
export function cadrageAnnonce(w: number, h: number, W: number, t: number, duree: number): BoitePx {
  const a = CADRAGE_ANNONCE_V4;
  const k = W / 442;
  const l = W * a.largeurRel;
  const hs = (h * l) / w;
  const d = Math.max(0.1, duree);
  const zoom = a.zoom[0] + (a.zoom[1] - a.zoom[0]) * c01(t / d);
  const montee = (a.montee[0] + (a.montee[1] - a.montee[0]) * va(c01((t - a.departMontee) / d))) * k;
  const x0 = (W - l) / 2;
  return { x: x0 + (l - l * zoom) / 2, y: a.origineY * hs * (1 - zoom) + montee, largeur: l * zoom, hauteur: hs * zoom };
}

/** Image du film à montrer (frappe pilotée par la progression de l'écran), dans [0, dernière image]. */
export function imageDuFilm(dureeFilmSec: number, progression: number): number {
  const derniere = Math.max(0, Math.ceil(dureeFilmSec * FPS_ECRANS) - 1);
  return Math.max(0, Math.min(derniere, Math.floor(c01(progression) * dureeFilmSec * FPS_ECRANS)));
}

/** Point touché (fraction de l'écran du téléphone) quand aucun n'est donné : le bas du formulaire, où sont les boutons. */
export const POINT_TOUCHE = Object.freeze({ x: 0.5, y: 0.72 });

/** L7 · noms des animations 1 et 2 (planches). */
export const ANIMS_TELEPHONE_CAPTURE = Object.freeze(["", "écran qui s'allume", "capture qui monte dans l'écran"]);

/** Ce qui est visible du téléphone et de sa capture. */
export function planTelephoneCapture(p: ContexteObjet) {
  const n = animDe(p);
  return n ? planTelephoneCaptureAnime(p, n) : planTelephoneCaptureV4(p);
}

/** Le plan de la v4 (animation n° 0). */
function planTelephoneCaptureV4(p: ContexteObjet) {
  const cadre = cadreTelephone(p.boite, p.fond);
  const duree = p.dureeEcran ?? 3;
  const c = p.capture;
  const ecran = cadre.ecran;
  const capture = c
    ? (() => {
        const mouvement = progressionCapture(c.sorte, p.t, duree);
        return {
          src: c.src,
          sorte: c.sorte,
          boite: boiteCapture(c, ecran, p.t, duree),
          progression: mouvement.progression,
          finMouvementS: mouvement.finS,
          imageFilm: c.sorte === "video" ? imageDuFilm(p.dureeCaptureSec ?? 0, mouvement.progression) : null,
        };
      })()
    : null;
  const departOnde = heureObjet(p, "onde", capture && capture.sorte !== "image" ? capture.finMouvementS + 0.05 : Number.NaN);
  const o = Number.isFinite(departOnde) ? planOnde(progres(p.t, departOnde + 0.02, 0.4)) : { opacite: 0, echelle: 0.4 };
  const diametre = 110 * (ecran.largeur / 442);
  return {
    ...cadre,
    fondEcran: c && c.sorte === "image" ? COULEURS_DUO.nuit : COULEURS_DUO.blanc,
    capture,
    onde: {
      x: ecran.largeur * POINT_TOUCHE.x,
      y: ecran.hauteur * POINT_TOUCHE.y,
      diametre,
      trait: 7 * (ecran.largeur / 442),
      couleur: COULEURS_DUO.orangeVif,
      remplissage: teinte(COULEURS_DUO.orangeVif, 0.35),
      ...o,
    },
  };
}

/**
 * L7 · animations 1 et 2 (même capture, entière, même défilement, même onde). 1 : l'écran s'allume — la capture paraît
 * en fondu sur l'écran éteint. 2 : la capture monte dans l'écran en entrant. Sans capture : le téléphone de la v4.
 */
function planTelephoneCaptureAnime(p: ContexteObjet, n: number) {
  const v4 = planTelephoneCaptureV4(p);
  const anim = { numero: n, nom: ANIMS_TELEPHONE_CAPTURE[n]!, cochage: false };
  if (!v4.capture) return { ...v4, anim };
  const mouvement = n === 1 ? bouger({ opacite: doux(progres(p.t, 0.05, 0.4)) }) : arrivee(progres(p.t, 0, 0.6), { dy: v4.ecran.hauteur * 0.3 });
  return { ...v4, ...(n === 1 ? { fondEcran: v4.couleur } : {}), capture: { ...v4.capture, mouvement }, anim };
}
