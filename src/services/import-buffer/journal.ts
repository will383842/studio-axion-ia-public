/**
 * IMP-1 — STRUCTURE DU JOURNAL D'IMPORT (documents jsonb de type « import-buffer »).
 * AUCUNE migration, AUCUNE écriture en base ici : seulement des types et des fonctions pures. Un autre lot branchera
 * l'écriture. Le journal ne contient ni clé, ni adresse de média : seulement des identifiants, clés R2, tailles,
 * empreintes et décisions.
 */
import type { ResultatCopie } from "./medias-prives";
import type { PostExclu } from "./types";

export const TYPE_DOCUMENT_IMPORT = "import-buffer" as const;

export type EtatImportPost = "lu" | "exclu" | "medias-copies" | "medias-partiels" | "echec";

export interface EntreeJournalPost {
  bufferId: string;
  etat: EtatImportPost;
  raisonExclusion?: string;
  medias: { rang: number; type: string; taille: number; sha256: string; cleStockage: string }[];
  echecsMedias: number;
}

export interface DocumentJournalImport {
  type: typeof TYPE_DOCUMENT_IMPORT;
  /** Identifiant du passage (date ISO du lancement). */
  id: string;
  lanceLe: string;
  aBlanc: boolean;
  posts: EntreeJournalPost[];
}

const ID_SUR = /^[A-Za-z0-9_-]{1,64}$/;

export function nouveauJournal(lanceLe: Date, aBlanc: boolean): DocumentJournalImport {
  return { type: TYPE_DOCUMENT_IMPORT, id: `import-${lanceLe.toISOString()}`, lanceLe: lanceLe.toISOString(), aBlanc, posts: [] };
}

export function entreeExclue(e: PostExclu): EntreeJournalPost {
  return { bufferId: e.id, etat: "exclu", raisonExclusion: e.raison, medias: [], echecsMedias: 0 };
}

export function entreeDepuisCopie(r: ResultatCopie): EntreeJournalPost {
  const etat: EtatImportPost = r.echecs.length === 0 ? "medias-copies" : r.copies.length > 0 ? "medias-partiels" : "echec";
  return {
    bufferId: r.postId,
    etat: r.copies.length === 0 && r.echecs.length === 0 ? "lu" : etat,
    medias: r.copies.map((c) => ({ rang: c.rang, type: c.type, taille: c.taille, sha256: c.sha256, cleStockage: c.cleStockage })),
    echecsMedias: r.echecs.length,
  };
}

/** Ajoute (ou remplace, par identifiant Buffer) une entrée ; renvoie un nouveau document. */
export function ajouterEntree(j: DocumentJournalImport, e: EntreeJournalPost): DocumentJournalImport {
  if (!ID_SUR.test(e.bufferId)) throw new Error("Identifiant de post illisible : entrée refusée.");
  return { ...j, posts: [...j.posts.filter((p) => p.bufferId !== e.bufferId), e] };
}

export function resumeJournal(j: DocumentJournalImport): Record<EtatImportPost, number> & { total: number } {
  const r = { lu: 0, exclu: 0, "medias-copies": 0, "medias-partiels": 0, echec: 0, total: j.posts.length };
  for (const p of j.posts) r[p.etat]++;
  return r;
}

/** Ids déjà copiés en entier : un nouveau passage peut les sauter. */
export const dejaCopies = (j: DocumentJournalImport): Set<string> => new Set(j.posts.filter((p) => p.etat === "medias-copies").map((p) => p.bufferId));

/* --- Journal des clés d'idempotence `imp-…` (IMP-2 : le journal fait foi au-delà des 24 h de Zernio) --- */

const CLE_IMPORT = /^imp-[0-9a-f]{64}$/;
const ID_ZERNIO = /^[A-Za-z0-9_-]{1,64}$/;

/** Relit un fichier de clés {clé: identifiant Zernio} ; toute entrée de forme inconnue est ignorée. */
export function lireCles(brut: unknown): Map<string, string> {
  const m = new Map<string, string>();
  if (brut && typeof brut === "object" && !Array.isArray(brut)) {
    for (const [k, v] of Object.entries(brut as Record<string, unknown>)) if (CLE_IMPORT.test(k) && typeof v === "string" && ID_ZERNIO.test(v)) m.set(k, v);
  }
  return m;
}

/** Ajoute les brouillons créés, retrouvés ou déjà connus au journal des clés ; renvoie une nouvelle table. */
export function ajouterCles(cles: Map<string, string>, lignes: { cle?: string; zernioId?: string; etat: string }[]): Map<string, string> {
  const r = new Map(cles);
  for (const l of lignes) if (l.cle && l.zernioId && CLE_IMPORT.test(l.cle) && ["cree", "doublon", "deja-fait"].includes(l.etat)) r.set(l.cle, l.zernioId);
  return r;
}
