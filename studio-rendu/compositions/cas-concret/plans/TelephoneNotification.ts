/**
 * PLAN DE L'OBJET `telephone-notification` (R3) : un téléphone à l'écran sombre, l'heure en grand, une notification
 * qui tombe en rebondissant pendant que le téléphone vibre (référence : bloc `s11`).
 * Textes : `textes[0]` = le sujet de la notification ; `textes[1]` (facultatif) = l'en-tête.
 * Moment : événement `notification` (sinon 0,7 s).
 *
 * PUR : ni `remotion` ni React. Le temps vient de `p.t`.
 */
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { ajuster, couperTexte, largeurTexte, sansBalises } from "../../../../src/briques/ecrans-motion";
import { c01, doux, famille, progres, rebond, teinte } from "./commun";
import { heureObjet, type ContexteObjet } from "./Objet";
import { cadreTelephone } from "./TelephoneCapture";
import { animDe, arrivee } from "./anim-objets";

/** En-tête de la notification quand l'objet n'en fournit pas. */
export const EN_TETE_NOTIFICATION = "Axion-IA · maintenant";
/** Heure affichée sur l'écran verrouillé. */
export const HEURE_TELEPHONE = "09:41";
/** Lignes du sujet au plus (il rétrécit avant de dépasser). */
const LIGNES_SUJET_MAX = 3;

/** L7 · noms des animations 1 et 2 (planches). */
export const ANIMS_TELEPHONE_NOTIFICATION = Object.freeze(["", "heure qui monte, carte glissée de côté", "écran qui s'allume, heure qui se pose"]);

/** Ce qui est visible du téléphone et de sa notification. */
export function planTelephoneNotification(p: ContexteObjet) {
  const n = animDe(p);
  return n ? planTelephoneNotificationAnime(p, n) : planTelephoneNotificationV4(p);
}

/** Le plan de la v4 (animation n° 0). */
function planTelephoneNotificationV4(p: ContexteObjet) {
  const cadre = cadreTelephone(p.boite, p.fond);
  const e = cadre.ecran;
  // Unité : 1 px de l'écran de la référence (442 px de large).
  const u = e.largeur / 442;
  const sujet = sansBalises(p.textes?.[0] ?? "");
  const enTete = sansBalises(p.textes?.[1] ?? EN_TETE_NOTIFICATION);

  const carte = { x: 18 * u, y: 350 * u, largeur: e.largeur - 36 * u };
  const marge = { x: 24 * u, y: 22 * u };
  const largeurTexteMax = carte.largeur - 2 * marge.x;
  const tailleEnTete = ajuster(enTete, "inter-gras", 22 * u, largeurTexteMax, 14 * u).taille;
  let tailleSujet = 30 * u;
  const plancherSujet = 18 * u;
  const lignes = (taille: number) => couperTexte(sujet, { police: "inter-gras", approche: 0, capitales: false }, taille, largeurTexteMax);
  while (tailleSujet > plancherSujet && (lignes(tailleSujet).length > LIGNES_SUJET_MAX || lignes(tailleSujet).some((l) => largeurTexte(l, "inter-gras", tailleSujet) > largeurTexteMax))) tailleSujet = Math.max(plancherSujet, tailleSujet - u);
  const lignesSujet = sujet ? lignes(tailleSujet) : [];
  const hauteurCarte = 2 * marge.y + tailleEnTete * 1.2 + 8 * u + lignesSujet.length * tailleSujet * 1.25;

  const depart = heureObjet(p, "notification", 0.7);
  const T = p.t - depart;
  const y = progres(T, 0, 0.3);
  const vibre = T > 0 ? Math.sin(T * 45) * 2.2 * (1 - progres(T, 0, 0.5)) : 0;
  const tailleHeure = ajuster(HEURE_TELEPHONE, "anton", 130 * u, e.largeur * 0.9, 40 * u, 2 / 130).taille;
  return {
    ...cadre,
    rotation: vibre,
    fondEcran: { haut: COULEURS_DUO.nuit, bas: COULEURS_DUO.nuitHaut },
    heure: { texte: HEURE_TELEPHONE, boite: { x: 0, y: 110 * u, largeur: e.largeur, hauteur: tailleHeure * 1.2 }, taille: tailleHeure, couleur: COULEURS_DUO.blanc, famille: famille("anton"), approcheEm: 2 / 130 },
    carte: {
      boite: { x: carte.x, y: carte.y, largeur: carte.largeur, hauteur: hauteurCarte },
      rayon: 30 * u,
      marge,
      fond: teinte(COULEURS_DUO.blanc, 0.94),
      opacite: c01(y * 3),
      decalageY: (1 - doux(y)) * -90 * u,
      echelle: 0.9 + 0.1 * rebond(y),
      enTete: { texte: enTete, taille: tailleEnTete, couleur: COULEURS_DUO.gris, famille: famille("inter-gras") },
      sujet: { texte: sujet, lignes: lignesSujet, taille: tailleSujet, largeurMax: largeurTexteMax, couleur: COULEURS_DUO.encre, famille: famille("inter-gras") },
    },
    depart,
  };
}

/**
 * L7 · animations 1 et 2 (même heure, même notification, même vibration). 1 : l'heure monte en place, puis la carte
 * glisse depuis la droite au lieu de tomber. 2 : l'écran s'allume, l'heure se pose en grandissant, puis la carte tombe
 * comme dans la v4.
 */
function planTelephoneNotificationAnime(p: ContexteObjet, n: number) {
  const v4 = planTelephoneNotificationV4(p);
  const u = v4.ecran.largeur / 442;
  const anim = { numero: n, nom: ANIMS_TELEPHONE_NOTIFICATION[n]!, cochage: false };
  if (n === 1) {
    const y = progres(p.t - v4.depart, 0, 0.35);
    // La carte arrive un peu réduite (85 %) et part d'aussi loin que le permettent ce retrait et sa marge : elle ne
    // touche jamais le bord de l'écran du téléphone.
    const reduite = 0.85;
    const depart = v4.carte.boite.x + (v4.carte.boite.largeur * (1 - reduite)) / 2;
    return {
      ...v4,
      heure: { ...v4.heure, mouvement: arrivee(progres(p.t, 0.05, 0.35), { dy: 40 * u }) },
      carte: { ...v4.carte, opacite: 1, decalageY: 0, echelle: 1, mouvement: arrivee(y, { dx: depart, echelle: reduite }) },
      anim,
    };
  }
  return {
    ...v4,
    allumage: arrivee(progres(p.t, 0, 0.35), {}),
    heure: { ...v4.heure, mouvement: arrivee(progres(p.t, 0.1, 0.35), { echelle: 0.85 }) },
    anim,
  };
}
