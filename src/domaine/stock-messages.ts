/**
 * Stock de messages (STK-01) : définition UNIQUE du type. Rien n'est supprimé : on archive (date posée, texte conservé).
 */
import { RESEAUX_TAXONOMIE } from "./taxonomie-contenu";
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
  priorite?: PrioriteStock;
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
  const cren = creneauId.trim();
  if (!cren) throw new Error("Choisissez le créneau du calendrier.");
  if (m.archiveLe) throw new Error("Ce message est archivé : il ne peut plus être planifié.");
  if (etatDe(m) === "planifie" && m.creneauId === cren) return m;
  if (etatDe(m) !== "en-stock") throw new Error("Ce message est déjà planifié ou publié.");
  return { ...m, etat: "planifie", creneauId: cren };
}

const JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;
export function jourValide(j: string): boolean {
  const m = JOUR.exec(j);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** Contrôle d'une saisie (donnée client) : renvoie le message d'erreur, ou null si elle est valide. */
export function verifierSaisieStock(e: { texte: unknown; reseaux: unknown; priorite: unknown; echeance?: unknown }): string | null {
  if (typeof e.texte !== "string" || !e.texte.trim()) return "Écrivez le message à mettre en stock.";
  if (!Array.isArray(e.reseaux) || e.reseaux.length === 0) return "Choisissez au moins un réseau.";
  if (e.reseaux.some((r) => !RESEAUX_TAXONOMIE.includes(r as IdReseau))) return "Réseau inconnu.";
  if (typeof e.priorite !== "string" || !Object.hasOwn(RANG_PRIORITE, e.priorite)) return "Choisissez une priorité.";
  if (e.echeance !== undefined && (typeof e.echeance !== "string" || !jourValide(e.echeance))) return "L'échéance doit être un jour valide (AAAA-MM-JJ).";
  return null;
}

/** Stock actif = ni archivé ni déjà planifié ou publié. */
export function estActif(m: MessageStock): boolean {
  return !m.archiveLe && etatDe(m) === "en-stock";
}

function rang(m: MessageStock): number {
  const r: unknown = Object.hasOwn(RANG_PRIORITE, m.priorite ?? "normale") ? RANG_PRIORITE[m.priorite ?? "normale"] : undefined;
  return typeof r === "number" ? r : 3;
}

/** Liste filtrée (réseau, priorité, état, échéance), triée par priorité puis échéance. Les archivées n'y figurent pas. */
export function filtrerStock(liste: MessageStock[], f: FiltreStock = {}): MessageStock[] {
  return liste
    .filter((m) => !m.archiveLe)
    .filter((m) => !f.reseau || reseauxDe(m).includes(f.reseau))
    .filter((m) => !f.priorite || (m.priorite ?? "normale") === f.priorite)
    .filter((m) => !f.etat || etatDe(m) === f.etat)
    .filter((m) => !f.echeanceAvant || (m.echeance !== undefined && m.echeance <= f.echeanceAvant))
    .sort(
      (a, b) =>
        rang(a) - rang(b) ||
        (a.echeance ?? "9999").localeCompare(b.echeance ?? "9999"),
    );
}
