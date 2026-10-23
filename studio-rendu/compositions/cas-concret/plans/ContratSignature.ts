/**
 * PLAN DE L'OBJET `contrat-signature` (R3) : une feuille blanche dont les lignes s'écrivent, puis une signature qui se
 * trace sur la ligne du bas (référence : bloc `s14`).
 * Moment de la signature : événement `signature` (sinon 0,9 s) ; tracé en 0,7 s après 0,15 s.
 *
 * PUR : ni `remotion` ni React. Le temps vient de `p.t`.
 */
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { couleursDuFond, doux, progres, teinte, va } from "./commun";
import { cadrer, heureObjet, type ContexteObjet } from "./Objet";
import { animDe, arrivee } from "./anim-objets";

/** Feuille de la référence : 620 × 800 px, marges de 60 px (haut) et 54 px (côtés). */
const FEUILLE = Object.freeze({ largeur: 620, hauteur: 800, haut: 60, cote: 54, rayon: 30 });
/** Longueur des lignes écrites (en % de la largeur utile), la première en orange et plus épaisse. */
export const LIGNES_CONTRAT = Object.freeze([55, 100, 92, 100, 84, 96, 100, 60]);
/** Tracé de la signature (cadre de 360 × 150), longueur ≈ 620. */
export const TRACE_SIGNATURE = "M10 110 C 40 20, 70 20, 80 90 S 120 140, 140 60 S 170 20, 190 95 S 240 120, 260 70 S 300 60, 350 85";
export const LONGUEUR_SIGNATURE = 620;

/** L7 · noms des animations 1 et 2 (planches). */
export const ANIMS_CONTRAT = Object.freeze(["", "feuille qui glisse, puis lignes", "lignes en fondu, du bas vers le haut"]);

/** Ce qui est visible du contrat. */
export function planContratSignature(p: ContexteObjet) {
  const n = animDe(p);
  return n ? planContratAnime(p, n) : planContratV4(p);
}

/** Le plan de la v4 (animation n° 0). */
function planContratV4(p: ContexteObjet) {
  const boite = cadrer(FEUILLE.largeur / FEUILLE.hauteur, p.boite);
  const k = boite.largeur / FEUILLE.largeur;
  const utile = (FEUILLE.largeur - 2 * FEUILLE.cote) * k;
  let y = FEUILLE.haut * k;
  const lignes = LIGNES_CONTRAT.map((pct, i) => {
    const h = (i ? 18 : 26) * k;
    const l = { x: FEUILLE.cote * k, y, largeur: (utile * pct * doux(progres(p.t, 0.25 + i * 0.05, 0.3))) / 100, hauteur: h, rayon: 9 * k, couleur: i ? teinte(COULEURS_DUO.grisClair, 0.6) : COULEURS_DUO.orange };
    y += h + 26 * k;
    return l;
  });
  const depart = heureObjet(p, "signature", 0.9);
  const trace = va(progres(p.t - depart, 0.15, 0.7));
  return {
    boite,
    k,
    feuille: { fond: COULEURS_DUO.blanc, rayon: FEUILLE.rayon * k, ombre: couleursDuFond(p.fond).ombre },
    lignes,
    signature: { boite: { x: 60 * k, y: boite.hauteur - (70 + 150) * k, largeur: 360 * k, hauteur: 150 * k }, chemin: TRACE_SIGNATURE, longueur: LONGUEUR_SIGNATURE, decalage: LONGUEUR_SIGNATURE * (1 - trace), trace, couleur: COULEURS_DUO.encre, epaisseur: 8, depart },
    base: { x: 60 * k, y: boite.hauteur - 60 * k - 3 * k, largeur: boite.largeur - (60 + 54) * k, hauteur: 3 * k, couleur: COULEURS_DUO.grisClair },
  };
}

/**
 * L7 · animations 1 et 2 (même feuille, même signature). 1 : la feuille glisse en place en se redressant, puis les
 * lignes s'écrivent. 2 : les lignes paraissent entières, en fondu, une à une, depuis la gauche et de la dernière à la première (l'ordre
 * inverse de la v4) ; puis la signature.
 */
function planContratAnime(p: ContexteObjet, n: number) {
  const anim = { numero: n, nom: ANIMS_CONTRAT[n]!, cochage: false };
  if (n === 1) {
    const v4 = planContratV4({ ...p, t: p.t - 0.1, evenements: [...(p.evenements ?? [])] });
    const vrai = planContratV4(p);
    return { ...v4, signature: vrai.signature, feuille: { ...v4.feuille, mouvement: arrivee(progres(p.t, 0, 0.35), { dy: v4.boite.hauteur * 0.12, rotation: 4 }) }, anim };
  }
  const v4 = planContratV4(p);
  const fin = planContratV4({ ...p, t: 99 });
  const utile = fin.lignes[1]!.largeur;
  const dernier = fin.lignes.length - 1;
  return { ...v4, lignes: fin.lignes.map((l, i) => ({ ...l, mouvement: arrivee(progres(p.t, 0.15 + (dernier - i) * 0.09, 0.3), { dx: -utile * 0.08 }) })), anim };
}
