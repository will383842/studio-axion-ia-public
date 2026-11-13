// SUI-B — types et aides pures de l'affichage du suivi chiffré par mot. Aucun accès réseau ni service.
// Types déclarés ici à l'identique du lot SUI-A (mêmes formes, mêmes noms).

export type Fen = { j7: number; j30: number; total: number };

export interface LigneSuiviMot {
  mot: string;
  commentaires: Fen;
  reponsesPubliques: Fen;
  premiersMessages: Fen;
  renvois: Fen;
  formulaires: Fen | null;
  envoisEmail: Fen | null;
  clics: Fen | null;
  instagram: { reponsesOk: Fen; dejaSuivi: Fen; gagnees: Fen; sansSuivre: Fen; inconnu: Fen };
  auMoinsGagnees: number;
  parPublication: {
    post: string;
    reseau: string;
    commentaires: number;
    premiersMessages: number;
    formulaires: number | null;
    clics: number | null;
    auMoinsGagnees: number;
  }[];
  formulations: { version: string; envois: number; clics: number | null }[];
}

export interface TableauSuivi {
  genereLe: string;
  siteDisponible: boolean;
  lignes: LigneSuiviMot[];
}

/** Passer à true écrit TOUS les comptes en « au moins N » (une seule ligne à changer). */
export const AU_MOINS_PARTOUT = false;

/** Un compte ordinaire : exact, ou « au moins N » si le réglage global est actif. */
export function compteAffiche(n: number, partout: boolean = AU_MOINS_PARTOUT): string {
  return partout ? `au moins ${n}` : String(n);
}

export function libelleGagnees(n: number): string {
  return n <= 0 ? "aucune vue pour l'instant" : `au moins ${n}`;
}

/** Une valeur absente (chiffre non disponible) s'écrit « — », jamais 0. */
export function chiffreOuTiret(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : String(n);
}
