/**
 * PLAN DE L'OBJET `pile-notifications` (R3) : des notifications d'e-mail qui montent l'une après l'autre, chacune
 * cochée en vert (référence : bloc `s9`). Une carte par texte de `textes` (le sujet), deux sans texte.
 * Moments : événements `notification-1`, `notification-2`… (sinon 0,25 s puis toutes les 0,6 s).
 *
 * PUR : ni `remotion` ni React. Le temps vient de `p.t`.
 */
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { ajuster, sansBalises } from "../../../../src/briques/ecrans-motion";
import { c01, couleursDuFond, doux, famille, planSurgir, progres } from "./commun";
import { cadrer, heureObjet, type ContexteObjet } from "./Objet";
import { animDe, arrivee, cocheTracee } from "./anim-objets";

/** Expéditeur écrit sur chaque notification. */
export const EXPEDITEUR = "Axion-IA";
/** Lettre de l'icône. */
export const LETTRE_ICONE = "A";
/** Cartes de la référence : 900 × 190 px, 40 px d'écart. */
const CARTE = Object.freeze({ largeur: 900, hauteur: 190, ecart: 40 });

/** L7 · noms des animations 1 et 2 (planches). */
export const ANIMS_PILE = Object.freeze(["", "cartes glissées de côté", "cartes posées d'en haut, coches dessinées"]);
/** L7 · coche d'une carte (s depuis son arrivée) : une fois la carte posée, finie avant l'arrivée de la suivante. */
const COCHE_PILE = Object.freeze({ debut: 0.3, duree: 0.24 });

/** Ce qui est visible de la pile. */
export function planPileNotifications(p: ContexteObjet) {
  const n = animDe(p);
  return n ? planPileAnime(p, n) : planPileV4(p);
}

/** Le plan de la v4 (animation n° 0). */
function planPileV4(p: ContexteObjet) {
  const sujets = (p.textes && p.textes.length ? p.textes : ["", ""]).map(sansBalises);
  const n = sujets.length;
  const ratio = CARTE.largeur / (n * CARTE.hauteur + (n - 1) * CARTE.ecart);
  const zone = cadrer(ratio, p.boite);
  const k = zone.largeur / CARTE.largeur;
  const largeurSujet = (CARTE.largeur - 160 - 120) * k;
  const cartes = sujets.map((sujet, i) => {
    const depart = heureObjet(p, `notification-${i + 1}`, 0.25 + i * 0.6);
    const T = p.t - depart;
    const x = progres(T, -0.05, 0.34);
    const tailleSujet = sujet ? ajuster(sujet, "inter-gras", 42 * k, largeurSujet, 42 * k * 0.6).taille : 42 * k;
    return {
      depart,
      boite: { x: zone.x, y: zone.y + i * (CARTE.hauteur + CARTE.ecart) * k, largeur: zone.largeur, hauteur: CARTE.hauteur * k },
      rayon: 36 * k,
      fond: COULEURS_DUO.blanc,
      opacite: c01(x * 2.5),
      decalageY: (1 - doux(x)) * 120 * k,
      echelle: 0.92 + 0.08 * doux(x),
      icone: { boite: { x: 34 * k, y: 40 * k, largeur: 100 * k, hauteur: 100 * k }, rayon: 26 * k, fond: COULEURS_DUO.orange, lettre: LETTRE_ICONE, taille: 64 * k, couleur: COULEURS_DUO.blanc, famille: famille("anton") },
      expediteur: { texte: EXPEDITEUR, boite: { x: 160 * k, y: 34 * k, largeur: largeurSujet, hauteur: 30 * k * 1.2 }, taille: 30 * k, couleur: COULEURS_DUO.gris, famille: famille("inter-gras") },
      sujet: { texte: sujet, boite: { x: 160 * k, y: (34 + 36 + 10) * k, largeur: largeurSujet, hauteur: 42 * k * 1.2 }, taille: tailleSujet, couleur: COULEURS_DUO.encre, famille: famille("inter-gras"), barre: sujet ? null : { largeur: largeurSujet * 0.7, hauteur: 18 * k, couleur: COULEURS_DUO.grisClair } },
      coche: { boite: { x: (CARTE.largeur - 30 - 66) * k, y: 62 * k, largeur: 66 * k, hauteur: 66 * k }, fond: COULEURS_DUO.vert, trait: COULEURS_DUO.blanc, epaisseur: 7 * k, ...planSurgir(progres(T, 0.35, 0.28)) },
    };
  });
  return { zone, k, cartes, ombre: couleursDuFond(p.fond).ombre };
}

/**
 * L7 · animations 1 et 2 (mêmes cartes, mêmes instants d'arrivée). 1 : chaque carte glisse depuis la droite, puis sa
 * coche surgit. 2 : chaque carte se pose d'en haut, puis sa coche se dessine. La coche se pose quand la carte est
 * immobile.
 */
function planPileAnime(p: ContexteObjet, n: number) {
  const v4 = planPileV4(p);
  let cochage = false;
  const cartes = v4.cartes.map((c) => {
    const T = p.t - c.depart;
    const x = progres(T, -0.05, 0.34);
    const mouvement = arrivee(x, n === 1 ? { dx: v4.zone.largeur * 0.25 } : { dy: -c.boite.hauteur * 0.6 });
    const y = progres(T, COCHE_PILE.debut, COCHE_PILE.duree);
    if (y > 0 && y < 1) cochage = true;
    const coche = n === 1 ? { ...c.coche, ...planSurgir(y) } : (() => {
      const k = cocheTracee(y);
      return { ...c.coche, opacite: k.opacite, echelle: k.echelle, rotation: k.rotation, trace: k.trace };
    })();
    return { ...c, opacite: 1, decalageY: 0, echelle: 1, mouvement, coche };
  });
  return { ...v4, cartes, anim: { numero: n, nom: ANIMS_PILE[n]!, cochage } };
}
