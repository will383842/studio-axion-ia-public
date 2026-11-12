/**
 * Stock de messages (STK-01) : définition UNIQUE du type. Rien n'est supprimé : on archive (date posée, texte conservé).
 */
import type { IdReseau } from "./types";

export type PrioriteStock = "haute" | "normale" | "basse";
export type EtatStock = "en-stock" | "planifie" | "publie";

export interface MessageStock {
  id: string;
  texte: string;
  reseau?: IdReseau;
  /** RC-31 : réseaux visés (le champ `reseau` reste lu tel quel). */
  reseaux?: IdReseau[];
  format?: string;
  priorite?: PrioriteStock;
  /** Jour limite, AAAA-MM-JJ. */
  echeance?: string;
  /** Absent = « en stock ». */
  etat?: EtatStock;
  /** Lien vers le créneau du calendrier, posé au passage à « planifié ». */
  creneauId?: string;
  /** Instant ISO (UTC) de mise en stock. */
  creeLe: string;
  /** Instant ISO (UTC) de l'archivage ; absent tant que le message est actif. */
  archiveLe?: string;
}

/** Rend une copie archivée et datée ; l'original n'est pas modifié. Un message déjà archivé garde sa date. */
export function archiverMessage(message: MessageStock, archiveLe: string): MessageStock {
  return { ...message, archiveLe: message.archiveLe ?? archiveLe };
}

// ---- RC-31 : liste « Stock à faire passer » (distincte du carnet d'idées et de « Mes scripts »). ----

export interface FiltreStock {
  reseau?: IdReseau;
  etat?: EtatStock;
  /** Garde les entrées dont l'échéance est ce jour ou avant (AAAA-MM-JJ). */
  echeanceAvant?: string;
}

export const RANG_PRIORITE: Record<PrioriteStock, number> = { haute: 0, normale: 1, basse: 2 };

export function etatDe(m: MessageStock): EtatStock {
  return m.etat ?? "en-stock";
}

export function reseauxDe(m: MessageStock): IdReseau[] {
  return m.reseaux?.length ? m.reseaux : m.reseau ? [m.reseau] : [];
}

/** Nouvelle entrée « en stock ». */
export function creerEntreeStock(
  e: { id: string; texte: string; reseaux: IdReseau[]; format?: string; priorite: PrioriteStock; echeance?: string },
  creeLe: string,
): MessageStock {
  return { id: e.id, texte: e.texte, reseaux: e.reseaux, format: e.format, priorite: e.priorite, echeance: e.echeance, etat: "en-stock", creeLe };
}

/** Copie passée à « planifié », liée au créneau. L'original n'est pas modifié. */
export function planifierEntree(m: MessageStock, creneauId: string): MessageStock {
  return { ...m, etat: "planifie", creneauId };
}

/** Stock actif = ni archivé ni déjà planifié ou publié. */
export function estActif(m: MessageStock): boolean {
  return !m.archiveLe && etatDe(m) === "en-stock";
}

/** Liste filtrée (réseau, état, échéance), triée par priorité puis échéance. Les archivées n'y figurent pas. */
export function filtrerStock(liste: MessageStock[], f: FiltreStock = {}): MessageStock[] {
  return liste
    .filter((m) => !m.archiveLe)
    .filter((m) => !f.reseau || reseauxDe(m).includes(f.reseau))
    .filter((m) => !f.etat || etatDe(m) === f.etat)
    .filter((m) => !f.echeanceAvant || (m.echeance !== undefined && m.echeance <= f.echeanceAvant))
    .sort(
      (a, b) =>
        RANG_PRIORITE[a.priorite ?? "normale"] - RANG_PRIORITE[b.priorite ?? "normale"] ||
        (a.echeance ?? "9999").localeCompare(b.echeance ?? "9999"),
    );
}
