/**
 * PLAN de l'objet `e-mail` (R5) : une enveloppe de biais dont le rabat s'ouvre, un message qui en sort avec son objet,
 * puis une coche. Objet simplifié, une micro-animation. Aucune figure, aucune marque tierce.
 * PUR : ni `remotion` ni React. Texte fourni par `textes` : [0] l'objet du message.
 */
import { couperTexte, largeurTexte, sansBalises, type BoitePx } from "../../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { couleursDuFond, doux, famille, graisse, planSurgir, progres, type ProprietesObjet } from "./commun";
import { animDe, arrivee, bouger, cocheTracee, type AvecAnim } from "./anim-objets";

export type TexteObjet = { texte: string; boite: BoitePx; taille: number; lignes: string[]; tient: boolean };

/** Instants (s depuis le début de l'écran) : le rabat s'ouvre, le message sort, la coche surgit. */
export const TEMPS_EMAIL = Object.freeze({ rabat: 0.5, dureeRabat: 0.4, message: 0.9, dureeMessage: 0.5, coche: 1.45, dureeCoche: 0.35 });

/** Pose un texte dans une boîte : sur `lignesMax` lignes au plus, à la taille voulue réduite (jusqu'à 60 %) pour qu'il tienne. */
function poser(texte: string | undefined, boite: BoitePx, voulue: number, lignesMax = 1): TexteObjet | null {
  const t = sansBalises(texte ?? "").trim();
  if (!t) return null;
  const interligne = 1.2;
  const reglage = { police: "inter-gras" as const, approche: 0, capitales: false };
  const tient = (s: number) => {
    const l = couperTexte(t, reglage, s, boite.largeur);
    return l.length <= lignesMax && l.length * s * interligne <= boite.hauteur + 0.01 && l.every((x) => largeurTexte(x, "inter-gras", s) <= boite.largeur);
  };
  const depart = Math.min(voulue, boite.hauteur / (interligne * lignesMax));
  let taille = depart;
  while (taille > depart * 0.6 && !tient(taille)) taille = Math.max(depart * 0.6, taille - 1);
  return { texte: t, boite, taille, lignes: couperTexte(t, reglage, taille, boite.largeur), tient: tient(taille) };
}

/** L7 · noms des animations 1 et 2 (planches). */
export const ANIMS_EMAIL = Object.freeze(["", "enveloppe qui glisse, coche dessinée", "ouverture vive, message qui se pose"]);
/** L7 · instants de l'animation 2 : rabat et message plus tôt, la coche à sa place. */
const TEMPS_EMAIL_VIF = Object.freeze({ ...TEMPS_EMAIL, rabat: 0.3, dureeRabat: 0.3, message: 0.6, dureeMessage: 0.45 });

export function planEMail(p: ProprietesObjet & AvecAnim, image?: number) {
  const n = animDe(p);
  return n ? planEMailAnime(p, image, n) : planEMailV4(p, image, TEMPS_EMAIL);
}

/** Le plan de la v4 (animation n° 0), aux instants donnés. */
function planEMailV4(p: ProprietesObjet, image: number | undefined, TEMPS_EMAIL: Readonly<Record<keyof typeof TEMPS_EMAIL_VIF, number>>) {
  const { largeur: w, hauteur: h } = p.boite;
  const t = image === undefined ? p.t : image / 25;
  const c = couleursDuFond(p.fond);
  const corps: BoitePx = { x: w * 0.04, y: h * 0.42, largeur: w * 0.92, hauteur: h * 0.54 };
  const ouverture = doux(progres(t, TEMPS_EMAIL.rabat, TEMPS_EMAIL.dureeRabat));
  const sortie = doux(progres(t, TEMPS_EMAIL.message, TEMPS_EMAIL.dureeMessage));
  const message: BoitePx = { x: w * 0.12, y: corps.y + corps.hauteur * 0.1 - h * 0.34 * sortie, largeur: w * 0.76, hauteur: h * 0.46 };
  const objet = poser(p.textes?.[0], { x: message.x + message.largeur * 0.08, y: message.y + message.hauteur * 0.1, largeur: message.largeur * 0.84, hauteur: message.hauteur * 0.3 }, message.hauteur * 0.15, 2);
  const coche = h * 0.2;
  return {
    boite: { x: 0, y: 0, largeur: w, hauteur: h },
    ombre: c.ombre,
    police: { famille: famille("inter-gras"), graisse: graisse("inter-gras"), couleur: COULEURS_DUO.encre },
    corps: { boite: corps, couleur: COULEURS_DUO.ivoire, rayon: Math.min(w, h) * 0.06 },
    /** Pochette de devant : couvre le bas du message tant qu'il est dans l'enveloppe. */
    pochette: { boite: { x: corps.x, y: corps.y + corps.hauteur * 0.42, largeur: corps.largeur, hauteur: corps.hauteur * 0.58 }, couleur: COULEURS_DUO.ivoireHaut, rayon: Math.min(w, h) * 0.06 },
    /** Rabat triangulaire, charnière sur le haut du corps : `echelleY` va de 1 (fermé) à -1 (ouvert). */
    rabat: { boite: { x: corps.x, y: corps.y, largeur: corps.largeur, hauteur: corps.hauteur * 0.55 }, echelleY: 1 - 2 * ouverture, couleur: COULEURS_DUO.grisClair },
    message: {
      boite: message,
      visible: sortie > 0,
      couleur: COULEURS_DUO.blanc,
      rayon: Math.min(w, h) * 0.04,
      objet,
      lignes: [0.56, 0.69, 0.82].map((y, i) => ({ x: message.x + message.largeur * 0.08, y: message.y + message.hauteur * y, largeur: message.largeur * (0.84 - 0.18 * i), hauteur: Math.max(3, message.hauteur * 0.04), couleur: COULEURS_DUO.grisClair })),
      sortie,
    },
    coche: { boite: { x: w * 0.94 - coche, y: h * 0.76 - coche / 2, largeur: coche, hauteur: coche }, ...planSurgir(progres(t, TEMPS_EMAIL.coche, TEMPS_EMAIL.dureeCoche)), couleur: COULEURS_DUO.vert, trait: COULEURS_DUO.blanc },
    textes: objet && sortie > 0 ? [objet.texte] : [],
  };
}

/**
 * L7 · animations 1 et 2 (même enveloppe, même message). 1 : l'enveloppe glisse depuis la gauche, s'ouvre comme dans
 * la v4, et la coche se dessine. 2 : le rabat s'ouvre plus tôt, le message sort et se pose d'un léger rebond avant
 * que la coche surgisse.
 */
function planEMailAnime(p: ProprietesObjet, image: number | undefined, n: number) {
  const t = image === undefined ? p.t : image / 25;
  if (n === 1) {
    const v4 = planEMailV4(p, image, TEMPS_EMAIL);
    const glisse = arrivee(progres(t, 0, 0.4), { dx: -v4.boite.largeur * 0.25 });
    const x = progres(t, TEMPS_EMAIL.coche, 0.45);
    const c = cocheTracee(x);
    return {
      ...v4,
      corps: { ...v4.corps, mouvement: glisse },
      pochette: { ...v4.pochette, mouvement: glisse },
      rabat: { ...v4.rabat, mouvement: glisse },
      coche: { ...v4.coche, opacite: c.opacite, echelle: c.echelle, rotation: c.rotation, trace: c.trace },
      anim: { numero: n, nom: ANIMS_EMAIL[n]!, cochage: x > 0 && x < 1 },
    };
  }
  const v4 = planEMailV4(p, image, TEMPS_EMAIL_VIF);
  const fin = TEMPS_EMAIL_VIF.message + TEMPS_EMAIL_VIF.dureeMessage;
  const y = progres(t, fin, 0.3);
  const pose = bouger({ dy: y > 0 && y < 1 ? -v4.boite.hauteur * 0.03 * Math.sin(Math.PI * y) : 0 });
  const x = progres(t, TEMPS_EMAIL.coche, TEMPS_EMAIL.dureeCoche);
  return { ...v4, message: { ...v4.message, mouvement: pose }, coche: { ...v4.coche, ...planSurgir(x) }, anim: { numero: n, nom: ANIMS_EMAIL[n]!, cochage: x > 0 && x < 1 } };
}
