/**
 * NETTOYAGE DES BLANCS (moteur avocat, lot M1 ; plan B.1 « Nettoyage avant le visage », B.4 « Nettoyage commun »). PUR.
 *
 * Le studio CALCULE les coupures ; le conteneur `studio-rendu` (opération `nettoyage-audio`, file courte) ne fait
 * que les appliquer avec FFmpeg, en fondu de 10-20 ms recalé sur un passage par zéro, et renvoie les instants
 * réellement coupés. Les horodatages des mots sont décalés d'autant : l'audio nettoyé (piste `audio-maitre`) est
 * la SEULE source des deux angles, des sous-titres et du mixage.
 *
 * Règles (recette de montage, `nettoyageBlancs`) :
 *  - blanc de tête supprimé : la voix démarre en moins de 0,1 s ;
 *  - blanc de plus de 180 ms ramené à 80-120 ms (80 dans une phrase, 100 après une virgule, 120 après un point) ;
 *  - respiration reconnue (mesurée par `studio-rendu`) raccourcie à 150-250 ms au lieu d'être supprimée, au plus
 *    une toutes les 2 phrases (v3.2) ; jamais de respiration ajoutée ;
 *  - après le dernier mot, 0,5 s gardées (la vidéo finit 0,4-0,6 s après le dernier mot, B.2).
 */
import type { MotHorodate } from "@/domaine/types";

export interface ReglesNettoyage {
  seuilMs: number;
  cibleMs: [number, number];
  fonduMs: [number, number];
  respirationMs: [number, number];
  teteMaxMs: number;
}

export const REGLES_NETTOYAGE_PAR_DEFAUT: ReglesNettoyage = { seuilMs: 180, cibleMs: [80, 120], fonduMs: [10, 20], respirationMs: [150, 250], teteMaxMs: 100 };

export interface Intervalle {
  debutSec: number;
  finSec: number;
}

/** Un blanc entre deux mots, candidat au raccourcissement. */
export interface Blanc extends Intervalle {
  /** Index du mot qui précède le blanc. */
  apresMot: number;
  /** Nombre de fins de phrase depuis le début du texte (une respiration au plus toutes les 2 phrases). */
  phrase: number;
  ponctuation: "point" | "virgule" | "aucune";
}

/** Morceau RETIRÉ du son. */
export interface Coupure extends Intervalle {
  raison: "tete" | "blanc" | "respiration" | "queue";
  fonduMs: number;
}

export interface PlanNettoyage {
  coupures: Coupure[];
  dureeSourceSec: number;
  dureeSortieSec: number;
  /** Mots décalés sur le son nettoyé. */
  mots: MotHorodate[];
  /** Respirations gardées (temps de la source). */
  respirationsGardees: Intervalle[];
  /**
   * Correcteur réel 2 (04/10) : silence AJOUTÉ à la fin du son nettoyé pour que la fin dure ≈ 1,3 s après le dernier mot
   * (vraie respiration de fin ; l'avatar rendu sur ce son finit bouche fermée). 0 : rien à ajouter.
   */
  silenceFinSec: number;
}

const QUEUE_SEC = 0.5;
/** Correcteur réel 2 : durée totale du son après le dernier mot (queue gardée + silence ajouté). */
export const FIN_APRES_DERNIER_MOT_SEC = 1.3;
/** Marge gardée de part et d'autre d'une respiration, entre elle et les mots. */
const MARGE_RESPIRATION_SEC = 0.03;
/** En dessous, une coupure n'apporte rien (et le fondu la mangerait). */
const COUPURE_MIN_SEC = 0.02;

function ponctuationDe(mot: string): Blanc["ponctuation"] {
  if (/[.?!…]["»\s ]*$/.test(mot)) return "point";
  if (/[,;:]["»\s ]*$/.test(mot)) return "virgule";
  return "aucune";
}

/** Les blancs de plus de `seuilMs` entre deux mots (ceux que le nettoyage raccourcit). */
export function blancsLongs(mots: MotHorodate[], seuilMs: number): Blanc[] {
  const blancs: Blanc[] = [];
  let phrase = 0;
  for (let i = 0; i + 1 < mots.length; i++) {
    const p = ponctuationDe(mots[i].mot);
    if (p === "point") phrase++;
    const debutSec = mots[i].finSec;
    const finSec = mots[i + 1].debutSec;
    if ((finSec - debutSec) * 1000 > seuilMs) blancs.push({ debutSec, finSec, apresMot: i, phrase, ponctuation: p });
  }
  return blancs;
}

function cibleDuBlanc(b: Blanc, r: ReglesNettoyage): number {
  const [min, max] = r.cibleMs;
  return (b.ponctuation === "point" ? max : b.ponctuation === "virgule" ? (min + max) / 2 : min) / 1000;
}

const arrondi = (x: number) => +x.toFixed(4);

/**
 * Calcule les coupures. `respirations` : souffles reconnus dans le son par `studio-rendu` (temps de la source) ;
 * absent ou vide (voix de synthèse sans souffle, ou mesure non faite) : tous les blancs sont ramenés à 80-120 ms.
 */
export function calculerCoupures(params: { mots: MotHorodate[]; dureeSec: number; regles?: ReglesNettoyage; respirations?: Intervalle[]; espacementPhrases?: number }): PlanNettoyage {
  const r = params.regles ?? REGLES_NETTOYAGE_PAR_DEFAUT;
  const espacement = params.espacementPhrases ?? 2;
  const fonduMs = (r.fonduMs[0] + r.fonduMs[1]) / 2;
  const mots = params.mots;
  const coupures: Coupure[] = [];
  const respirationsGardees: Intervalle[] = [];
  const ajouter = (debutSec: number, finSec: number, raison: Coupure["raison"]) => {
    if (finSec - debutSec >= COUPURE_MIN_SEC) coupures.push({ debutSec: arrondi(debutSec), finSec: arrondi(finSec), raison, fonduMs });
  };
  if (!mots.length) return { coupures, dureeSourceSec: params.dureeSec, dureeSortieSec: params.dureeSec, mots: [], respirationsGardees, silenceFinSec: 0 };

  // Tête : la voix démarre en moins de 0,1 s (on garde la moitié du maximum, pour le fondu).
  const tete = Math.min(mots[0].debutSec, r.teteMaxMs / 2000);
  ajouter(0, mots[0].debutSec - tete, "tete");

  let dernierePhraseRespiree = -Infinity;
  for (const b of blancsLongs(mots, r.seuilMs)) {
    const souffle = (params.respirations ?? [])
      .filter((x) => x.debutSec >= b.debutSec - 0.01 && x.finSec <= b.finSec + 0.01 && x.finSec > x.debutSec)
      .sort((x, y) => y.finSec - y.debutSec - (x.finSec - x.debutSec))[0];
    if (souffle && b.phrase - dernierePhraseRespiree >= espacement) {
      // Respiration raccourcie à 150-250 ms par fondu, centrée sur le souffle, sans toucher aux mots.
      const longueur = Math.min(Math.max(souffle.finSec - souffle.debutSec, r.respirationMs[0] / 1000), r.respirationMs[1] / 1000);
      const centre = (souffle.debutSec + souffle.finSec) / 2;
      const d = Math.max(b.debutSec + MARGE_RESPIRATION_SEC, centre - longueur / 2);
      const f = Math.min(b.finSec - MARGE_RESPIRATION_SEC, d + longueur);
      ajouter(b.debutSec + MARGE_RESPIRATION_SEC, d, "respiration");
      ajouter(f, b.finSec - MARGE_RESPIRATION_SEC, "respiration");
      respirationsGardees.push({ debutSec: arrondi(d), finSec: arrondi(f) });
      dernierePhraseRespiree = b.phrase;
      continue;
    }
    // Blanc ramené à sa cible, moitié après le mot, moitié avant le suivant.
    const cible = cibleDuBlanc(b, r);
    ajouter(b.debutSec + cible / 2, b.finSec - cible / 2, "blanc");
  }

  // Queue : 0,5 s après le dernier mot.
  const finDernier = mots[mots.length - 1].finSec;
  ajouter(finDernier + QUEUE_SEC, params.dureeSec, "queue");

  coupures.sort((a, b) => a.debutSec - b.debutSec);
  const retire = coupures.reduce((s, c) => s + (c.finSec - c.debutSec), 0);
  return {
    coupures,
    dureeSourceSec: params.dureeSec,
    dureeSortieSec: arrondi(params.dureeSec - retire),
    mots: decalerMots(mots, coupures),
    respirationsGardees,
    silenceFinSec: arrondi(Math.max(0, FIN_APRES_DERNIER_MOT_SEC - Math.max(0, Math.min(params.dureeSec, finDernier + QUEUE_SEC) - finDernier))),
  };
}

/** Instant de la source → instant du son nettoyé. Un instant DANS une coupure tombe sur le point de raccord. */
export function decalerTemps(t: number, coupures: Intervalle[]): number {
  let retire = 0;
  for (const c of coupures) {
    if (c.finSec <= t) retire += c.finSec - c.debutSec;
    else if (c.debutSec < t) retire += t - c.debutSec;
  }
  return arrondi(t - retire);
}

export function decalerMots(mots: MotHorodate[], coupures: Intervalle[]): MotHorodate[] {
  return mots.map((m) => ({ ...m, debutSec: decalerTemps(m.debutSec, coupures), finSec: decalerTemps(m.finSec, coupures) }));
}

/**
 * Mesures renvoyées par `studio-rendu` (`EtatRendu.mesures`, des nombres) : instants réellement coupés après le recalage
 * sur un passage par zéro (`coupure.<i>.debut` / `.fin`), et souffles reconnus (`respiration.<i>.debut` / `.fin`).
 */
export function intervallesDesMesures(mesures: Record<string, number> | undefined, prefixe: "coupure" | "respiration"): Intervalle[] {
  if (!mesures) return [];
  const sortie: Intervalle[] = [];
  for (let i = 0; mesures[`${prefixe}.${i}.debut`] !== undefined; i++) {
    sortie.push({ debutSec: mesures[`${prefixe}.${i}.debut`], finSec: mesures[`${prefixe}.${i}.fin`] });
  }
  return sortie;
}

/** Coupures réellement appliquées (recalées) quand `studio-rendu` les renvoie ; sinon celles qui ont été demandées. */
export function coupuresAppliquees(demandees: Coupure[], mesures?: Record<string, number>): Coupure[] {
  const reelles = intervallesDesMesures(mesures, "coupure");
  if (reelles.length !== demandees.length) return demandees;
  return demandees.map((c, i) => ({ ...c, debutSec: reelles[i].debutSec, finSec: reelles[i].finSec }));
}

/** Débit réel (mots/s) sur la durée parlée, et la vitesse à essayer pour la PROCHAINE vidéo (B.4, v3.2). */
export function debitEtVitesseConseillee(mots: MotHorodate[], vitesseActuelle: number): { motsParSeconde: number; vitesseConseillee: number } {
  if (mots.length < 2) return { motsParSeconde: 0, vitesseConseillee: vitesseActuelle };
  const duree = mots[mots.length - 1].finSec - mots[0].debutSec;
  const motsParSeconde = +(mots.length / Math.max(0.1, duree)).toFixed(2);
  // 1,0 d'abord ; sous 4,0 mots/s après nettoyage, +0,05, jamais au-delà de 1,15 ; au-dessus de 4,8, on redescend.
  let vitesseConseillee = vitesseActuelle;
  if (motsParSeconde < 4.0) vitesseConseillee = Math.min(1.15, vitesseActuelle + 0.05);
  else if (motsParSeconde > 4.8) vitesseConseillee = Math.max(1.0, vitesseActuelle - 0.05);
  return { motsParSeconde, vitesseConseillee: +vitesseConseillee.toFixed(2) };
}
