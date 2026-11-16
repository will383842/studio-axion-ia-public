/**
 * Aucun consommateur (G2-04) : les générateurs la liront plus tard ; le cas concret garde `poserBruitages`.
 *
 * Pose commune des bruitages à partir d'instants génériques. PUR : ni hasard, ni horloge, ni service. Mêmes règles que
 * `src/moteurs/montage-cas-concret/bruitages.ts:86` (lecture seule) :
 *  - un souffle (illustration-forte) 0,03 s avant chaque changement de scène ;
 *  - un pop (impact) 0,12 s avant chaque mot appuyé ;
 *  - un tic (chiffre) 0,2 s après l'entrée d'un chiffre ;
 *  - un son de clôture (impact) 1,5 s avant la fin ; rien dans la dernière seconde ;
 *  - deux sons à moins de 0,1 s : le plus parlant reste.
 * Seuls les sons admis par `choisirSon` passent (valide-par-decision, ou porté en base ET validé) : aucun son neuf.
 * Export par chemin direct (`index.ts` des sons non modifié). Sans alias « @/ ».
 */
import { REGLES_BRUITAGES } from "../intensite/types";
import { choisirSon } from "./choix";
import type { EntreeSon } from "./types";

export type DeclencheurPose = keyof typeof REGLES_BRUITAGES.dureeMaxMs;
type Sorte = "souffle" | "pop" | "tic" | "cloture";

const DECLENCHEUR_DE: Readonly<Record<Sorte, DeclencheurPose>> = { souffle: "illustration-forte", pop: "impact", tic: "chiffre", cloture: "impact" };
/** Plus petit = gardé (même ordre que le cas concret : clôture, tic, pop, souffle). */
const PRIORITE: Readonly<Record<Sorte, number>> = { cloture: 0, tic: 1, pop: 2, souffle: 5 };
export const AVANCE_SOUFFLE_SEC = 0.03;
export const CLOTURE_AVANT_FIN_SEC = 1.5;
export const ECART_MIN_SEC = 0.1;
export const TIC_APRES_DEBUT_SEC = 0.2;
/** Gain commun : milieu de la plage sous la voix. */
export const GAIN_COMMUN_DB = -(REGLES_BRUITAGES.sousVoixDb[0] + REGLES_BRUITAGES.sousVoixDb[1]) / 2;

export interface EntreePoseCommune {
  /** Heures (s) des changements de scène (hors le tout premier début). */
  changementsSec: readonly number[];
  /** Heures (s) où la voix dit chaque mot appuyé. */
  motsAppuyesSec: readonly number[];
  /** Heures (s) d'entrée d'un chiffre. */
  chiffresSec: readonly number[];
  dureeSec: number;
  sons: readonly EntreeSon[];
  validesEnBase?: ReadonlySet<string>;
  /** Départ du choix des variantes ; absent : 0. */
  graine?: number;
}

export interface PoseCommune {
  /** Identifiant du son (registre). */
  id: string;
  declencheur: DeclencheurPose;
  debutSec: number;
  dureeSec: number;
  gainDb: number;
  planId: string;
}

interface Candidate {
  sorte: Sorte;
  debutSec: number;
  cle: string;
}

const arrondi = (x: number) => +x.toFixed(3);

export function poserBruitagesCommuns(e: EntreePoseCommune): PoseCommune[] {
  const graine = Number.isInteger(e.graine) && e.graine! > 0 ? e.graine! : 0;
  const choix = (declencheur: DeclencheurPose, g: number, dejaPoses: readonly string[]) =>
    choisirSon(declencheur, e.sons, { graine: g, dejaPoses, validesEnBase: e.validesEnBase });

  const poses: Candidate[] = [];
  const poser = (sorte: Sorte, debutSec: number, cle: string) => poses.push({ sorte, debutSec: arrondi(Math.max(0, debutSec)), cle });
  e.changementsSec.forEach((t, i) => poser("souffle", t - AVANCE_SOUFFLE_SEC, `souffle-${i}`));
  e.motsAppuyesSec.forEach((t, i) => poser("pop", t - REGLES_BRUITAGES.ecartMotCleSec, `pop-${i}`));
  e.chiffresSec.forEach((t, i) => poser("tic", t + TIC_APRES_DEBUT_SEC, `tic-${i}`));

  const limite = e.dureeSec - REGLES_BRUITAGES.pasDansDerniereSec;
  const gardes = poses.filter((p) => p.debutSec < limite);
  if (e.dureeSec > CLOTURE_AVANT_FIN_SEC) gardes.push({ sorte: "cloture", debutSec: arrondi(e.dureeSec - CLOTURE_AVANT_FIN_SEC), cle: "cloture" });

  // Seulement les sorties pour lesquelles un son est admis (aucun son neuf).
  const possibles = gardes
    .filter((p) => choix(DECLENCHEUR_DE[p.sorte], graine, []) !== null)
    .sort((a, b) => PRIORITE[a.sorte] - PRIORITE[b.sorte] || a.debutSec - b.debutSec);
  const retenus: Candidate[] = [];
  for (const p of possibles) if (!retenus.some((r) => Math.abs(r.debutSec - p.debutSec) < ECART_MIN_SEC)) retenus.push(p);
  retenus.sort((a, b) => a.debutSec - b.debutSec || PRIORITE[a.sorte] - PRIORITE[b.sorte]);

  const deja = new Map<DeclencheurPose, string[]>();
  return retenus.map((p, n) => {
    const declencheur = DECLENCHEUR_DE[p.sorte];
    const liste = deja.get(declencheur) ?? [];
    const son = choix(declencheur, graine + n + 1, liste)!;
    deja.set(declencheur, [...liste, son.id]);
    const dureeSec = Math.min(son.dureeSec, REGLES_BRUITAGES.dureeMaxMs[declencheur] / 1000);
    return { id: son.id, declencheur, debutSec: p.debutSec, dureeSec, gainDb: GAIN_COMMUN_DB, planId: p.cle };
  });
}
