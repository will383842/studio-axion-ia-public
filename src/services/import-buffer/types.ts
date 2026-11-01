/**
 * IMP-1 — TYPES DE LA LECTURE DES POSTS À VENIR DANS BUFFER (lecture seule, aucune écriture chez Buffer ni Zernio).
 * Formes recalées sur `docs/buffer/schema-2026-10.json`.
 */

export type TypeMedia = "image" | "video" | "document";

export interface MediaBuffer {
  type: TypeMedia;
  mime: string;
  /** Adresse de lecture donnée par Buffer (temporaire, jamais écrite dans un rapport ni un journal). */
  source: string;
  /** Texte alternatif (images seulement). */
  texteAlternatif?: string;
  /** Titre (documents, vidéos). */
  titre?: string;
  /** Taille annoncée par Buffer, en octets, si connue. */
  tailleAnnoncee?: number;
}

export interface LienJoint {
  url: string;
  titre?: string;
}

export interface PostBuffer {
  id: string;
  canalId: string;
  texte: string;
  /** Date d'envoi prévue, ISO 8601 en UTC. */
  dateUtc?: string;
  creeLe?: string;
  envoyeLe?: string;
  statut: string;
  medias: MediaBuffer[];
  premierCommentaire?: string;
  lienJoint?: LienJoint;
  /** Titre du post (Facebook, YouTube…). */
  titre?: string;
}

export interface CanalBuffer {
  id: string;
  nom: string;
  service: string;
}

export interface MesureBuffer {
  type: string;
  nom?: string;
  valeur: number;
}

export interface StatistiquesPost {
  postId: string;
  canalId: string;
  envoyeLe?: string;
  misesAJourLe?: string;
  mesures: MesureBuffer[];
}

export type RaisonExclusion = "passe" | "envoye" | "video-test-31-10";

export interface PostExclu {
  id: string;
  raison: RaisonExclusion;
}

/** Erreur de lecture : le message ne porte jamais la clé. */
export class ErreurLectureBuffer extends Error {
  constructor(
    public readonly code: "ecriture-refusee" | "cle-absente" | "refuse" | "indisponible" | "illisible",
    message: string,
  ) {
    super(message);
    this.name = "ErreurLectureBuffer";
  }
}
