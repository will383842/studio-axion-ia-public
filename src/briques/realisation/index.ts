/**
 * BRIQUE RÉALISATION (plan facecam v4, lot B ; n° 18-19 ; catalogue des plans). PURE : aucun dépôt, aucun réseau.
 *
 * Une seule caméra, filmée à l'horizontale : le « multicaméra » se fait par recadrage de la source 4K.
 *  - cadre FIXE par plan (médiane du visage sur le plan, jamais de suivi qui flotte), recentré seulement aux coupes,
 *    avec une zone morte : un visage qui a bougé de moins de 3 % garde le cadre précédent de la même taille ;
 *  - yeux à 30-38 % de la hauteur de l'image (cible 34 %) ;
 *  - 3 tailles au plus : 100, 115 et 130 % (115 % au plus si le grain mesuré est fort) ;
 *  - chaque coupe de nettoyage change la taille d'au moins 12 % (alternance 100 / 115) ; même cadre toléré une fois
 *    sur 4, si le plan précédent est très court et que la tête bouge de moins de 3 % ;
 *  - rythme (Équilibré par défaut) : un changement toutes les 2 à 3 s, jamais plus de 6 s sans changement ; entre deux
 *    coupes trop éloignées, un PUNCH-IN instantané, posé au début d'un mot important ;
 *  - grammaire de montage (`grammaire.ts`) : coupes franches et punch-ins instantanés uniquement.
 * Temps : tout est rendu dans le temps du MONTAGE (après coupes), avec les bornes correspondantes dans la prise.
 */
import type { MotHorodate } from "@/domaine/types";
import { estMotOutil, estNombre } from "@/briques/sous-titres/typographie";
import { ecartTaillePct, GRAMMAIRE_MONTAGE, verifierGrammaire, type EcartGrammaire, type Raccord } from "./grammaire";
import { echantillonsEntre, mediane, visageA, type PisteVisage } from "./piste";

export * from "./grammaire";
export * from "./piste";
export * from "./zooms";

export const VERSION_BRIQUE_REALISATION = "realisation-1";

export type TaillePlan = 100 | 115 | 130;
export type Rythme = "sobre" | "equilibre" | "dynamique";

/** Intervalle entre deux changements visuels (s) : visé, et jamais au-delà de `max`. */
export const RYTHMES: Record<Rythme, { min: number; vise: number; max: number }> = {
  sobre: { min: 4, vise: 5, max: 6 },
  equilibre: { min: 2, vise: 2.5, max: 6 },
  dynamique: { min: 1.5, vise: 2, max: 4 },
};
/** Au-delà du visé, on cherche un mot où poser le changement jusqu'à cette borne (Équilibré : 3 s). */
const FENETRE_HAUTE: Record<Rythme, number> = { sobre: 6, equilibre: 3, dynamique: 2.5 };

export const YEUX_HAUTEUR = { min: 0.3, vise: 0.34, max: 0.38 };
const ZONE_MORTE = 0.03;

export interface Intervalle {
  debutSec: number;
  finSec: number;
}

export interface EntreeRealisation {
  /** Passages gardés de la prise, dans l'ordre (sortie de la brique coupes). */
  gardes: Intervalle[];
  /** Mots de la prise (temps de la prise) ; `enValeur` marque un mot important. */
  mots: MotHorodate[];
  /** Piste du visage ; absente : visage supposé centré, yeux à 34 %. */
  piste?: PisteVisage | null;
  /** Dimensions de la source préparée (après rotation). */
  source: { largeur: number; hauteur: number };
  /** Rapport largeur / hauteur de la sortie (9:16 par défaut). */
  ratioSortie?: number;
  rythme?: Rythme;
  /** Grain mesuré fort : 115 % au plus. */
  grainFort?: boolean;
}

export interface CadreSource {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export interface PlanCamera {
  /** Temps du montage. */
  debutSec: number;
  finSec: number;
  /** Bornes dans la prise d'origine. */
  priseDebutSec: number;
  priseFinSec: number;
  taille: TaillePlan;
  /** Fenêtre de recadrage dans la source préparée (pixels pairs). */
  cadre: CadreSource;
  /** Ce qui ouvre le plan : le début, une coupe de nettoyage, ou un punch-in (rythme). */
  ouverture: "debut" | "coupe" | "punch-in";
  /** Mot important qui déclenche le punch-in. */
  motCle?: string;
  /** Hauteur des yeux dans l'image finale (0-1). */
  yeuxHauteur: number;
  /** Plan serré posé par un zoom demandé au monteur (`zooms.ts`). */
  zoomDemande?: boolean;
}

export interface PlanRealisation {
  version: string;
  rythme: Rythme;
  plans: PlanCamera[];
  raccords: Raccord[];
  dureeSec: number;
}

const arrondi = (x: number) => +x.toFixed(3);
const pair = (x: number) => 2 * Math.round(x / 2);

/** Mot important : marqué `enValeur`, un nombre, ou un mot plein assez long (pas un mot outil). */
export function estMotImportant(m: MotHorodate): boolean {
  if (m.enValeur) return true;
  if (estNombre(m.mot)) return true;
  const nu = m.mot.replace(/[.,;:!?…«»"“”]/g, "");
  return nu.length >= 8 && !estMotOutil(m.mot);
}

/** Fenêtre de la sortie (taille 100 %) dans la source : le plus grand rectangle au ratio de sortie. */
export function fenetreBase(source: { largeur: number; hauteur: number }, ratio: number): { largeur: number; hauteur: number } {
  return source.largeur / source.hauteur > ratio ? { largeur: source.hauteur * ratio, hauteur: source.hauteur } : { largeur: source.largeur, hauteur: source.largeur / ratio };
}

/** Cadre d'une taille donnée, yeux visés à 34 % de la hauteur et centrés en largeur (bornés à la source). */
export function cadrePour(taille: TaillePlan, yeux: { yeuxX: number; yeuxY: number }, source: { largeur: number; hauteur: number }, ratio: number): { cadre: CadreSource; yeuxHauteur: number } {
  const base = fenetreBase(source, ratio);
  const largeur = pair(base.largeur / (taille / 100));
  const hauteur = pair(base.hauteur / (taille / 100));
  const borne = (v: number, max: number) => Math.min(Math.max(0, v), Math.max(0, max));
  const x = pair(borne(yeux.yeuxX * source.largeur - largeur / 2, source.largeur - largeur));
  const y = pair(borne(yeux.yeuxY * source.hauteur - YEUX_HAUTEUR.vise * hauteur, source.hauteur - hauteur));
  return { cadre: { x, y, largeur, hauteur }, yeuxHauteur: +((yeux.yeuxY * source.hauteur - y) / hauteur).toFixed(3) };
}

interface Changement {
  t: number;
  type: "coupe" | "punch-in";
  motCle?: string;
  important?: boolean;
}

/**
 * Pose les changements de plan : chaque coupe de nettoyage, puis des punch-ins là où l'intervalle dépasse la fenêtre
 * du rythme, au début d'un mot (important de préférence), jamais plus de `max` secondes sans changement.
 */
function poserChangements(coupes: number[], motsMontes: MotHorodate[], duree: number, rythme: Rythme): Changement[] {
  const r = RYTHMES[rythme];
  const haut = FENETRE_HAUTE[rythme];
  const changements: Changement[] = coupes.map((t) => ({ t, type: "coupe" }));
  const bornes = [0, ...coupes, duree];
  for (let k = 0; k + 1 < bornes.length; k++) {
    let dernier = bornes[k];
    const suivant = bornes[k + 1];
    while (suivant - dernier > haut + 1e-6) {
      // Pas trop près de la coupe suivante : on laisse au moins le minimum du rythme avant elle (ou on coupe en deux).
      const limite = Math.min(dernier + haut, Math.max(dernier + r.min, suivant - Math.min(r.min, (suivant - dernier) / 2)));
      const candidats = motsMontes.filter((m) => m.debutSec >= dernier + r.min - 1e-6 && m.debutSec <= limite + 1e-6 && m.debutSec < suivant - 0.5);
      const importants = candidats.filter(estMotImportant);
      const proche = (liste: MotHorodate[]) => [...liste].sort((a, b) => Math.abs(a.debutSec - (dernier + r.vise)) - Math.abs(b.debutSec - (dernier + r.vise)))[0];
      let choisi: MotHorodate | undefined = proche(importants) ?? proche(candidats);
      if (!choisi) {
        // Aucun mot dans la fenêtre : le premier début de mot avant la limite dure (6 s), sinon un instant fixe.
        choisi = motsMontes.find((m) => m.debutSec > dernier + r.min && m.debutSec <= dernier + r.max - 0.1 && m.debutSec < suivant - 0.5);
      }
      const t = choisi ? choisi.debutSec : Math.min(dernier + r.vise, suivant - 0.5);
      if (t <= dernier + 0.5) break;
      changements.push({ t, type: "punch-in", motCle: choisi?.mot, important: choisi ? estMotImportant(choisi) : false });
      dernier = t;
    }
  }
  return changements.sort((a, b) => a.t - b.t);
}

/** Taille du plan suivant : écart ≥ 12 % à chaque changement ; le punch-in sur un mot important monte au plus serré. */
function tailleSuivante(precedente: TaillePlan, ch: Changement, maxi: TaillePlan): TaillePlan {
  if (ch.type === "punch-in" && ch.important) return precedente === maxi ? 100 : maxi;
  if (precedente === 100) return 115;
  return 100;
}

export function realiser(e: EntreeRealisation): PlanRealisation {
  const rythme = e.rythme ?? "equilibre";
  const ratio = e.ratioSortie ?? 9 / 16;
  const maxi: TaillePlan = e.grainFort ? 115 : 130;
  const gardes = e.gardes.filter((g) => g.finSec > g.debutSec);
  // Temps du montage de chaque passage gardé.
  const segments: { prise: Intervalle; montage: Intervalle }[] = [];
  let cumul = 0;
  for (const g of gardes) {
    segments.push({ prise: g, montage: { debutSec: cumul, finSec: cumul + g.finSec - g.debutSec } });
    cumul += g.finSec - g.debutSec;
  }
  const duree = arrondi(cumul);
  if (!segments.length) return { version: VERSION_BRIQUE_REALISATION, rythme, plans: [], raccords: [], dureeSec: 0 };
  const versPrise = (t: number) => {
    const s = segments.find((x) => t <= x.montage.finSec + 1e-9) ?? segments[segments.length - 1];
    return s.prise.debutSec + Math.min(t, s.montage.finSec) - s.montage.debutSec;
  };
  const motsMontes: MotHorodate[] = [];
  for (const m of e.mots) {
    const s = segments.find((x) => m.debutSec >= x.prise.debutSec - 1e-6 && m.debutSec < x.prise.finSec);
    if (s) motsMontes.push({ ...m, debutSec: s.montage.debutSec + m.debutSec - s.prise.debutSec, finSec: s.montage.debutSec + Math.min(m.finSec, s.prise.finSec) - s.prise.debutSec });
  }
  const coupes = segments.slice(1).map((s) => s.montage.debutSec);
  const changements = poserChangements(coupes, motsMontes, duree, rythme);

  // Position du visage sur un plan (médiane des échantillons : cadre fixe).
  const visageSur = (priseDebut: number, priseFin: number) => {
    if (!e.piste) return { yeuxX: 0.5, yeuxY: YEUX_HAUTEUR.vise };
    const ech = echantillonsEntre(e.piste, priseDebut, priseFin);
    if (!ech.length) return { yeuxX: 0.5, yeuxY: YEUX_HAUTEUR.vise };
    return { yeuxX: mediane(ech.map((x) => x.yeuxX)), yeuxY: mediane(ech.map((x) => x.yeuxY)) };
  };
  const derniersCentres = new Map<TaillePlan, { yeuxX: number; yeuxY: number }>();
  const bornesPlans = [0, ...changements.map((c) => c.t), duree];
  const plans: PlanCamera[] = [];
  let memeCadreDepuis: number = GRAMMAIRE_MONTAGE.memeCadreUneFoisSur;
  for (let k = 0; k + 1 < bornesPlans.length; k++) {
    const debut = bornesPlans[k];
    const fin = bornesPlans[k + 1];
    if (fin - debut < 1e-3) continue;
    const ch = k > 0 ? changements[k - 1] : undefined;
    const precedent = plans[plans.length - 1];
    // Les bornes dans la prise (un plan ne chevauche jamais une coupe : les coupes sont des bornes).
    const priseDebut = versPrise(debut + 1e-6) - 1e-6;
    const priseFin = versPrise(fin);
    let visage = visageSur(priseDebut, priseFin);
    let taille: TaillePlan = 100;
    if (precedent && ch) {
      taille = tailleSuivante(precedent.taille, ch, maxi);
      // Même cadre toléré une fois sur 4 pour une coupe, si le plan précédent est très court et la tête quasi immobile.
      const fusionMax = Math.min(RYTHMES[rythme].max, FENETRE_HAUTE[rythme] + 1);
      if (ch.type === "coupe" && memeCadreDepuis >= GRAMMAIRE_MONTAGE.memeCadreUneFoisSur && precedent.finSec - precedent.debutSec < 1.2 && fin - precedent.debutSec <= fusionMax && e.piste) {
        const avant = visageA(e.piste, precedent.priseFinSec);
        const apres = visageA(e.piste, priseDebut);
        if (avant && apres && Math.hypot(apres.yeuxX - avant.yeuxX, apres.yeuxY - avant.yeuxY) * 100 < GRAMMAIRE_MONTAGE.memeCadreMouvementTetePctMax) {
          precedent.finSec = arrondi(fin);
          precedent.priseFinSec = arrondi(priseFin);
          memeCadreDepuis = 0;
          continue;
        }
      }
      memeCadreDepuis++;
    }
    // Zone morte : un visage qui a peu bougé garde le cadre précédent de la même taille.
    const dernier = derniersCentres.get(taille);
    if (dernier && Math.abs(dernier.yeuxX - visage.yeuxX) < ZONE_MORTE && Math.abs(dernier.yeuxY - visage.yeuxY) < ZONE_MORTE) visage = dernier;
    else derniersCentres.set(taille, visage);
    const { cadre, yeuxHauteur } = cadrePour(taille, visage, e.source, ratio);
    plans.push({
      debutSec: arrondi(debut),
      finSec: arrondi(fin),
      priseDebutSec: arrondi(priseDebut),
      priseFinSec: arrondi(priseFin),
      taille,
      cadre,
      ouverture: ch ? ch.type : "debut",
      ...(ch?.motCle ? { motCle: ch.motCle } : {}),
      yeuxHauteur,
    });
  }
  const raccords: Raccord[] = plans.slice(1).map((p) => ({ tSec: p.debutSec, type: p.ouverture === "punch-in" ? "punch-in" : "franche" }));
  return { version: VERSION_BRIQUE_REALISATION, rythme, plans, raccords, dureeSec: duree };
}

export interface ControleRealisation {
  /** Plans plus longs que le maximum du rythme. */
  plansTropLongs: number[];
  /** Changements de taille de moins de 12 % (hors « même cadre » toléré). */
  ecartsInsuffisants: number[];
  /** Yeux hors de la bande 30-38 % (cadre borné par la source). */
  yeuxHorsBande: number[];
  /** Intervalle moyen entre deux changements (s). */
  intervalleMoyenSec: number;
  grammaire: EcartGrammaire[];
}

export function controlerRealisation(p: PlanRealisation): ControleRealisation {
  const r = RYTHMES[p.rythme];
  const plans = p.plans;
  return {
    plansTropLongs: plans.flatMap((x, i) => (x.finSec - x.debutSec > r.max + 1e-6 ? [i] : [])),
    ecartsInsuffisants: plans.flatMap((x, i) => (i > 0 && ecartTaillePct(plans[i - 1].taille, x.taille) < GRAMMAIRE_MONTAGE.ecartTaillePctMin ? [i] : [])),
    yeuxHorsBande: plans.flatMap((x, i) => (x.yeuxHauteur < YEUX_HAUTEUR.min - 1e-3 || x.yeuxHauteur > YEUX_HAUTEUR.max + 1e-3 ? [i] : [])),
    intervalleMoyenSec: plans.length ? +(p.dureeSec / plans.length).toFixed(2) : 0,
    grammaire: verifierGrammaire({ raccords: p.raccords }),
  };
}
