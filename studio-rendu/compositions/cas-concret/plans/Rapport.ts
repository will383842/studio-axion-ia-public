/**
 * PLAN de l'objet `rapport` (R5) : trois pages de biais qui se déploient en éventail, puis une barre orange qui se
 * remplit sur la page de devant. Objet simplifié, une micro-animation. Aucune figure, aucune marque tierce.
 * PUR : ni `remotion` ni React. Textes fournis par `textes` : [0] le titre de la page de devant, [1] sa barre.
 */
import { ajuster, sansBalises, type BoitePx } from "../../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { couleursDuFond, doux, famille, graisse, progres, type ProprietesObjet } from "./commun";
import { animDe, arrivee, type AvecAnim } from "./anim-objets";

export type TexteObjet = { texte: string; boite: BoitePx; taille: number; tient: boolean };

/** Instants (s depuis le début de l'écran) : les pages se déploient, la barre se remplit. */
export const TEMPS_RAPPORT = Object.freeze({ pages: 0.4, dureePages: 0.7, barre: 1.1, dureeBarre: 0.6 });
/** Part de la barre remplie à la fin. */
export const REMPLISSAGE_BARRE = 0.72;
/** Éventail : décalage (part de la largeur) et angle (degrés) des pages de derrière à la fin. */
const EVENTAIL = Object.freeze({ decalage: 0.1, angle: 7 });

function poser(texte: string | undefined, boite: BoitePx, voulue: number): TexteObjet | null {
  const t = sansBalises(texte ?? "").trim();
  if (!t) return null;
  const v = Math.min(voulue, boite.hauteur / 1.25);
  const r = ajuster(t, "inter-gras", v, boite.largeur, v * 0.6);
  return { texte: t, boite, taille: r.taille, tient: r.tient };
}

/** L7 · noms des animations 1 et 2 (planches). */
export const ANIMS_RAPPORT = Object.freeze(["", "pages empilées d'un côté", "page de devant qui monte, puis l'éventail"]);

export function planRapport(p: ProprietesObjet & AvecAnim, image?: number) {
  const n = animDe(p);
  return n ? planRapportAnime(p, image, n) : planRapportV4(p, image);
}

/** Le plan de la v4 (animation n° 0). */
function planRapportV4(p: ProprietesObjet, image?: number) {
  const { largeur: w, hauteur: h } = p.boite;
  const t = image === undefined ? p.t : image / 25;
  const c = couleursDuFond(p.fond);
  const x = doux(progres(t, TEMPS_RAPPORT.pages, TEMPS_RAPPORT.dureePages));
  const page: BoitePx = { x: w * 0.14, y: h * 0.06, largeur: w * 0.72, hauteur: h * 0.88 };
  // Pages de derrière (rang 0 = tout derrière) : elles s'écartent vers la gauche puis la droite.
  const pages = [-1, 1].map((sens, i) => ({
    index: i,
    boite: page,
    decalageX: sens * EVENTAIL.decalage * w * x,
    rotation: sens * EVENTAIL.angle * x,
    couleur: COULEURS_DUO.ivoire,
    lignes: [0.2, 0.34, 0.48].map((y) => ({ x: page.largeur * 0.12, y: page.hauteur * y, largeur: page.largeur * 0.7, hauteur: Math.max(3, page.hauteur * 0.02), couleur: COULEURS_DUO.grisClair })),
  }));
  const titre = poser(p.textes?.[0], { x: page.largeur * 0.1, y: page.hauteur * 0.07, largeur: page.largeur * 0.8, hauteur: page.hauteur * 0.1 }, page.hauteur * 0.07);
  const piste: BoitePx = { x: page.largeur * 0.1, y: page.hauteur * 0.62, largeur: page.largeur * 0.8, hauteur: page.hauteur * 0.07 };
  const remplie = progres(t, TEMPS_RAPPORT.barre, TEMPS_RAPPORT.dureeBarre);
  const etiquette = poser(p.textes?.[1], { x: piste.x, y: piste.y - page.hauteur * 0.09, largeur: piste.largeur, hauteur: page.hauteur * 0.07 }, page.hauteur * 0.05);
  return {
    boite: { x: 0, y: 0, largeur: w, hauteur: h },
    ombre: c.ombre,
    police: { famille: famille("inter-gras"), graisse: graisse("inter-gras"), couleur: COULEURS_DUO.encre },
    rayonPage: Math.min(w, h) * 0.04,
    pages,
    devant: {
      boite: page,
      couleur: COULEURS_DUO.blanc,
      titre,
      lignes: [0.22, 0.34, 0.46].map((y, i) => ({ x: page.largeur * 0.1, y: page.hauteur * y, largeur: page.largeur * (0.8 - 0.15 * i), hauteur: Math.max(3, page.hauteur * 0.02), couleur: COULEURS_DUO.grisClair })),
      etiquette,
      piste: { boite: piste, couleur: COULEURS_DUO.ivoire },
      barre: { x: piste.x, y: piste.y, largeur: piste.largeur * REMPLISSAGE_BARRE * doux(remplie), hauteur: piste.hauteur, couleur: COULEURS_DUO.orangeVif },
    },
    textes: [titre?.texte, etiquette?.texte].filter((x): x is string => !!x),
  };
}

/**
 * L7 · animations 1 et 2 (mêmes pages, même barre). 1 : les pages de derrière s'empilent du même côté, en escalier,
 * au lieu de s'ouvrir en éventail. 2 : la page de devant monte d'abord en place, puis l'éventail s'ouvre comme dans la v4.
 */
function planRapportAnime(p: ProprietesObjet, image: number | undefined, n: number) {
  const t = image === undefined ? p.t : image / 25;
  const v4 = planRapportV4(p, image);
  const anim = { numero: n, nom: ANIMS_RAPPORT[n]!, cochage: false };
  if (n === 1) {
    const x = doux(progres(t, TEMPS_RAPPORT.pages, TEMPS_RAPPORT.dureePages));
    // Rang 0 tout derrière : le plus décalé.
    const pages = v4.pages.map((pg, i) => ({ ...pg, decalageX: (2 - i) * 0.055 * v4.boite.largeur * x, rotation: (2 - i) * 3.5 * x }));
    return { ...v4, pages, anim };
  }
  return { ...v4, devant: { ...v4.devant, mouvement: arrivee(progres(t, 0.05, 0.35), { dy: v4.boite.hauteur * 0.2 }) }, anim };
}
