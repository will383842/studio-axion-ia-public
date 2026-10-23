/**
 * PLAN de l'objet « champ de saisie » (R4) : un champ de saisie arrondi — pastille ronde à gauche, mot orange tapé
 * lettre par lettre avec curseur clignotant, bouton d'envoi à droite. Référence : `v8-a.html`, bloc `s19` (800 × 260).
 * Aucune figure humaine : la pastille de gauche est un simple rond. PUR : ni `remotion` ni React.
 */
import { ajuster, enCapitales, sansBalises } from "../../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { couleursDuFond, famille, graisse, progres } from "./commun";
import { animDe, arrivee, bouger, surgie, type AvecAnim } from "./anim-objets";
import { curseurAllume, FRAPPE, lettresTapees, type ProprietesChamp } from "./AppelMot";

/** Part de la largeur du champ où commence le mot (après la pastille) : même gabarit que `ecrans-motion`. */
export const DEPART_MOT = 270 / 800;
/** Le mot s'étend jusqu'à cette distance (part de la hauteur du champ) avant le bouton d'envoi. */
const MARGE_BOUTON = 20 / 260;
/** Approche des lettres du mot (em). */
export const APPROCHE_MOT_EM = 0.055;
/** Taille du mot, en part de la hauteur du champ, quand l'écran ne l'a pas ajustée. */
const TAILLE_MOT = 0.69;
const PLANCHER_MOT = 0.35;

/** L7 · noms des animations 1 et 2 (planches). */
export const ANIMS_CHAMP = Object.freeze(["", "champ qui s'étire, puis frappe", "envoi qui pulse après la frappe"]);
/** L7 · grossissement du bouton d'envoi quand il bat (animation 2). */
export const BATTEMENT_ENVOI = 0.1;
/** L7 · retard de la frappe quand le champ s'étire d'abord (animation 1), en s. */
const RETARD_FRAPPE_ETIRE = 0.35;

export function planChampCommentaire(p: ProprietesChamp & AvecAnim, image?: number) {
  const n = animDe(p);
  return n ? planChampAnime(p, image, n) : planChampV4(p, image);
}

/** Le plan de la v4 (animation n° 0). */
function planChampV4(p: ProprietesChamp, image?: number) {
  const { boite } = p;
  const h = boite.hauteur;
  const t = image === undefined ? p.t : image / 25;
  const c = couleursDuFond(p.fond);
  const mot = enCapitales(sansBalises(p.textes?.[0] ?? ""));
  const bouton = (160 / 260) * h;
  const boutonDroite = (34 / 260) * h;
  const x = boite.largeur * DEPART_MOT;
  // Le mot a toute la place entre la pastille et le bouton d'envoi : un mot long y tient sans quitter le champ.
  const zoneTexte = { x, y: 0, largeur: Math.max(0, boite.largeur - boutonDroite - bouton - MARGE_BOUTON * h - x), hauteur: h };
  const voulue = p.tailleTexte ?? h * TAILLE_MOT;
  const taille = ajuster(mot, "anton", voulue, zoneTexte.largeur, p.plancherTexte ?? h * PLANCHER_MOT, APPROCHE_MOT_EM).taille;
  const debutFrappe = p.debutFrappeS ?? 0;
  const tape = [...mot].slice(0, lettresTapees(mot, t - debutFrappe)).join("");
  return {
    boite: { x: 0, y: 0, largeur: boite.largeur, hauteur: h },
    rayon: h / 2,
    fiche: COULEURS_DUO.blanc,
    ombre: c.ombre,
    pastille: { x: (34 / 260) * h, y: (40 / 260) * h, diametre: (180 / 260) * h, couleur: COULEURS_DUO.grisClair },
    texte: {
      zone: zoneTexte,
      taille,
      complet: mot,
      tape,
      curseur: curseurAllume(t),
      couleur: COULEURS_DUO.orange,
      famille: famille("anton"),
      graisse: graisse("anton"),
      approcheEm: APPROCHE_MOT_EM,
      tient: ajuster(mot, "anton", taille, zoneTexte.largeur, taille, APPROCHE_MOT_EM).tient,
      /** Épaisseur et hauteur du curseur (px). */
      curseurLargeur: Math.max(3, taille * 0.05),
      curseurHauteur: taille * 0.8,
      clignotementHz: FRAPPE.clignotementHz,
    },
    bouton: {
      droite: boutonDroite,
      y: (50 / 260) * h,
      diametre: bouton,
      couleur: COULEURS_DUO.orangeVif,
      triangle: { x: (58 / 160) * bouton, y: (46 / 160) * bouton, base: (34 / 160) * bouton, longueur: (56 / 160) * bouton, couleur: COULEURS_DUO.blanc },
    },
    textes: tape ? [tape] : [],
  };
}

/**
 * L7 · animations 1 et 2 (même mot, même frappe lettre par lettre). 1 : le champ s'étire depuis la gauche, la pastille
 * et le bouton surgissent, puis la frappe commence. 2 : la pastille glisse en place, la frappe est celle de la v4, et
 * le bouton d'envoi bat une fois quand le mot est complet.
 */
function planChampAnime(p: ProprietesChamp, image: number | undefined, n: number) {
  const t = image === undefined ? p.t : image / 25;
  const anim = { numero: n, nom: ANIMS_CHAMP[n]!, cochage: false };
  if (n === 1) {
    const v4 = planChampV4({ ...p, debutFrappeS: (p.debutFrappeS ?? 0) + RETARD_FRAPPE_ETIRE }, image);
    return {
      ...v4,
      mouvement: arrivee(progres(t, 0, 0.35), { echelleX: 0.4, origine: "0% 50%" }),
      pastille: { ...v4.pastille, mouvement: surgie(progres(t, 0.2, 0.3)) },
      bouton: { ...v4.bouton, mouvement: surgie(progres(t, 0.3, 0.3)) },
      anim,
    };
  }
  const v4 = planChampV4(p, image);
  const n0 = [...v4.texte.complet].length;
  const finFrappe = (p.debutFrappeS ?? 0) + (n0 ? n0 * Math.min(FRAPPE.pasS, FRAPPE.dureeMaxS / n0) : 0);
  // Le bouton bat depuis son bord gauche : il grandit vers la droite, jamais vers le mot (le vide avant lui reste).
  const e = 1 + BATTEMENT_ENVOI * Math.sin(Math.PI * progres(t, finFrappe + 0.1, 0.35));
  return {
    ...v4,
    pastille: { ...v4.pastille, mouvement: arrivee(progres(t, 0, 0.3), { dx: -v4.boite.hauteur * 0.4 }) },
    bouton: { ...v4.bouton, mouvement: bouger({ echelleX: e, echelleY: e, origine: "0% 50%" }) },
    anim,
  };
}
