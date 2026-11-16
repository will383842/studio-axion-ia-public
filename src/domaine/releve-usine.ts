/**
 * Ligne de relevé pour l'Usine (CONTRATS-ECHANGE, appel 6). PUR : ni dépôt, ni réseau, ni secret.
 * Aucun texte de publication et aucune donnée de personne : seulement des repères, des codes et des chiffres.
 */
import type { Publication } from "./types";

export type RepereDePublication = { commande_id: string; repere: string | null; signature: string | null };

export type SourceReleveUsine = "zernio" | "plausible" | "site" | "gsc" | "saisie";

export interface LigneReleveUsine {
  commande_id: string;
  repere: string | null;
  code_version: string;
  reseau: string;
  compte: string;
  jour: 3 | 7 | 30;
  vues: number;
  portee: number | null;
  likes: number;
  commentaires: number;
  partages: number;
  dureeMoyenneVueSec: number | null;
  source: SourceReleveUsine;
  releve_le: string;
}

export type ReleveDePublication = NonNullable<Publication["releves"]>[number];

/** Sources du studio reconnues par le contrat ; toute autre (« buffer », « api ») n'est pas rendue : on n'invente pas de source. */
const SOURCES: Partial<Record<ReleveDePublication["source"], SourceReleveUsine>> = { zernio: "zernio", saisie: "saisie" };

export interface EntreeLigneReleve {
  repere: RepereDePublication;
  codeVersion: string;
  reseau: string;
  compte: string;
  releve: ReleveDePublication;
}

/** La ligne de l'appel 6, ou null si le jour n'est pas 3, 7 ou 30 ou si la source n'existe pas dans le contrat. */
export function ligneReleveUsine(e: EntreeLigneReleve): LigneReleveUsine | null {
  const { releve: r } = e;
  const source = SOURCES[r.source];
  if (!source || (r.jour !== 3 && r.jour !== 7 && r.jour !== 30)) return null;
  const v = r.valeurs;
  return {
    commande_id: e.repere.commande_id,
    repere: e.repere.repere,
    code_version: e.codeVersion,
    reseau: e.reseau,
    compte: e.compte,
    jour: r.jour,
    vues: v.vues,
    portee: v.portee ?? null,
    likes: v.likes,
    commentaires: v.commentaires,
    partages: v.partages,
    dureeMoyenneVueSec: v.dureeMoyenneVueSec ?? null,
    source,
    releve_le: r.le,
  };
}
