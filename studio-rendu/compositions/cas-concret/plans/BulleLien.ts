/**
 * PLAN de l'objet `bulle-lien` (R4) : une bulle arrondie — pastille orange à maillon à gauche, texte du lien à droite,
 * ajusté pour tenir sur une ligne. Référence : `v8-a.html`, bloc `s21` (860 × 210). PUR : ni `remotion` ni React.
 */
import { ajuster, sansBalises } from "../../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { couleursDuFond, doux, famille, graisse, progres } from "./commun";
import { animDe, arrivee, surgie, type AvecAnim } from "./anim-objets";
import type { ProprietesBulle } from "./Lien";

/** Part de la largeur de la bulle laissée à gauche (pastille) et à droite (marge) du texte : même gabarit que `ecrans-motion`. */
export const RETRAITS_BULLE = Object.freeze({ gauche: 210 / 860, droite: 40 / 860 });
/** Taille du texte, en part de la hauteur de la bulle, quand l'écran ne la donne pas (42 / 210 dans la référence). */
const TAILLE_TEXTE = 0.2;
/** Le texte peut descendre jusqu'à 60 % de sa taille (42 → 26 px dans la référence). */
const PLANCHER_TEXTE = 0.6;

/** L7 · noms des animations 1 et 2 (planches). */
export const ANIMS_BULLE = Object.freeze(["", "pastille puis texte dévoilé", "bulle qui s'étire"]);

export function planBulleLien(p: ProprietesBulle & AvecAnim, image?: number) {
  const n = animDe(p);
  return n ? planBulleLienAnime(p, image, n) : planBulleLienV4(p, image);
}

/** Le plan de la v4 (animation n° 0). */
function planBulleLienV4(p: ProprietesBulle, image?: number) {
  void image;
  const { boite } = p;
  const h = boite.hauteur;
  const c = couleursDuFond(p.fond);
  const texte = sansBalises(p.textes?.[0] ?? "");
  const zoneTexte = {
    x: boite.largeur * RETRAITS_BULLE.gauche,
    y: 0,
    largeur: boite.largeur * (1 - RETRAITS_BULLE.gauche - RETRAITS_BULLE.droite),
    hauteur: h,
  };
  const voulue = p.tailleTexte ?? h * TAILLE_TEXTE;
  const taille = ajuster(texte, "inter-gras", voulue, zoneTexte.largeur, voulue * PLANCHER_TEXTE).taille;
  const rond = (150 / 210) * h;
  return {
    boite: { x: 0, y: 0, largeur: boite.largeur, hauteur: h },
    rayon: h / 2,
    fiche: COULEURS_DUO.blanc,
    ombre: c.ombre,
    pastille: {
      x: (30 / 210) * h,
      y: (30 / 210) * h,
      diametre: rond,
      couleur: COULEURS_DUO.orangeVif,
      /** Anneau blanc du maillon. */
      anneau: { x: (44 / 150) * rond, y: (44 / 150) * rond, diametre: (62 / 150) * rond, epaisseur: (12 / 150) * rond, couleur: COULEURS_DUO.blanc },
    },
    texte: {
      zone: zoneTexte,
      texte,
      taille,
      couleur: COULEURS_DUO.encre,
      famille: famille("inter-gras"),
      graisse: graisse("inter-gras"),
      tient: ajuster(texte, "inter-gras", taille, zoneTexte.largeur, taille).tient,
    },
    textes: texte ? [texte] : [],
  };
}

/**
 * L7 · animations 1 et 2 (la v4 est immobile : seule l'entrée du visuel la porte). 1 : la pastille surgit, puis le texte
 * se dévoile de gauche à droite. 2 : la bulle s'étire depuis la gauche, puis le texte paraît en glissant à peine.
 */
function planBulleLienAnime(p: ProprietesBulle, image: number | undefined, n: number) {
  const v4 = planBulleLienV4(p, image);
  const t = image === undefined ? p.t : image / 25;
  const anim = { numero: n, nom: ANIMS_BULLE[n]!, cochage: false };
  if (n === 1) return { ...v4, pastille: { ...v4.pastille, mouvement: surgie(progres(t, 0.1, 0.35)) }, texte: { ...v4.texte, revele: doux(progres(t, 0.35, 0.5)) }, anim };
  return {
    ...v4,
    mouvement: arrivee(progres(t, 0.05, 0.45), { echelleX: 0.3, origine: "0% 50%" }),
    texte: { ...v4.texte, mouvement: arrivee(progres(t, 0.45, 0.3), { dx: v4.boite.hauteur * 0.15 }) },
    anim,
  };
}
