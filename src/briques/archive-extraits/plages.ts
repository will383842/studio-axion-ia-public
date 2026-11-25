/**
 * Archive des vidéos livrées (C3-UT-3.2) : découpe pure des mots horodatés en plages de 1,5 à 6 s, avec exclusions.
 * Aucune date, aucun hasard, aucun service. Le type des intervalles interdits est structurel : C3-UT-3.3 produit la même forme.
 */
import { PLAGES_MAX_PAR_FICHE, type PlageExtrait } from "../../domaine/archive-extraits";
import type { MotHorodate } from "../../domaine/types";
import { motsClesDe } from "./mots-cles";
import { EPS } from "../../lib/tolerance";

export const DUREE_PLAGE_MIN_SEC = 1.5;
export const DUREE_PLAGE_MAX_SEC = 6;
export const SILENCE_COUPE_SEC = 0.45;
export const MARGE_FIN_APPEL_SEC = 4;

export interface IntervalleInterdit {
  debutSec: number;
  finSec: number;
  raison: string;
}

export interface ContexteDecoupe {
  dureeSourceSec: number;
  /** Vrai : la fin dit « Écrivez MOT » ; absent : inconnu (traité comme vrai). */
  appelAuMot?: boolean;
  interdits?: IntervalleInterdit[];
}

const MONTANT = /€|euros?|prix|tarif|co[uû]te|\d+\s?[kK]?\s?€/i;

/** Aplatit les segments, trie par début, retire les doublons d'instant. */
export function motsDepuisSegments(segments: { mots: MotHorodate[] }[]): MotHorodate[] {
  const tous = segments.flatMap((s) => s.mots);
  const tries = tous
    .map((m, i) => ({ m, i }))
    .sort((a, b) => a.m.debutSec - b.m.debutSec || a.i - b.i)
    .map((x) => x.m);
  const sortie: MotHorodate[] = [];
  for (const m of tries) {
    const prec = sortie[sortie.length - 1];
    if (prec && prec.debutSec === m.debutSec && prec.finSec === m.finSec && prec.mot === m.mot) continue;
    if (prec && prec.debutSec === m.debutSec) continue;
    sortie.push(m);
  }
  return sortie;
}

const duree = (p: MotHorodate[]): number => (p.length ? p[p.length - 1].finSec - p[0].debutSec : 0);

/** Coupe une suite de mots > 6 s au plus grand silence intérieur, récursivement. */
function couperLongue(groupe: MotHorodate[]): MotHorodate[][] {
  if (duree(groupe) <= DUREE_PLAGE_MAX_SEC + EPS || groupe.length < 2) return [groupe];
  let meilleur = 1;
  let ecart = -Infinity;
  for (let i = 1; i < groupe.length; i++) {
    const e = groupe[i].debutSec - groupe[i - 1].finSec;
    if (e > ecart) {
      ecart = e;
      meilleur = i;
    }
  }
  return [...couperLongue(groupe.slice(0, meilleur)), ...couperLongue(groupe.slice(meilleur))];
}

/** Coupe sur ponctuation finale ou silence ≥ 0,45 s ; recolle les phrases trop courtes ; coupe les trop longues. */
export function phrases(mots: MotHorodate[]): MotHorodate[][] {
  const brutes: MotHorodate[][] = [];
  let cour: MotHorodate[] = [];
  mots.forEach((m, i) => {
    cour.push(m);
    const suivant = mots[i + 1];
    const finPhrase = /[.?!…]["»')\]]*\s*$/.test(m.mot);
    const silence = suivant ? suivant.debutSec - m.finSec >= SILENCE_COUPE_SEC - EPS : false;
    if (!suivant || finPhrase || silence) {
      brutes.push(cour);
      cour = [];
    }
  });
  const collees: MotHorodate[][] = [];
  for (const ph of brutes) {
    const prec = collees[collees.length - 1];
    if (prec && duree(prec) < DUREE_PLAGE_MIN_SEC && duree([...prec, ...ph]) <= DUREE_PLAGE_MAX_SEC + EPS) {
      collees[collees.length - 1] = [...prec, ...ph];
    } else {
      collees.push(ph);
    }
  }
  // une phrase courte restante se recolle à la précédente si le total tient
  const finales: MotHorodate[][] = [];
  for (const ph of collees) {
    const prec = finales[finales.length - 1];
    if (prec && duree(ph) < DUREE_PLAGE_MIN_SEC && duree([...prec, ...ph]) <= DUREE_PLAGE_MAX_SEC + EPS) {
      finales[finales.length - 1] = [...prec, ...ph];
    } else {
      finales.push(ph);
    }
  }
  return finales.flatMap(couperLongue);
}

/** Garde les utilisables d'abord, puis les plus longues ; ordre final par début. */
export function plafonner(plages: PlageExtrait[], max: number = PLAGES_MAX_PAR_FICHE): PlageExtrait[] {
  if (plages.length <= max) return plages.slice().sort((a, b) => a.debutSec - b.debutSec);
  const rang = (p: PlageExtrait) => (p.etat === "utilisable" ? 0 : 1);
  return plages
    .slice()
    .sort((a, b) => rang(a) - rang(b) || b.finSec - b.debutSec - (a.finSec - a.debutSec) || a.debutSec - b.debutSec)
    .slice(0, max)
    .sort((a, b) => a.debutSec - b.debutSec);
}

function raisonExclusion(p: PlageExtrait, ctx: ContexteDecoupe): string | undefined {
  if (!p.texte.trim()) return "texte-vide";
  if (p.finSec - p.debutSec < DUREE_PLAGE_MIN_SEC - EPS) return "trop-courte";
  if (ctx.appelAuMot !== false && p.debutSec > ctx.dureeSourceSec - MARGE_FIN_APPEL_SEC) return "fin-appel";
  if (MONTANT.test(p.texte)) return "montant";
  const choc = (ctx.interdits ?? []).find((i) => p.debutSec < i.finSec && p.finSec > i.debutSec);
  if (choc) return choc.raison;
  return undefined;
}

/** Découpe les mots horodatés en plages candidates ; les plages écartées gardent leur raison. */
export function decouperPlages(mots: MotHorodate[], contexte: ContexteDecoupe): PlageExtrait[] {
  const triés = motsDepuisSegments([{ mots }]);
  const plages = phrases(triés).map((groupe): PlageExtrait => {
    const debutSec = groupe[0].debutSec;
    const finSec = groupe[groupe.length - 1].finSec;
    const texte = groupe.map((m) => m.mot).join(" ").trim();
    const p: PlageExtrait = {
      id: `p-${Math.round(debutSec * 100)}-${Math.round(finSec * 100)}`,
      debutSec,
      finSec,
      texte,
      motsCles: motsClesDe(texte),
      avecVisage: false,
      texteIncruste: false,
      etat: "utilisable",
    };
    const raison = raisonExclusion(p, contexte);
    if (raison) {
      p.etat = "exclue";
      p.raisonExclusion = raison;
    }
    return p;
  });
  return plafonner(plages, PLAGES_MAX_PAR_FICHE);
}
