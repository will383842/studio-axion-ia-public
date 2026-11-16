/**
 * L4-10 — Formats communs de l'import du plan LinkedIn. Fonctions pures : horloge injectée, aucun appel réel.
 */
export type Horloge = () => Date;

export class ErreurFormatPlan extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurFormatPlan";
  }
}

export const VERSION_REFONDU = "REFONDU";

/** Clé idempotente d'un post du plan : une seule entrée par numéro, quelle que soit la relance. */
export const cleIdempotente = (numero: number): string => `plan-linkedin:${numero}`;

const MOTS_TU = /(?<![\p{L}\p{N}_])(tu|toi|ton|ta|tes|te)(?![\p{L}\p{N}_])/giu;

/** Nombre de mots du tutoiement dans un texte (alerte : le plan se rédige au vouvoiement). */
export const compterTu = (texte: string): number => (texte.match(MOTS_TU) ?? []).length;

export interface LigneCalendrier {
  numero: number;
  /** AAAA-MM-JJ. */
  date: string;
  heure: string;
  version: string;
}

export interface TextesPost {
  texte: string;
  premierCommentaire: string;
}

export interface EntreePlan {
  cle: string;
  numero: number;
  date: string;
  heure: string;
  texte: string;
  premierCommentaire: string;
  /** Date passée à la date de l'horloge : « passé, à confirmer ». */
  passeInconnu: boolean;
  /** Le texte contient du tutoiement : à réécrire au vouvoiement (non réécrit automatiquement). */
  alerteTu: boolean;
  statut: "Publié";
  verrouille: true;
  boutonPrincipal: null;
}
