/**
 * BRUITAGES DU CAS CONCRET (tâche M8, plan cas concret § 5 n° 7). PUR.
 *
 * Posés SEULEMENT parmi les sons validés reçus (aucun : vidéo sans bruitages, le rapport le dit), d'après la vidéo de
 * référence (`reference/plans.json`, 73 sons) :
 *  - un « souffle court » (illustration forte) juste avant chaque changement d'écran ;
 *  - un « pop » (impact) juste avant chaque mot écrit en orange, quand la voix le dit ;
 *  - un « papier » (document) par tâche de la liste « avant » ;
 *  - une « vibration » (téléphone) sur une notification ;
 *  - un « tic » (chiffre) sur un écran chiffre ;
 *  - rien dans la dernière seconde, sauf le son de clôture (impact) 1,5 s avant la fin.
 * Gain commun à tous les sons ; deux sons ne tombent jamais au même instant (le plus parlant est gardé).
 */
import type { EcranCale } from "@/briques/ecrans-motion";
import type { BruitagePlace } from "@/briques/intensite/types";
import { REGLES_BRUITAGES } from "@/briques/intensite/types";
import type { DeclencheurBruitage, MotHorodate } from "@/domaine/types";
import { cleMot, type Ecran } from "./fiche";
import { motsOrange } from "./etapes";
import type { BruitageValideCasConcret } from "./outils";

export const SORTES_BRUITAGE = ["souffle", "pop", "papier", "vibration", "tic", "cloture"] as const;
export type SorteBruitage = (typeof SORTES_BRUITAGE)[number];

/** Son de la banque de chaque sorte (déclencheur de la banque du studio). */
export const DECLENCHEUR_DE: Readonly<Record<SorteBruitage, DeclencheurBruitage>> = {
  souffle: "illustration-forte",
  pop: "impact",
  papier: "document",
  vibration: "telephone",
  tic: "chiffre",
  cloture: "impact",
};

/** Gain commun : le milieu de la plage sous la voix (18 à 24 dB). */
export const GAIN_BRUITAGES_DB = -(REGLES_BRUITAGES.sousVoixDb[0] + REGLES_BRUITAGES.sousVoixDb[1]) / 2;
/** Le souffle part juste avant la coupe (référence : 30 ms). */
export const AVANCE_SOUFFLE_SEC = 0.03;
/** Le son de clôture tombe 1,5 s avant la fin. */
export const CLOTURE_AVANT_FIN_SEC = 1.5;
/** Deux sons plus proches que ceci : seul le plus parlant reste. */
export const ECART_MIN_SEC = 0.1;
/** Le tic tombe peu après l'entrée de l'écran chiffre. */
const TIC_APRES_DEBUT_SEC = 0.2;
/** La vibration tombe peu après l'entrée de la notification. */
const VIBRATION_APRES_DEBUT_SEC = 0.3;

/** Priorité quand deux sons se touchent (plus petit = gardé). */
const PRIORITE: Readonly<Record<SorteBruitage, number>> = { cloture: 0, tic: 1, pop: 2, vibration: 3, papier: 4, souffle: 5 };

const NOTIFICATIONS = new Set(["telephone-notification", "pile-notifications"]);

export interface EntreeBruitages {
  /** Écrans de la fiche calés (corps puis fin), pour leurs types et leurs mots orange. */
  ecrans: readonly Ecran[];
  /** Les mêmes écrans à la forme de la brique (heures et événements sur l'horloge de la vidéo). */
  cales: readonly EcranCale[];
  /** Mots de la voix assemblée, au tempo final. */
  mots: readonly MotHorodate[];
  dureeSec: number;
  valides: readonly BruitageValideCasConcret[];
  /**
   * L3a · départ de la rotation des variantes (`mise.tirage.bruitages.depart`) : le n-ième son d'un déclencheur est
   * `sons[(n + graine) % sons.length]`. Absent ou 0 : la rotation d'origine (v4, et le générateur image → vidéo qui
   * emprunte ce module). Aucun nouveau son : seulement l'ordre des variantes déjà validées.
   */
  graine?: number;
}

interface Pose {
  sorte: SorteBruitage;
  debutSec: number;
  cle: string;
}

const arrondi = (x: number) => +x.toFixed(3);

/** Heure (s) du premier mot dit de l'écran qui vaut `mot` ; sinon le début de l'écran. */
function heureDuMot(mot: string, debutMs: number, finMs: number, mots: readonly MotHorodate[]): number {
  const cle = cleMot(mot);
  const dit = mots.find((m) => m.debutSec * 1000 >= debutMs - 1 && m.debutSec * 1000 < finMs && cleMot(m.mot) === cle);
  return dit ? dit.debutSec : debutMs / 1000;
}

/** Les sons de la vidéo, dans l'ordre du temps. Aucun son validé de la sorte voulue : rien n'est posé pour elle. */
export function poserBruitages(e: EntreeBruitages): BruitagePlace[] {
  const parDeclencheur = new Map<DeclencheurBruitage, BruitageValideCasConcret[]>();
  for (const v of [...e.valides].sort((a, b) => a.variante - b.variante || a.elementId.localeCompare(b.elementId))) {
    parDeclencheur.set(v.declencheur, [...(parDeclencheur.get(v.declencheur) ?? []), v]);
  }
  if (!parDeclencheur.size) return [];

  const poses: Pose[] = [];
  const poser = (sorte: SorteBruitage, debutSec: number, cle: string) => poses.push({ sorte, debutSec: arrondi(Math.max(0, debutSec)), cle });

  e.cales.forEach((c, i) => {
    const ecran = e.ecrans[i];
    if (i > 0) poser("souffle", c.debutMs / 1000 - AVANCE_SOUFFLE_SEC, `souffle-${c.id}`);
    if (ecran) for (const m of motsOrange(ecran)) poser("pop", heureDuMot(m, c.debutMs, c.finMs, e.mots) - REGLES_BRUITAGES.ecartMotCleSec, `pop-${c.id}-${cleMot(m)}`);
    if (c.type === "liste-avant") {
      c.taches.forEach((_, k) => {
        const ev = c.evenements.find((x) => x.cible === `tache-${k + 1}`);
        poser("papier", ev ? ev.ms / 1000 : (c.debutMs + ((c.finMs - c.debutMs) * k) / c.taches.length) / 1000, `papier-${c.id}-${k}`);
      });
    }
    if ((c.type === "etape" || c.type === "objet") && "objet" in c.visuel && NOTIFICATIONS.has(c.visuel.objet)) {
      const ev = c.evenements.find((x) => x.cible === "objet");
      poser("vibration", ev ? ev.ms / 1000 : c.debutMs / 1000 + VIBRATION_APRES_DEBUT_SEC, `vibration-${c.id}`);
    }
    if (c.type === "chiffre") poser("tic", c.debutMs / 1000 + TIC_APRES_DEBUT_SEC, `tic-${c.id}`);
  });

  // Rien dans la dernière seconde ; le son de clôture 1,5 s avant la fin.
  const limite = e.dureeSec - REGLES_BRUITAGES.pasDansDerniereSec;
  const gardes = poses.filter((p) => p.debutSec < limite);
  if (e.dureeSec > CLOTURE_AVANT_FIN_SEC) gardes.push({ sorte: "cloture", debutSec: arrondi(e.dureeSec - CLOTURE_AVANT_FIN_SEC), cle: "cloture" });

  // Seulement les sorties qui ont un son validé ; deux sons trop proches : le plus parlant reste.
  const possibles = gardes.filter((p) => parDeclencheur.has(DECLENCHEUR_DE[p.sorte])).sort((a, b) => PRIORITE[a.sorte] - PRIORITE[b.sorte] || a.debutSec - b.debutSec);
  const retenus: Pose[] = [];
  for (const p of possibles) if (!retenus.some((r) => Math.abs(r.debutSec - p.debutSec) < ECART_MIN_SEC)) retenus.push(p);
  retenus.sort((a, b) => a.debutSec - b.debutSec || PRIORITE[a.sorte] - PRIORITE[b.sorte]);

  // Variantes tirées à tour de rôle (jamais deux fois la même de suite quand il y en a plusieurs), depuis le départ `graine`.
  const depart = Number.isInteger(e.graine) && e.graine! > 0 ? e.graine! : 0;
  const rang = new Map<DeclencheurBruitage, number>();
  return retenus.map((p) => {
    const declencheur = DECLENCHEUR_DE[p.sorte];
    const sons = parDeclencheur.get(declencheur)!;
    const n = rang.get(declencheur) ?? 0;
    rang.set(declencheur, n + 1);
    const son = sons[(n + depart) % sons.length];
    const dureeSec = Math.min(son.dureeSec, (REGLES_BRUITAGES.dureeMaxMs[declencheur] ?? 400) / 1000);
    return { elementId: son.elementId, declencheur, debutSec: p.debutSec, dureeSec, gainDb: GAIN_BRUITAGES_DB, planId: p.cle };
  });
}
