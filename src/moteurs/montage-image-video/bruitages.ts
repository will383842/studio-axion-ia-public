/**
 * BRUITAGES DU FORMAT « IMAGE → VIDÉO » (lot L4, plan § 5, B4/B9). PUR.
 *
 * Aucun son nouveau, aucun type partagé modifié : nos sortes sont rattachées aux cinq déclencheurs qui existent déjà
 * (même mécanisme que `DECLENCHEUR_DE` du cas concret). Les bruitages sont obligatoires ; il n'y a JAMAIS de musique.
 *
 * Règles de pose, d'après les événements de la ligne de temps :
 *  - un son par changement visible (apparition d'un nœud, d'un chiffre, d'un objet, coche, changement de fond ou de
 *    scène) ; les compteurs donnent une rafale (un son par pas) ;
 *  - le mouvement de caméra ne compte pas comme changement, mais un mouvement MARQUÉ reçoit son souffle ;
 *  - jamais deux sons à moins de 0,1 s (le plus parlant reste) ;
 *  - rien dans la dernière seconde, sauf le son de clôture, 1,5 s avant la fin ;
 *  - seuls les sons validés par Will sont posés ; aucun reçu = refus explicite, jamais une vidéo muette.
 */
import { createHash } from "node:crypto";
import type { BruitagePlace } from "@/briques/intensite/types";
import { REGLES_BRUITAGES } from "@/briques/intensite/types";
import type { DeclencheurBruitage } from "@/domaine/types";
import { AVANCE_SOUFFLE_SEC, CLOTURE_AVANT_FIN_SEC, ECART_MIN_SEC } from "./emprunts";

/** Six sortes propres au format, puis les six sortes v4 déjà rattachées. */
export const SORTES_BRUITAGE_IV = [
  "separation", "camera", "chute", "frappe", "coche", "alerte",
  "souffle", "pop", "papier", "vibration", "tic", "cloture",
] as const;
export type SorteBruitageIV = (typeof SORTES_BRUITAGE_IV)[number];

/** Le son de la banque de chaque sorte : toujours un des cinq déclencheurs existants. */
export const DECLENCHEUR_IV: Readonly<Record<SorteBruitageIV, DeclencheurBruitage>> = {
  separation: "illustration-forte",
  camera: "illustration-forte",
  chute: "document",
  frappe: "document",
  coche: "chiffre",
  alerte: "telephone",
  souffle: "illustration-forte",
  pop: "impact",
  papier: "document",
  vibration: "telephone",
  tic: "chiffre",
  cloture: "impact",
};

/** Ce que la ligne de temps annonce (le lot L11 la fabrique ; ici, seulement ce que la pose en lit). */
export const GENRES_EVENEMENT = [
  "noeud", "chiffre", "objet", "coche", "fond", "scene",
  "separation", "chute", "frappe", "alerte", "compteur", "camera",
] as const;
export type GenreEvenement = (typeof GENRES_EVENEMENT)[number];

export interface EvenementIV {
  id: string;
  genre: GenreEvenement;
  /** Instant du changement visible, en secondes sur l'horloge de la vidéo. */
  instantSec: number;
  /** Compteur : nombre de pas (un son par pas, jusqu'à `finSec`). */
  pas?: number;
  /** Compteur : instant du dernier pas. */
  finSec?: number;
  /** Caméra : seulement un mouvement marqué reçoit un son. */
  marque?: boolean;
}

/** Le son (sorte) que pose chaque genre d'événement. */
export const SORTE_DE_GENRE: Readonly<Record<GenreEvenement, SorteBruitageIV>> = {
  noeud: "pop",
  chiffre: "tic",
  objet: "papier",
  coche: "coche",
  fond: "souffle",
  scene: "souffle",
  separation: "separation",
  chute: "chute",
  frappe: "frappe",
  alerte: "alerte",
  compteur: "tic",
  camera: "camera",
};

/** Les genres qui comptent comme « changement visible » (Q14/I5) : la caméra ne compte pas. */
export function estChangementVisible(g: GenreEvenement): boolean {
  return g !== "camera";
}

/** Son validé par Will, reçu de l'extérieur (forme de `BruitageDisponible`). */
export interface BruitageValideIV {
  elementId: string;
  declencheur: DeclencheurBruitage;
  variante: number;
  dureeSec: number;
}

export const GAIN_BRUITAGES_DB = -(REGLES_BRUITAGES.sousVoixDb[0] + REGLES_BRUITAGES.sousVoixDb[1]) / 2;
// Écart minimal entre deux sons, clôture 1,5 s avant la fin, avance du souffle : les règles du cas concret (emprunts).
export { AVANCE_SOUFFLE_SEC, CLOTURE_AVANT_FIN_SEC, ECART_MIN_SEC };
/** Un changement visible est « couvert » par un son posé à moins de cette distance. */
export const COUVERTURE_SEC = 0.15;
/** Aucun silence total plus long que ceci (Q20). */
export const SILENCE_MAX_SEC = 1.5;
export const PHRASE_AUCUN_VALIDE = "aucun bruitage validé";

/** Priorité quand deux sons se touchent (plus petit = gardé). */
const PRIORITE: Readonly<Record<SorteBruitageIV, number>> = {
  cloture: 0, coche: 1, tic: 2, alerte: 3, vibration: 4, pop: 5, chute: 6, frappe: 7, papier: 8, separation: 9, souffle: 10, camera: 11,
};

export interface EntreeBruitagesIV {
  evenements: readonly EvenementIV[];
  dureeSec: number;
  valides: readonly BruitageValideIV[];
  /**
   * Graine de la vidéo (variété, doc 72 § 7 point 3) : le point de départ des variantes de chaque déclencheur en vient,
   * pour que deux vidéos ne repartent pas de la même variante. Sans graine : comportement inchangé (départ à 0).
   */
  graine?: string;
}

export interface RapportBruitagesIV {
  /** Changements visibles sans son à moins de `COUVERTURE_SEC` (doit rester vide : Q20). */
  changementsSansSon: string[];
  /** Plus long silence entre deux sons, début et fin de vidéo compris (s). */
  plusLongSilenceSec: number;
  /** Déclencheurs voulus par la pose mais sans son validé. */
  declencheursSansSon: DeclencheurBruitage[];
}

export type ResultatBruitagesIV =
  | { ok: true; bruitages: BruitagePlace[]; rapport: RapportBruitagesIV }
  | { ok: false; motif: string };

interface Pose {
  sorte: SorteBruitageIV;
  debutSec: number;
  cle: string;
}

const arrondi = (x: number) => +x.toFixed(3);

/** Les poses voulues par un événement (avant tri et filtres). */
function posesDe(e: EvenementIV): Pose[] {
  if (e.genre === "camera") return e.marque ? [{ sorte: "camera", debutSec: arrondi(Math.max(0, e.instantSec - AVANCE_SOUFFLE_SEC)), cle: `camera-${e.id}` }] : [];
  if (e.genre === "compteur") {
    const pas = Math.max(1, Math.floor(e.pas ?? 1));
    const fin = e.finSec ?? e.instantSec;
    return Array.from({ length: pas }, (_, k) => ({
      sorte: "tic" as const,
      debutSec: arrondi(pas === 1 ? e.instantSec : e.instantSec + ((fin - e.instantSec) * k) / (pas - 1)),
      cle: `tic-${e.id}-${k}`,
    }));
  }
  const sorte = SORTE_DE_GENRE[e.genre];
  const avance = DECLENCHEUR_IV[sorte] === "illustration-forte" ? AVANCE_SOUFFLE_SEC : 0;
  return [{ sorte, debutSec: arrondi(Math.max(0, e.instantSec - avance)), cle: `${sorte}-${e.id}` }];
}

/** Variante de départ d'un déclencheur : tirée de la graine (sha256), 0 sans graine. */
function depart(graine: string | undefined, declencheur: DeclencheurBruitage, n: number): number {
  if (graine === undefined || n < 2) return 0;
  return parseInt(createHash("sha256").update(`${graine}|bruitage|${declencheur}`).digest("hex").slice(0, 12), 16) % n;
}

/** Les sons de la vidéo, dans l'ordre du temps. Aucun son validé : refus explicite. */
export function poserBruitagesIV(entree: EntreeBruitagesIV): ResultatBruitagesIV {
  const parDeclencheur = new Map<DeclencheurBruitage, BruitageValideIV[]>();
  for (const v of [...entree.valides].sort((a, b) => a.variante - b.variante || a.elementId.localeCompare(b.elementId))) {
    parDeclencheur.set(v.declencheur, [...(parDeclencheur.get(v.declencheur) ?? []), v]);
  }
  if (!parDeclencheur.size) return { ok: false, motif: PHRASE_AUCUN_VALIDE };

  const voulues = [...entree.evenements].sort((a, b) => a.instantSec - b.instantSec || a.id.localeCompare(b.id)).flatMap(posesDe);
  const limite = entree.dureeSec - REGLES_BRUITAGES.pasDansDerniereSec;
  const gardees = voulues.filter((p) => p.debutSec < limite);
  if (entree.dureeSec > CLOTURE_AVANT_FIN_SEC) gardees.push({ sorte: "cloture", debutSec: arrondi(entree.dureeSec - CLOTURE_AVANT_FIN_SEC), cle: "cloture" });

  const declencheursSansSon = [...new Set(gardees.map((p) => DECLENCHEUR_IV[p.sorte]).filter((d) => !parDeclencheur.has(d)))].sort();
  const possibles = gardees
    .filter((p) => parDeclencheur.has(DECLENCHEUR_IV[p.sorte]))
    .sort((a, b) => PRIORITE[a.sorte] - PRIORITE[b.sorte] || a.debutSec - b.debutSec || a.cle.localeCompare(b.cle));
  const retenus: Pose[] = [];
  for (const p of possibles) if (!retenus.some((r) => Math.abs(r.debutSec - p.debutSec) < ECART_MIN_SEC)) retenus.push(p);
  retenus.sort((a, b) => a.debutSec - b.debutSec || PRIORITE[a.sorte] - PRIORITE[b.sorte]);
  if (!retenus.length) return { ok: false, motif: PHRASE_AUCUN_VALIDE };

  // Variantes à tour de rôle : jamais deux fois la même de suite quand il y en a plusieurs.
  const rang = new Map<DeclencheurBruitage, number>();
  const bruitages: BruitagePlace[] = retenus.map((p) => {
    const declencheur = DECLENCHEUR_IV[p.sorte];
    const sons = parDeclencheur.get(declencheur)!;
    const n = rang.get(declencheur) ?? depart(entree.graine, declencheur, sons.length);
    rang.set(declencheur, n + 1);
    const son = sons[n % sons.length];
    const dureeSec = Math.min(son.dureeSec, REGLES_BRUITAGES.dureeMaxMs[declencheur] / 1000);
    return { elementId: son.elementId, declencheur, debutSec: p.debutSec, dureeSec, gainDb: GAIN_BRUITAGES_DB, planId: p.cle };
  });

  return { ok: true, bruitages, rapport: rapportDe(entree, bruitages, declencheursSansSon) };
}

function rapportDe(entree: EntreeBruitagesIV, bruitages: readonly BruitagePlace[], declencheursSansSon: DeclencheurBruitage[]): RapportBruitagesIV {
  const instants = bruitages.map((b) => b.debutSec);
  const changementsSansSon = entree.evenements
    .filter((e) => estChangementVisible(e.genre))
    .flatMap((e) => (e.genre === "compteur" ? posesDe(e).map((p, k) => ({ id: `${e.id}#${k}`, t: p.debutSec })) : [{ id: e.id, t: e.instantSec }]))
    .filter((c) => c.t < entree.dureeSec - REGLES_BRUITAGES.pasDansDerniereSec && !instants.some((t) => Math.abs(t - c.t) <= COUVERTURE_SEC))
    .map((c) => c.id);
  let plus = 0;
  let precedent = 0;
  for (const t of [...instants, entree.dureeSec]) {
    plus = Math.max(plus, t - precedent);
    precedent = t;
  }
  return { changementsSansSon, plusLongSilenceSec: arrondi(plus), declencheursSansSon };
}
