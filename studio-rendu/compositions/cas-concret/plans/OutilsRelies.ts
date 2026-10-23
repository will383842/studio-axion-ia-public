/**
 * PLAN de l'objet `outils-relies` (R5) : trois pastilles nommées, reliées par un fil qui se trace, et un point qui
 * y circule. Objet simplifié, une micro-animation. Aucune figure, aucune marque tierce : chaque
 * pastille porte un simple rond et le nom fourni.
 * PUR : ni `remotion` ni React. Textes fournis par `textes` : les noms des trois pastilles.
 */
import { ajuster, sansBalises, type BoitePx } from "../../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { c01, couleursDuFond, famille, graisse, planSurgir, progres, type ProprietesObjet } from "./commun";
import { animDe, arrivee, type AvecAnim } from "./anim-objets";

export type TexteObjet = { texte: string; boite: BoitePx; taille: number; tient: boolean };
export type Point = { x: number; y: number };

/** Instants (s depuis le début de l'écran) : première pastille, pas entre deux, fil, départ du point, durée d'un tour. */
export const TEMPS_OUTILS = Object.freeze({ premiere: 0.35, pas: 0.2, fil: 1.0, dureeFil: 0.5, point: 1.5, tour: 2.4 });

function poser(texte: string | undefined, boite: BoitePx, voulue: number): TexteObjet | null {
  const t = sansBalises(texte ?? "").trim();
  if (!t) return null;
  const v = Math.min(voulue, boite.hauteur / 1.25);
  const r = ajuster(t, "inter-gras", v, boite.largeur, v * 0.6);
  return { texte: t, boite, taille: r.taille, tient: r.tient };
}

/** Position d'un point à la fraction `f` (0 à 1) du contour fermé qui passe par `points`. */
export function surContour(points: readonly Point[], f: number): Point {
  const segments = points.map((a, i) => ({ a, b: points[(i + 1) % points.length] }));
  const longueurs = segments.map(({ a, b }) => Math.hypot(b.x - a.x, b.y - a.y));
  const total = longueurs.reduce((s, x) => s + x, 0);
  let reste = (((f % 1) + 1) % 1) * total;
  for (let i = 0; i < segments.length; i++) {
    if (reste <= longueurs[i] || i === segments.length - 1) {
      const k = longueurs[i] === 0 ? 0 : Math.min(1, reste / longueurs[i]);
      return { x: segments[i].a.x + (segments[i].b.x - segments[i].a.x) * k, y: segments[i].a.y + (segments[i].b.y - segments[i].a.y) * k };
    }
    reste -= longueurs[i];
  }
  return points[0];
}

/** L7 · noms des animations 1 et 2 (planches). */
export const ANIMS_OUTILS = Object.freeze(["", "pastilles glissées en alternance", "ordre inversé, point à rebours"]);

export function planOutilsRelies(p: ProprietesObjet & AvecAnim, image?: number) {
  const n = animDe(p);
  return n ? planOutilsAnime(p, image, n) : planOutilsV4(p, image);
}

/**
 * Le plan de la v4 (animation n° 0). L7 : `rang(i)` = rang d'arrivée de la pastille i (v4 : i) ; `sens` = sens du
 * point (v4 : 1).
 */
function planOutilsV4(p: ProprietesObjet, image?: number, rang: (i: number) => number = (i) => i, sens = 1) {
  const { largeur: w, hauteur: h } = p.boite;
  const t = image === undefined ? p.t : image / 25;
  const c = couleursDuFond(p.fond);
  const lp = w * 0.62;
  const hp = Math.min(h * 0.17, w * 0.2);
  const places: BoitePx[] = [
    { x: w * 0.02, y: h * 0.05, largeur: lp, hauteur: hp },
    { x: w * 0.36, y: h * 0.415, largeur: lp, hauteur: hp },
    { x: w * 0.02, y: h * 0.78, largeur: lp, hauteur: hp },
  ];
  const rond = hp * 0.46;
  const pastilles = places.map((boite, i) => {
    const s = planSurgir(progres(t, TEMPS_OUTILS.premiere + rang(i) * TEMPS_OUTILS.pas, 0.35));
    const zoneTexte: BoitePx = { x: boite.x + rond * 2, y: boite.y, largeur: boite.largeur - rond * 2.6, hauteur: boite.hauteur };
    return { index: i, boite, rond: { x: boite.x + rond * 0.7, y: boite.y + (boite.hauteur - rond) / 2, diametre: rond, couleur: i === 1 ? COULEURS_DUO.orangeVif : COULEURS_DUO.encre }, texte: poser(p.textes?.[i], zoneTexte, hp * 0.42), ...s };
  });
  // Le fil passe par le centre de chaque pastille et se referme : un triangle.
  const points: Point[] = places.map((b) => ({ x: b.x + b.largeur / 2, y: b.y + b.hauteur / 2 }));
  const trace = progres(t, TEMPS_OUTILS.fil, TEMPS_OUTILS.dureeFil);
  const phase = (t - TEMPS_OUTILS.point) / TEMPS_OUTILS.tour;
  const dot = surContour(points, sens * phase);
  return {
    boite: { x: 0, y: 0, largeur: w, hauteur: h },
    ombre: c.ombre,
    police: { famille: famille("inter-gras"), graisse: graisse("inter-gras"), couleur: COULEURS_DUO.encre },
    pastilles,
    rayonPastille: hp / 2,
    fil: { points, trace: c01(trace), epaisseur: Math.max(4, h * 0.012), couleur: COULEURS_DUO.orangeVif },
    point: { ...dot, visible: phase >= 0 && trace >= 1, diametre: Math.max(12, h * 0.045), couleur: COULEURS_DUO.orangeVif, halo: COULEURS_DUO.blanc },
    textes: pastilles.filter((x) => x.opacite > 0).map((x) => x.texte?.texte).filter((x): x is string => !!x),
  };
}

/**
 * L7 · animations 1 et 2 (mêmes pastilles, même fil). 1 : les pastilles glissent en place, alternativement de gauche
 * et de droite. 2 : elles surgissent du bas vers le haut, et le point fait le tour dans l'autre sens.
 */
function planOutilsAnime(p: ProprietesObjet, image: number | undefined, n: number) {
  const t = image === undefined ? p.t : image / 25;
  const anim = { numero: n, nom: ANIMS_OUTILS[n]!, cochage: false };
  if (n === 2) return { ...planOutilsV4(p, image, (i) => 2 - i, -1), anim };
  const v4 = planOutilsV4(p, image);
  const pastilles = v4.pastilles.map((q, i) => {
    const m = arrivee(progres(t, TEMPS_OUTILS.premiere + i * TEMPS_OUTILS.pas, 0.35), { dx: (i % 2 ? 1 : -1) * v4.boite.largeur * 0.2 });
    return { ...q, opacite: m.opacite, echelle: 1, rotation: 0, mouvement: { ...m, opacite: 1 } };
  });
  return { ...v4, pastilles, textes: pastilles.filter((x) => x.opacite > 0).map((x) => x.texte?.texte).filter((x): x is string => !!x), anim };
}
