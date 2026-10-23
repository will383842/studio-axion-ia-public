/**
 * GROUPEMENT DES MOTS EN SOUS-TITRES (B.5). PUR.
 * - une ligne de 2 à 4 mots (selon le style de base) ; un mot seul seulement pour un mot en valeur ou un montant ;
 * - affichage de 0,4 à 0,9 s, cible 0,6 s ; un groupe de moins de 200 ms est fusionné avec le suivant ;
 * - jamais de mot outil seul en fin de groupe ; nombres et montants insécables (« 67 000 € » reste groupé) ;
 * - rien pendant un blanc ; une ligne ne dépasse jamais la largeur libre (mesure réelle) ;
 * - calage sur les coupes de plan : une limite à moins de 0,2 s d'une coupe est recalée sur la coupe.
 */
import type { MotHorodate, SegmentSousTitres } from "@/domaine/types";
import { estFinPhrase, estMotOutil, estNombre, estPause, estTrancheMilliers, estUnite } from "./typographie";

export interface OptionsGroupement {
  motsMin: number;
  motsMax: number;
  dureeMinSec: number;
  dureeMaxSec: number;
  dureeCibleSec: number;
  /** Un groupe affiché moins longtemps est fusionné avec le suivant. */
  fusionSec: number;
  /** Au-delà de ce blanc entre deux mots, rien n'est affiché. */
  blancSec: number;
  /** Largeur libre et mesure réelle d'une ligne (px) ; absentes : pas de contrôle de largeur. */
  largeurMaxPx?: number;
  mesurer?: (mots: string[]) => number;
}

export const GROUPEMENT_PAR_DEFAUT: OptionsGroupement = {
  motsMin: 2,
  motsMax: 4,
  dureeMinSec: 0.4,
  dureeMaxSec: 0.9,
  dureeCibleSec: 0.6,
  fusionSec: 0.2,
  blancSec: 0.3,
};

/** Unité insécable : un mot, ou un nombre avec ses tranches de milliers et son unité. */
export interface Unite {
  mots: MotHorodate[];
  /** Index du premier mot dans la liste d'entrée. */
  index: number;
  debutSec: number;
  finSec: number;
  montant: boolean;
  valeur: boolean;
  outil: boolean;
  finPhrase: boolean;
  pause: boolean;
}

/** Regroupe les nombres et montants en unités insécables. */
export function unitesDe(mots: MotHorodate[]): Unite[] {
  const unites: Unite[] = [];
  for (let i = 0; i < mots.length; i++) {
    const index = i;
    const bloc = [mots[i]];
    if (estNombre(mots[i].mot)) {
      while (i + 1 < mots.length && !estFinPhrase(bloc.at(-1)!.mot) && estTrancheMilliers(mots[i + 1].mot)) bloc.push(mots[++i]);
      if (i + 1 < mots.length && !estFinPhrase(bloc.at(-1)!.mot) && estUnite(mots[i + 1].mot)) bloc.push(mots[++i]);
    }
    const dernier = bloc.at(-1)!.mot;
    unites.push({
      mots: bloc,
      index,
      debutSec: bloc[0].debutSec,
      finSec: bloc.at(-1)!.finSec,
      montant: estNombre(bloc[0].mot),
      valeur: bloc.some((m) => m.enValeur),
      outil: bloc.length === 1 && estMotOutil(dernier),
      finPhrase: estFinPhrase(dernier),
      pause: estPause(dernier),
    });
  }
  return unites;
}

const texteDe = (g: Unite[]) => g.flatMap((u) => u.mots.map((m) => m.mot));
/** Nombre de mots affichés : « 67 000 € » compte pour deux (le nombre et son unité). */
export const poids = (g: Unite[]) => g.reduce((n, u) => n + (u.montant ? Math.min(2, u.mots.length) : 1), 0);
const debut = (g: Unite[]) => g[0].debutSec;
const fin = (g: Unite[]) => g[g.length - 1].finSec;

/** Le groupe tient-il dans la largeur libre ? */
function tient(g: Unite[], o: OptionsGroupement): boolean {
  return !o.largeurMaxPx || !o.mesurer || o.mesurer(texteDe(g)) <= o.largeurMaxPx;
}

/**
 * Coût d'un groupe (plus il est bas, mieux c'est). Contraintes DURES : nombre de mots et largeur (un mot seul trop
 * large est admis, il sera rendu plus petit). Le reste est pondéré : mot outil en fin de ligne, mot ordinaire seul,
 * fin de phrase au milieu d'une ligne, écart à la durée cible, virgule au milieu.
 */
function cout(g: Unite[], dernierDuMorceau: boolean, o: OptionsGroupement): number {
  const p = poids(g);
  if (p > o.motsMax && g.length > 1) return Infinity;
  if (g.length > 1 && !tient(g, o)) return Infinity;
  const duree = fin(g) - debut(g);
  let c = 0;
  const dernier = g[g.length - 1];
  // Ordre des priorités : jamais de mot outil en fin de ligne > jamais deux phrases sur une ligne > pas de mot seul.
  if (dernier.outil && !dernierDuMorceau) c += 200;
  if (g.length === 1 && !dernier.valeur && !dernier.montant) c += 80;
  else if (p < o.motsMin && !dernier.valeur && !dernier.montant) c += 25;
  for (let k = 0; k < g.length - 1; k++) {
    if (g[k].finPhrase) c += 150;
    else if (g[k].pause) c += 8;
  }
  if (dernier.pause || dernier.finPhrase) c -= 3;
  c += 12 * Math.abs(duree - o.dureeCibleSec);
  if (duree > o.dureeMaxSec) c += 30 * (duree - o.dureeMaxSec);
  if (duree < o.fusionSec) c += 40;
  else if (duree < o.dureeMinSec) c += 10 * (o.dureeMinSec - duree) * 10;
  return c + 1;
}

/** Découpe optimale d'un morceau sans blanc (programmation dynamique sur les coûts). */
function decouperMorceau(unites: Unite[], o: OptionsGroupement): Unite[][] {
  const n = unites.length;
  const meilleur: number[] = new Array(n + 1).fill(Infinity);
  const precedent: number[] = new Array(n + 1).fill(-1);
  meilleur[0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = Math.max(0, i - (o.motsMax + 1)); j < i; j++) {
      if (meilleur[j] === Infinity) continue;
      const c = meilleur[j] + cout(unites.slice(j, i), i === n, o);
      if (c < meilleur[i]) {
        meilleur[i] = c;
        precedent[i] = j;
      }
    }
  }
  const groupes: Unite[][] = [];
  for (let i = n; i > 0; i = precedent[i]) groupes.unshift(unites.slice(precedent[i], i));
  return groupes;
}

/**
 * Groupes d'unités (avant minutage), règles typographiques appliquées. Le texte est coupé en morceaux aux BLANCS
 * (rien n'est affiché pendant un blanc), puis chaque morceau est découpé au mieux.
 */
export function grouperUnites(mots: MotHorodate[], options: Partial<OptionsGroupement> = {}): Unite[][] {
  const o = { ...GROUPEMENT_PAR_DEFAUT, ...options };
  const unites = unitesDe(mots);
  const morceaux: Unite[][] = [];
  for (const u of unites) {
    const m = morceaux[morceaux.length - 1];
    if (m && u.debutSec - m[m.length - 1].finSec <= o.blancSec) m.push(u);
    else morceaux.push([u]);
  }
  return morceaux.flatMap((m) => decouperMorceau(m, o));
}

/**
 * Minutage : un groupe commence avec son premier mot. Il reste affiché jusqu'au groupe suivant quand la parole
 * continue ; après un blanc, il ne dépasse pas son dernier mot (ou sa durée minimale de lecture).
 */
export function grouperMots(mots: MotHorodate[], options: Partial<OptionsGroupement> = {}): SegmentSousTitres[] {
  const o = { ...GROUPEMENT_PAR_DEFAUT, ...options };
  const groupes = grouperUnites(mots, o);
  return groupes.map((g, i) => {
    const d = debut(g);
    const naturelle = fin(g);
    const suivant = groupes[i + 1] ? debut(groupes[i + 1]) : Infinity;
    const finSec = suivant - naturelle <= o.blancSec ? suivant : Math.min(suivant, Math.max(naturelle, d + o.dureeMinSec));
    return { id: `st-${g[0].index}`, debutSec: arrondi(d), finSec: arrondi(finSec === Infinity ? Math.max(naturelle, d + o.dureeMinSec) : finSec), mots: g.flatMap((u) => u.mots) };
  });
}

function arrondi(s: number): number {
  return Math.round(s * 1000) / 1000;
}

/**
 * CALAGE SUR LES COUPES (B.5, v3.2, guide de minutage Netflix) : une limite de groupe à moins de `fenetreSec`
 * (0,2 s = 5 images à 25 i/s) d'une coupe de plan est recalée sur la coupe, si chaque groupe reste ≥ `dureeMinSec`.
 */
export function recalerSurCoupes(segments: SegmentSousTitres[], coupesSec: number[], options: { fenetreSec?: number; dureeMinSec?: number } = {}): SegmentSousTitres[] {
  const fenetre = options.fenetreSec ?? 0.2;
  const min = options.dureeMinSec ?? 0.4;
  const s = segments.map((x) => ({ ...x }));
  const coupes = [...coupesSec].filter((c) => c > 0).sort((a, b) => a - b);
  const proche = (t: number) => coupes.find((c) => Math.abs(c - t) < fenetre && Math.abs(c - t) > 1e-6);
  for (let i = 0; i < s.length; i++) {
    const a = s[i];
    const b = s[i + 1];
    if (b && Math.abs(a.finSec - b.debutSec) < 1e-6) {
      // Limite commune : déplacée ensemble.
      const c = proche(b.debutSec);
      if (c !== undefined && c - a.debutSec >= min && b.finSec - c >= min) {
        a.finSec = arrondi(c);
        b.debutSec = arrondi(c);
      }
      continue;
    }
    const cf = proche(a.finSec);
    if (cf !== undefined && cf - a.debutSec >= min && (!b || cf <= b.debutSec) && cf >= (a.mots.at(-1)?.debutSec ?? 0)) a.finSec = arrondi(cf);
    if (b) {
      const cd = proche(b.debutSec);
      if (cd !== undefined && b.finSec - cd >= min && cd >= a.finSec) b.debutSec = arrondi(cd);
    }
  }
  // Le premier groupe peut aussi s'aligner sur une coupe proche de son début.
  if (s[0]) {
    const c = proche(s[0].debutSec);
    if (c !== undefined && s[0].finSec - c >= min) s[0].debutSec = arrondi(c);
  }
  return s;
}

/** Aucun chevauchement de minutage (exports .srt / .vtt et lecteurs). */
export function sansChevauchement(segments: SegmentSousTitres[]): SegmentSousTitres[] {
  const tries = [...segments].sort((a, b) => a.debutSec - b.debutSec);
  return tries.map((x, i) => {
    const suivant = tries[i + 1];
    return suivant && x.finSec > suivant.debutSec ? { ...x, finSec: suivant.debutSec } : x;
  });
}
