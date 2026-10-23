/**
 * PLAN de l'objet `carte-taches` (R5) : une carte de biais portant douze cases, dont trois passent à l'orange l'une
 * après l'autre. Objet simplifié, une micro-animation. Aucune figure, aucune marque tierce.
 * PUR : ni `remotion` ni React. Texte fourni par `textes` : [0] le titre de la carte (facultatif).
 */
import { ajuster, sansBalises, type BoitePx } from "../../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { couleursDuFond, famille, graisse, planSurgir, progres, teinte, type ProprietesObjet } from "./commun";
import { animDe, arrivee, surgie, type AvecAnim, type Mouvement } from "./anim-objets";

export type TexteObjet = { texte: string; boite: BoitePx; taille: number; tient: boolean };

/** Douze cases (quatre colonnes, trois rangées) ; les trois qui passent à l'orange, dans l'ordre. */
export const GRILLE_TACHES = Object.freeze({ colonnes: 4, rangees: 3, orange: [1, 6, 10] as readonly number[] });
/** Instants (s depuis le début de l'écran) : première case orange, pas entre deux cases, durée du passage. */
export const TEMPS_TACHES = Object.freeze({ premiere: 0.7, pas: 0.3, duree: 0.3 });

function poser(texte: string | undefined, boite: BoitePx, voulue: number): TexteObjet | null {
  const t = sansBalises(texte ?? "").trim();
  if (!t) return null;
  const v = Math.min(voulue, boite.hauteur / 1.25);
  const r = ajuster(t, "inter-gras", v, boite.largeur, v * 0.6);
  return { texte: t, boite, taille: r.taille, tient: r.tient };
}

/** L7 · noms des animations 1 et 2 (planches). */
export const ANIMS_TACHES = Object.freeze(["", "cases en cascade", "rangées glissées, ordre inversé"]);

export function planCarteTaches(p: ProprietesObjet & AvecAnim, image?: number) {
  const n = animDe(p);
  return n ? planCarteTachesAnime(p, image, n) : planCarteTachesV4(p, image, GRILLE_TACHES.orange);
}

/** Le plan de la v4 (animation n° 0) ; `orange` : les cases qui passent à l'orange, dans l'ordre. */
function planCarteTachesV4(p: ProprietesObjet, image: number | undefined, orange: readonly number[]) {
  const { largeur: w, hauteur: h } = p.boite;
  const t = image === undefined ? p.t : image / 25;
  const c = couleursDuFond(p.fond);
  const { colonnes, rangees } = GRILLE_TACHES;
  const marge = w * 0.07;
  const titre = poser(p.textes?.[0], { x: marge, y: h * 0.05, largeur: w - 2 * marge, hauteur: h * 0.14 }, h * 0.09);
  const haut = titre ? h * 0.24 : h * 0.07;
  const zone: BoitePx = { x: marge, y: haut, largeur: w - 2 * marge, hauteur: h - haut - h * 0.07 };
  const pas = { x: zone.largeur / colonnes, y: zone.hauteur / rangees };
  const cote = Math.min(pas.x, pas.y) * 0.8;
  const cases = Array.from({ length: colonnes * rangees }, (_, i) => {
    const rang = orange.indexOf(i);
    const x = rang < 0 ? 0 : progres(t, TEMPS_TACHES.premiere + rang * TEMPS_TACHES.pas, TEMPS_TACHES.duree);
    return {
      index: i,
      boite: { x: zone.x + (i % colonnes) * pas.x + (pas.x - cote) / 2, y: zone.y + Math.floor(i / colonnes) * pas.y + (pas.y - cote) / 2, largeur: cote, hauteur: cote } as BoitePx,
      orange: x,
      couleur: x > 0 ? teinte(COULEURS_DUO.orangeVif, x) : teinte(COULEURS_DUO.grisClair, 0.55),
      echelle: x > 0 && x < 1 ? planSurgir(x).echelle : 1,
    };
  });
  return {
    boite: { x: 0, y: 0, largeur: w, hauteur: h },
    rayon: Math.min(w, h) * 0.08,
    fiche: COULEURS_DUO.blanc,
    ombre: c.ombre,
    police: { famille: famille("inter-gras"), graisse: graisse("inter-gras"), couleur: COULEURS_DUO.encre },
    titre,
    rayonCase: cote * 0.24,
    cases,
    nombreOrange: cases.filter((x) => x.orange >= 1).length,
    textes: titre ? [titre.texte] : [],
  };
}

/**
 * L7 · animations 1 et 2 (les cases passent à l'orange une fois la grille immobile). 1 : les douze cases paraissent en
 * cascade, une à une. 2 : les trois rangées glissent depuis la droite l'une après l'autre, et les cases passent à
 * l'orange dans l'ordre inverse.
 */
function planCarteTachesAnime(p: ProprietesObjet, image: number | undefined, n: number) {
  const t = image === undefined ? p.t : image / 25;
  const orange = n === 1 ? GRILLE_TACHES.orange : [...GRILLE_TACHES.orange].reverse();
  const v4 = planCarteTachesV4(p, image, orange);
  const { colonnes } = GRILLE_TACHES;
  // Animation 2 : la rangée part d'aussi loin que le vide entre ses cases et le bord de la carte, jamais au-delà.
  const depart = v4.cases[0]!.boite.x;
  const mouvement = (i: number): Mouvement => (n === 1 ? surgie(progres(t, 0.06 + i * 0.03, 0.25)) : arrivee(progres(t, 0.1 + Math.floor(i / colonnes) * 0.12, 0.35), { dx: depart }));
  const cochage = orange.some((_, r) => {
    const x = progres(t, TEMPS_TACHES.premiere + r * TEMPS_TACHES.pas, TEMPS_TACHES.duree);
    return x > 0 && x < 1;
  });
  return { ...v4, cases: v4.cases.map((k) => ({ ...k, mouvement: mouvement(k.index) })), anim: { numero: n, nom: ANIMS_TACHES[n]!, cochage } };
}
