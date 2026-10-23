/**
 * PLAN DE L'OBJET `dossier-classe` (R3) : une feuille descend dans un dossier orange, puis une coche verte surgit sur
 * le dossier (référence : bloc `s16`, « Dossier classé »).
 * Moment de la coche : événement `classe` (sinon 0,6 s).
 *
 * PUR : ni `remotion` ni React. Le temps vient de `p.t`.
 */
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { doux, planSurgir, progres, teinte } from "./commun";
import { cadrer, heureObjet, type ContexteObjet } from "./Objet";
import { animDe, arrivee, cocheTracee } from "./anim-objets";

/** Dossier de la référence : 600 × 640 px, avec 260 px au-dessus pour la feuille qui descend (cadre de 600 × 900). */
const DOSSIER = Object.freeze({ largeur: 600, hauteur: 900, haut: 260 });
/** Lignes écrites sur la feuille (en % de sa largeur utile), la première en orange. */
export const LIGNES_FEUILLE = Object.freeze([60, 100, 90, 96, 70]);
/** Descente de la feuille (px de la référence) : elle finit cachée par l'avant du dossier, sans dépasser le cadre. */
const DESCENTE = 340;

/** L7 · noms des animations 1 et 2 (planches). */
export const ANIMS_DOSSIER = Object.freeze(["", "feuille en deux temps, coche dessinée", "dossier qui monte, puis la feuille"]);

/** Ce qui est visible du dossier. */
export function planDossierClasse(p: ContexteObjet) {
  const n = animDe(p);
  return n ? planDossierAnime(p, n) : planDossierV4(p);
}

/** Le plan de la v4 (animation n° 0). */
function planDossierV4(p: ContexteObjet) {
  const boite = cadrer(DOSSIER.largeur / DOSSIER.hauteur, p.boite);
  const k = boite.largeur / DOSSIER.largeur;
  const h0 = DOSSIER.haut;
  const b = (x: number, y: number, largeur: number, hauteur: number) => ({ x: x * k, y: y * k, largeur: largeur * k, hauteur: hauteur * k });
  const descente = doux(progres(p.t, 0.2, 0.5));
  const depart = heureObjet(p, "classe", 0.6);
  return {
    boite,
    k,
    dos: { boite: b(0, h0 + 60, 600, 560), rayon: 36 * k, couleur: COULEURS_DUO.orange },
    onglet: { boite: b(0, h0, 260, 120), rayon: 30 * k, couleur: COULEURS_DUO.orange },
    feuille: {
      boite: b(80, 0, 440, 560),
      rayon: 22 * k,
      fond: COULEURS_DUO.blanc,
      decalageY: descente * DESCENTE * k,
      marge: { x: 36 * k, y: 40 * k },
      lignes: LIGNES_FEUILLE.map((pct, i) => ({ largeurPct: pct, hauteur: 18 * k, ecart: 26 * k, rayon: 9 * k, couleur: i ? teinte(COULEURS_DUO.grisClair, 0.6) : COULEURS_DUO.orange })),
    },
    avant: { boite: b(0, h0 + 210, 600, 430), rayon: 36 * k, haut: COULEURS_DUO.orangeVif, bas: COULEURS_DUO.orange, ombre: teinte(COULEURS_DUO.nuit, 0.25) },
    coche: { boite: b(210, h0 + 330, 180, 180), fond: COULEURS_DUO.blanc, trait: COULEURS_DUO.vert, epaisseur: 22 * k, depart, ...planSurgir(progres(p.t - depart, 0.05, 0.3)) },
  };
}

/**
 * L7 · animations 1 et 2 (la coche se pose une fois la feuille rangée). 1 : la feuille descend en deux temps (elle
 * marque une pause à mi-course), puis la coche se dessine. 2 : le dossier entier monte en place, puis la feuille y
 * descend et la coche surgit.
 */
function planDossierAnime(p: ContexteObjet, n: number) {
  const v4 = planDossierV4(p);
  const f = v4.feuille;
  // Course complète de la feuille (celle de la v4 une fois posée).
  const course = planDossierV4({ ...p, t: 99 }).feuille.decalageY;
  if (n === 1) {
    const descente = 0.45 * doux(progres(p.t, 0.15, 0.25)) + 0.55 * doux(progres(p.t, 0.5, 0.25));
    const x = progres(p.t, Math.max(v4.coche.depart, 0.6) + 0.25, 0.45);
    const c = cocheTracee(x);
    return { ...v4, feuille: { ...f, decalageY: descente * course }, coche: { ...v4.coche, opacite: c.opacite, echelle: c.echelle, rotation: c.rotation, trace: c.trace }, anim: { numero: n, nom: ANIMS_DOSSIER[n]!, cochage: x > 0 && x < 1 } };
  }
  const monte = arrivee(progres(p.t, 0, 0.3), { dy: v4.boite.hauteur * 0.1 });
  const descente = doux(progres(p.t, 0.3, 0.45));
  const x = progres(p.t - Math.max(v4.coche.depart, 0.8), 0.05, 0.3);
  return {
    ...v4,
    dos: { ...v4.dos, mouvement: monte },
    onglet: { ...v4.onglet, mouvement: monte },
    avant: { ...v4.avant, mouvement: monte },
    feuille: { ...f, decalageY: descente * course, mouvement: monte },
    coche: { ...v4.coche, ...planSurgir(x) },
    anim: { numero: n, nom: ANIMS_DOSSIER[n]!, cochage: x > 0 && x < 1 },
  };
}
