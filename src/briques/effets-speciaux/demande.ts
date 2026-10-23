/**
 * DEMANDES DE RENDU DES EFFETS SPÉCIAUX (lot F3) : chaque effet devient une demande pour l'opération `composition`
 * EXISTANTE de `studio-rendu`, SANS mode (`parametres.composition` = l'identifiant, `parametres.proprietes` = les
 * poses ou la géométrie, `entrees` = la piste montée et, s'il le faut, la carte révélée). Aucun nouveau contrat,
 * aucune nouvelle file. Le MP4 produit se pose ensuite comme un plan d'illustration vidéo sur l'intervalle de
 * l'effet (`poserEffets`, même règle que les cartes plein écran : coupe franche à l'entrée et à la sortie, le son de
 * la piste continue dessous). PUR, sans alias « @/ ».
 */
import type { EchantillonVisage } from "../realisation/piste";
import { poserCartesPleinEcran, type CartePleinEcran } from "../motion/pose";
import type { PlanScene } from "../composition/scene";
import { lumiereParDefaut } from "./lumiere";
import { analyserMain, boiteVisageA, boiteVisagePx, posesObjetMain, type AnalyseMain, type EchantillonMainDetaille } from "./main";
import { bornerDureeTransition, pointHorsVisage } from "./transitions";
import type { BoitePx, CaracterePrise, CarteEnvironnement, FenetreSource, Lumiere, ObjetMain, PointPx, ProprietesEffetObjetMain, ProprietesEffetTransition, StyleTransition } from "./types";

/** Recadrage de la piste montée : une fenêtre constante, ou la fenêtre du plan à un instant du montage. */
export type CadreMontage = FenetreSource | ((monteeSec: number) => FenetreSource);
export const cadreA = (c: CadreMontage, monteeSec: number): FenetreSource => (typeof c === "function" ? c(monteeSec) : c);

export const COMPOSITION_OBJET_MAIN = "EffetObjetMain";
export const COMPOSITION_TRANSITION = "EffetTransition";
/** Plateau de démonstration (planche) : personne dessinée et main qui suit une piste simulée. */
export const COMPOSITION_PLATEAU_DEMO = "PlateauEffets";

export const FPS_EFFETS = 25;

/** Nom de l'entrée de la piste montée dans la demande (`entree:<nom>`). */
export const ENTREE_PISTE = "piste";
/** Nom de l'entrée de la carte révélée par une transition (`entree:<nom>`). */
export const ENTREE_CARTE = "carte";

export interface ParametresRenduEffet {
  composition: string;
  proprietes: ProprietesEffetObjetMain | ProprietesEffetTransition;
}

/* ------------------------------------------------------------------ */
/* Objet 3D dans la main                                               */
/* ------------------------------------------------------------------ */

export interface EntreeObjetMain {
  objet: ObjetMain;
  /** Passage demandé, en temps de la PRISE (ancre du passage). */
  debutPriseSec: number;
  finPriseSec: number;
  mains: EchantillonMainDetaille[] | undefined;
  visage?: EchantillonVisage[];
  /** Temps de la prise → temps du montage (et inverse), d'après les coupes actives. */
  priseVersMontee: (sec: number) => number;
  monteeVersPrise: (sec: number) => number;
  /** Fenêtre de la source montrée dans la piste montée (recadrage 9:16) : constante, ou selon le temps MONTÉ (plans). */
  cadre: CadreMontage;
  largeur: number;
  hauteur: number;
  lumiere?: Lumiere;
  luminanceVisage?: number;
  /** Nouvel essai demandé (« Réessayer ») : seuil assoupli. */
  reessai?: boolean;
  graine?: number;
  /** Référence de la piste montée (`entree:piste` par défaut). */
  source?: string;
  /** Lot I2 : reflets construits d'après l'image de la prise (`carteEnvironnement`). */
  environnement?: CarteEnvironnement;
  /** Lot I2 : flou et grain de la prise (`caracterePrise`). */
  prise?: CaracterePrise;
}

export type PreparationObjetMain =
  | { ok: true; parametres: ParametresRenduEffet; debutSec: number; finSec: number; analyse: Extract<AnalyseMain, { trouvee: true }> }
  | { ok: false; analyse: Extract<AnalyseMain, { trouvee: false }> };

/** Marge (s) gardée après la fermeture de la main pour la disparition de l'objet. */
const MARGE_FUITE_SEC = 0.36;

/**
 * Prépare le rendu de l'objet dans la main : analyse de la main sur le passage, poses image par image sur
 * l'intervalle MONTÉ (de l'ouverture de la main à sa fermeture, plus la disparition). Main introuvable ou trop brève :
 * `ok: false` (la vidéo sort sans l'effet, avec « Effet non réussi — Réessayer »).
 */
export function preparerObjetMain(e: EntreeObjetMain): PreparationObjetMain {
  // Format de la source vu par le recadrage (pixels carrés) : sert à lire l'orientation de la paume (lot I2).
  const c0 = cadreA(e.cadre, e.priseVersMontee(e.debutPriseSec));
  const largeurSurHauteur = e.largeur / c0.largeur / (e.hauteur / c0.hauteur);
  const analyse = analyserMain(e.mains, e.debutPriseSec, e.finPriseSec, { reessai: e.reessai, largeurSurHauteur });
  if (!analyse.trouvee) return { ok: false, analyse };
  const debutSec = Math.max(0, Math.floor(e.priseVersMontee(analyse.debutSec) * FPS_EFFETS) / FPS_EFFETS);
  const finSec = Math.ceil((e.priseVersMontee(analyse.finSec) + MARGE_FUITE_SEC) * FPS_EFFETS) / FPS_EFFETS;
  const images = Math.max(1, Math.round((finSec - debutSec) * FPS_EFFETS));
  const instantsPrise = Array.from({ length: images }, (_, i) => e.monteeVersPrise(debutSec + i / FPS_EFFETS));
  const cadres = Array.from({ length: images }, (_, i) => cadreA(e.cadre, debutSec + i / FPS_EFFETS));
  const poses = posesObjetMain({ main: analyse, instantsPrise, cadre: cadres, largeur: e.largeur, hauteur: e.hauteur, fps: FPS_EFFETS, visage: e.visage, objet: e.objet, graine: e.graine });
  return {
    ok: true,
    debutSec,
    finSec,
    analyse,
    parametres: {
      composition: COMPOSITION_OBJET_MAIN,
      proprietes: {
        largeur: e.largeur,
        hauteur: e.hauteur,
        fps: FPS_EFFETS,
        images,
        source: e.source ?? `entree:${ENTREE_PISTE}`,
        debutSourceImage: Math.round(debutSec * FPS_EFFETS),
        objet: e.objet,
        poses,
        lumiere: e.lumiere ?? lumiereParDefaut(e.luminanceVisage),
        ...(e.environnement ? { environnement: e.environnement } : {}),
        ...(e.prise ? { prise: e.prise } : {}),
      },
    },
  };
}

/* ------------------------------------------------------------------ */
/* Transitions                                                         */
/* ------------------------------------------------------------------ */

/** Une transition se cale sur un raccord du montage s'il en existe un à moins de 0,6 s (vrai « plan suivant »). */
export const CALAGE_RACCORD_SEC = 0.6;

export function calerSurRaccord(sec: number, raccordsSec: number[] = []): number {
  let meilleur = sec;
  let ecart = CALAGE_RACCORD_SEC + 1e-9;
  for (const r of raccordsSec) {
    if (Math.abs(r - sec) < ecart) {
      ecart = Math.abs(r - sec);
      meilleur = r;
    }
  }
  return meilleur;
}

export interface EntreeTransition {
  style: StyleTransition;
  /** Instant du mot (temps du MONTAGE) où l'image se brise. */
  auSec: number;
  dureeSec?: number | null;
  /** Raccords du montage (s) : la transition s'y cale s'il y en a un tout près. */
  raccordsSec?: number[];
  largeur: number;
  hauteur: number;
  /** Visage du plan révélé en px (piste montée), pour placer le point d'impact et dégager le visage. */
  visage?: BoitePx;
  /** Point souhaité (« depuis ma main », coin nommé), gardé s'il est hors du visage. */
  point?: PointPx;
  /** Révéler une carte (MP4 déjà rendu par la brique motion) plutôt que le plan suivant. */
  carte?: boolean;
  graine?: number;
  source?: string;
}

/**
 * Paramètres d'une transition : la composition couvre EXACTEMENT l'effet ([début, début + durée]) ; l'image figée
 * est la dernière image avant le mot, le plan révélé est la piste qui continue (ou la carte).
 */
export function preparerTransition(e: EntreeTransition): { parametres: ParametresRenduEffet; debutSec: number; finSec: number } {
  const dureeSec = bornerDureeTransition(e.dureeSec, e.style);
  const debutSec = Math.round(calerSurRaccord(e.auSec, e.raccordsSec) * FPS_EFFETS) / FPS_EFFETS;
  const images = Math.round(dureeSec * FPS_EFFETS);
  const debutImage = Math.round(debutSec * FPS_EFFETS);
  const source = e.source ?? `entree:${ENTREE_PISTE}`;
  const graine = e.graine ?? Math.round(debutSec * 1000) % 997;
  return {
    debutSec,
    finSec: debutSec + images / FPS_EFFETS,
    parametres: {
      composition: COMPOSITION_TRANSITION,
      proprietes: {
        largeur: e.largeur,
        hauteur: e.hauteur,
        fps: FPS_EFFETS,
        images,
        style: e.style,
        avant: { source, debutImage: Math.max(0, debutImage - 1) },
        apres: e.carte ? { source: `entree:${ENTREE_CARTE}`, debutImage: 0 } : { source, debutImage },
        debutEffetImage: 0,
        dureeEffetImages: images,
        point: pointHorsVisage(e.largeur, e.hauteur, e.visage, e.point, e.style),
        ...(e.visage ? { visageApres: e.visage } : {}),
        graine,
      },
    },
  };
}

/** Visage (px de la piste montée) à un instant de la prise, d'après la piste `/visages` et le recadrage. */
export function visagePx(visage: EchantillonVisage[] | undefined, tPriseSec: number, cadre: CadreMontage, largeur: number, hauteur: number, monteeSec = 0): BoitePx | undefined {
  const b = boiteVisageA(visage, tPriseSec);
  return b ? boiteVisagePx(b, cadreA(cadre, monteeSec), largeur, hauteur, 0) : undefined;
}

/* ------------------------------------------------------------------ */
/* Pose dans les plans                                                 */
/* ------------------------------------------------------------------ */

export interface EffetRendu {
  debutSec: number;
  finSec: number;
  /** Nom de l'entrée de la demande de composition finale qui porte le MP4 de l'effet. */
  entree: string;
}

/** Pose les effets rendus dans les plans de la composition (coupe franche autour ; même règle que les cartes). */
export function poserEffets(plans: PlanScene[], effets: EffetRendu[]): PlanScene[] {
  return poserCartesPleinEcran(plans, effets as CartePleinEcran[]);
}
