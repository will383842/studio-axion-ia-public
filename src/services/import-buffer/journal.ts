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
