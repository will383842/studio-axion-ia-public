/**
 * Plan de l'objet `bouclier-coche` (R2) : une fiche blanche carrée aux angles très arrondis, un grand rond vert et sa
 * coche blanche qui surgit avec rebond (vidéo de référence, plan `s16b`). Repère local : origine au coin haut-gauche de
 * la boîte. PUR : ni `remotion` ni React.
 */
import type { BoitePx } from "../../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { instant, planSurgir, progres, type ProprietesObjet } from "./commun";
import { animDe, arrivee, cocheTracee, type AvecAnim } from "./anim-objets";

export type ProprietesBouclierCoche = ProprietesObjet & AvecAnim & {
  /** Heure (s depuis le début de l'écran) où la coche surgit ; par défaut 0,5 s. */
  debutCoche?: number;
};

export const DEBUT_COCHE_S = 0.5;
const DUREE_COCHE_S = 0.3;

/** L7 · noms des animations 1 et 2 (planches). */
export const ANIMS_BOUCLIER = Object.freeze(["", "coche qui se dessine", "fiche qui pivote puis coche"]);

export function planBouclierCoche(p: ProprietesBouclierCoche, image: number, fps = 25) {
  const n = animDe(p);
  return n ? planBouclierCocheAnime(p, image, fps, n) : planBouclierCocheV4(p, image, fps);
}

/** Le plan de la v4 (animation n° 0). */
function planBouclierCocheV4(p: ProprietesBouclierCoche, image: number, fps: number) {
  const t = instant(image, fps);
  const c = Math.min(p.boite.largeur, p.boite.hauteur);
  const x0 = (p.boite.largeur - c) / 2;
  const y0 = (p.boite.hauteur - c) / 2;
  const diametre = c * (260 / 400);
  const surgir = planSurgir(progres(t, p.debutCoche ?? DEBUT_COCHE_S, DUREE_COCHE_S));
  return {
    t,
    fiche: { boite: { x: x0, y: y0, largeur: c, hauteur: c } as BoitePx, rayon: c * (90 / 400), couleur: COULEURS_DUO.blanc },
    rond: { boite: { x: x0 + (c - diametre) / 2, y: y0 + (c - diametre) / 2, largeur: diametre, hauteur: diametre } as BoitePx, couleur: COULEURS_DUO.vert, opacite: surgir.opacite, echelle: surgir.echelle },
    coche: {
      /** Les deux côtés de la coche, dans le rond (bordure droite et basse, tournée de 45°). */
      boite: { x: diametre * (92 / 260), y: diametre * (44 / 260), largeur: diametre * (72 / 260), hauteur: diametre * (132 / 260) } as BoitePx,
      trait: diametre * (30 / 260),
      couleur: COULEURS_DUO.blanc,
    },
  };
}

/**
 * L7 · animations 1 et 2. 1 : le rond paraît en fondu et la coche se dessine (trait court puis long). 2 : la fiche
 * entre en pivotant légèrement, puis le rond surgit comme dans la v4 — une fois la fiche posée.
 */
function planBouclierCocheAnime(p: ProprietesBouclierCoche, image: number, fps: number, n: number) {
  const v4 = planBouclierCocheV4(p, image, fps);
  const t = v4.t;
  if (n === 1) {
    const x = progres(t, p.debutCoche ?? DEBUT_COCHE_S, 0.45);
    const c = cocheTracee(x);
    return { ...v4, rond: { ...v4.rond, opacite: c.opacite, echelle: c.echelle }, coche: { ...v4.coche, trace: c.trace }, anim: { numero: n, nom: ANIMS_BOUCLIER[n]!, cochage: x > 0 && x < 1 } };
  }
  const fiche = arrivee(progres(t, 0, 0.4), { rotation: -8, echelle: 0.86 });
  const debut = Math.max(p.debutCoche ?? DEBUT_COCHE_S, 0.45);
  const x = progres(t, debut, DUREE_COCHE_S);
  const s = planSurgir(x);
  return { ...v4, fiche: { ...v4.fiche, mouvement: fiche }, rond: { ...v4.rond, opacite: s.opacite, echelle: s.echelle }, anim: { numero: n, nom: ANIMS_BOUCLIER[n]!, cochage: x > 0 && x < 1 } };
}
