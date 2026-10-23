/**
 * PLAN DE LA FIN (TB-15) : fonctions PURES, sans React. La phrase s'écrit ligne après ligne, puis le crayon COCHE
 * (geste signature). Sans son, sans sous-titres : rien dans la bande des sous-titres. Déterministe (aucun hasard,
 * aucune horloge). Tailles, polices et couleurs : seulement `charte-video/1`.
 * Valeurs supposées [à régler sur la première vidéo] : vitesse d'écriture, taille de la coche, pause finale.
 */
import { TAILLES_VIDEO } from "../../../../src/briques/habillage/charte-video";
import { APPROCHE_EM, INTERLIGNE } from "../../../../src/briques/motion/jetons";
import { COURBES_GESTES } from "../../../../src/briques/stylo/courbes";
import { largeurEcrite } from "../../../../src/briques/stylo/mesure-ecriture";
import type { Cible, Point } from "../../../../src/briques/stylo/types";

export const VERSION_FIN = "fin/1";
export const DUREE_FIN_MIN_MS = 3_000;
export const DUREE_FIN_MAX_MS = 4_000;

export interface RectPx {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

/** Propriétés de la composition de fin (un `type`, pas une `interface` : Remotion veut des propriétés indexables). */
export type ProprietesFin = {
  version: typeof VERSION_FIN;
  largeur: number;
  hauteur: number;
  fps: number;
  /** Identifiant du stylo (« crayon/1 »). */
  stylo: string;
  /** Durée de la fin (3 000 à 4 000 ms). */
  dureeMs: number;
  /** Phrase À L'ÉCRAN (≤ 8 mots), telle que la table des fins la donne. */
  phrase: string;
  /** Cadre d'écriture et bande des sous-titres (mise en page du tableau). */
  cadre: RectPx;
  bande: RectPx;
};

export const REGLAGES_FIN = Object.freeze({
  /** Départ de l'écriture (s). */
  departSec: 0.2,
  /** Une ligne de toute la largeur s'écrit en 0,9 s ; jamais moins de 0,4 s. */
  ligneSec: 0.9,
  ligneMinSec: 0.4,
  /** Déplacement du crayon d'une ligne à la suivante. */
  deplacementSec: 0.15,
  /** La coche (geste signature). */
  cocheSec: 0.6,
  /** Pause entre la dernière ligne et la coche. */
  pauseAvantCocheSec: 0.15,
  /** Immobilité finale minimale, coche visible. */
  tenueFinaleSec: 0.7,
  /** Coche : largeur et hauteur, en fraction de la largeur du cadre. */
  cocheLargeur: 0.2,
  cocheHauteur: 0.16,
  /** Écart entre la dernière ligne et la coche, en fraction de la hauteur de la coche. */
  ecartCoche: 0.25,
  hauteurStylo: 0.14,
  angleStylo: 145,
});

export interface LigneFin {
  texte: string;
  px: RectPx;
  debut: number;
  duree: number;
}

export interface PlanFin {
  images: number;
  fps: number;
  largeur: number;
  hauteur: number;
  taille: number;
  lignes: LigneFin[];
  coche: { cible: Cible; debut: number; duree: number };
  /** Tout le contenu (phrase, coche) tient dans cet espace, au-dessus de la bande des sous-titres. */
  fin: number;
  hauteurStylo: number;
}

export const imagesFin = (p: Pick<ProprietesFin, "dureeMs" | "fps">): number => Math.max(1, Math.round((p.dureeMs / 1000) * (p.fps || 25)));

/** Coupe la phrase en lignes qui tiennent dans `largeur` (glouton) ; null si un mot seul déborde. */
function couper(mots: string[], taille: number, largeur: number): string[] | null {
  const lignes: string[] = [];
  let courante = "";
  for (const m of mots) {
    const essai = courante ? `${courante} ${m}` : m;
    if (largeurEcrite(essai, "titre", taille, APPROCHE_EM.titre) <= largeur) courante = essai;
    else if (!courante) return null;
    else {
      lignes.push(courante);
      courante = m;
    }
  }
  if (courante) lignes.push(courante);
  return lignes;
}

/** Contrôle des propriétés : liste des problèmes (vide = valide). */
export function controlerFin(p: ProprietesFin): string[] {
  const pb: string[] = [];
  if (p.version !== VERSION_FIN) pb.push(`Fin · version « ${p.version} » inconnue (attendue : ${VERSION_FIN}).`);
  if (p.largeur !== 1080 || p.hauteur !== 1920) pb.push(`Fin · image ${p.largeur} × ${p.hauteur} au lieu de 1080 × 1920.`);
  if (p.fps !== 25) pb.push(`Fin · ${p.fps} images par seconde au lieu de 25.`);
  if (!(p.dureeMs >= DUREE_FIN_MIN_MS && p.dureeMs <= DUREE_FIN_MAX_MS)) pb.push(`Fin · durée ${p.dureeMs} ms hors de ${DUREE_FIN_MIN_MS}–${DUREE_FIN_MAX_MS} ms.`);
  const n = p.phrase.split(/\s+/).filter(Boolean).length;
  if (n === 0) pb.push("Fin · phrase vide.");
  if (n > 8) pb.push(`Fin · ${n} mots à l'écran (8 au plus).`);
  if (p.cadre.y + p.cadre.hauteur > p.bande.y) pb.push("Fin · le cadre d'écriture entre dans la bande des sous-titres.");
  return pb;
}

/** Plan complet de la fin. Lève une erreur claire si les propriétés sont invalides. */
export function planifierFin(p: ProprietesFin): PlanFin {
  const pb = controlerFin(p);
  if (pb.length) throw new Error(pb.join(" "));
  const R = REGLAGES_FIN;
  const mots = p.phrase.split(/\s+/).filter(Boolean);
  const cocheL = Math.round(p.cadre.largeur * R.cocheLargeur);
  const cocheH = Math.round(p.cadre.largeur * R.cocheHauteur);
  const ecart = Math.round(cocheH * R.ecartCoche);
  const espaceTexte = p.cadre.hauteur - cocheH - ecart;
  const maxi = Math.round(TAILLES_VIDEO.titre * p.hauteur);
  const mini = Math.round(TAILLES_VIDEO.legende * p.hauteur);
  let taille = maxi;
  let lignes: string[] | null = null;
  for (; taille >= mini; taille -= 2) {
    const l = couper(mots, taille, p.cadre.largeur);
    if (l && l.length * Math.round(taille * INTERLIGNE.titre) <= espaceTexte) {
      lignes = l;
      break;
    }
  }
  if (!lignes) throw new Error(`Fin · la phrase « ${p.phrase} » ne tient pas dans le cadre d'écriture.`);
  const pas = Math.round(taille * INTERLIGNE.titre);
  const hTexte = lignes.length * pas;
  // Le bloc (texte + coche) est centré dans le cadre, vers le haut (au-dessus de la bande des sous-titres).
  const haut = p.cadre.y + Math.max(0, Math.round((p.cadre.hauteur - hTexte - ecart - cocheH) / 2));
  // Durées : proportionnelles aux largeurs, réduites d'un même facteur si la fin est courte.
  const largeurs = lignes.map((t) => largeurEcrite(t, "titre", taille, APPROCHE_EM.titre));
  const brutes = largeurs.map((w) => Math.max(R.ligneMinSec, (w / p.cadre.largeur) * R.ligneSec));
  const total = p.dureeMs / 1000;
  const fixe = R.departSec + (lignes.length - 1) * R.deplacementSec + R.pauseAvantCocheSec + R.cocheSec + R.tenueFinaleSec;
  const dispo = Math.max(0.3, total - fixe);
  const somme = brutes.reduce((a, b) => a + b, 0);
  const k = Math.min(1, dispo / somme);
  let t = R.departSec;
  const posees: LigneFin[] = lignes.map((texte, i) => {
    const duree = brutes[i] * k;
    const l: LigneFin = { texte, px: { x: p.cadre.x, y: haut + i * pas, largeur: Math.ceil(largeurs[i]), hauteur: pas }, debut: t, duree };
    t += duree + R.deplacementSec;
    return l;
  });
  const debutCoche = t - R.deplacementSec + R.pauseAvantCocheSec;
  const cible: Cible = { x: p.cadre.x, y: haut + hTexte + ecart, largeur: cocheL, hauteur: cocheH };
  return {
    images: imagesFin(p),
    fps: p.fps,
    largeur: p.largeur,
    hauteur: p.hauteur,
    taille,
    lignes: posees,
    coche: { cible, debut: debutCoche, duree: R.cocheSec },
    fin: cible.y + cible.hauteur,
    hauteurStylo: Math.round(R.hauteurStylo * p.hauteur),
  };
}

/** Avancement (0 à 1) d'une action à l'instant `t`. */
export const avancementAction = (t: number, debut: number, duree: number): number => (duree <= 0 ? (t >= debut ? 1 : 0) : Math.min(1, Math.max(0, (t - debut) / duree)));

/** Cible d'écriture d'une ligne (la courbe « écrire » suit sa ligne de base). */
export const cibleLigne = (l: LigneFin): Cible => ({ x: l.px.x, y: l.px.y, largeur: l.px.largeur, hauteur: l.px.hauteur });

/**
 * Pointe du crayon à l'instant `t` : suit l'écriture, va d'une ligne à la suivante, puis trace la coche ; `null` avant
 * le départ et après la coche (le crayon se lève : la coche reste).
 */
export function pointeFin(plan: PlanFin, t: number): Point | null {
  const actions: { debut: number; duree: number; en: (u: number) => Point }[] = [
    ...plan.lignes.map((l) => ({ debut: l.debut, duree: l.duree, en: (u: number) => COURBES_GESTES.ecrire(u, cibleLigne(l)) })),
    { debut: plan.coche.debut, duree: plan.coche.duree, en: (u: number) => COURBES_GESTES.cocher(u, plan.coche.cible) },
  ];
  if (t < actions[0].debut) return null;
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    if (t <= a.debut + a.duree) return t >= a.debut ? a.en(avancementAction(t, a.debut, a.duree)) : mene(actions[i - 1].en(1), a.en(0), (t - (actions[i - 1].debut + actions[i - 1].duree)) / (a.debut - (actions[i - 1].debut + actions[i - 1].duree)));
  }
  return null;
}

const mene = (a: Point, b: Point, k: number): Point => ({ x: a.x + (b.x - a.x) * Math.min(1, Math.max(0, k)), y: a.y + (b.y - a.y) * Math.min(1, Math.max(0, k)) });
