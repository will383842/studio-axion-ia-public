/**
 * Taxonomie du contenu (PUR) : types de contenu, thèmes (les 12 types du ciblage, réutilisés tels quels) et statut commun
 * auquel se projettent les statuts des visuels et des vidéos. Ne définit aucun réseau : lit les types du contrat de porte.
 */
import { TYPES_AUTOMATISATION, type TypeAutomatisation } from "./ciblage/types";
import type { StatutVisuel } from "./visuels/statuts";
import type { IdReseau, StatutVideo } from "./types";

/** Les trois types de contenu servis par les réseaux. */
export const TYPES_CONTENU = ["video", "image", "carrousel"] as const;
export type TypeContenu = (typeof TYPES_CONTENU)[number];

export const LIBELLES_TYPE_CONTENU: Readonly<Record<TypeContenu, string>> = { video: "Vidéo", image: "Image", carrousel: "Carrousel" };

/** Les six réseaux du registre, dans l'ordre de la table de correspondance. */
export const RESEAUX_TAXONOMIE: readonly IdReseau[] = ["linkedin", "instagram", "facebook", "tiktok", "youtube", "youtube-shorts"];

/** Thèmes : exactement les 12 types du ciblage (un test garde la non-divergence). */
export const THEMES_CONTENU: readonly { id: TypeAutomatisation; libelle: string }[] = TYPES_AUTOMATISATION.map((t) => ({ id: t.id, libelle: t.libelle }));

export const STATUTS_COMMUNS = ["brouillon", "bloque", "en-preparation", "a-valider", "pret", "programme", "publie", "echec", "archive"] as const;
export type StatutCommun = (typeof STATUTS_COMMUNS)[number];

const LIBELLES_COMMUNS: Readonly<Record<StatutCommun, string>> = {
  brouillon: "Brouillon",
  bloque: "Bloqué",
  "en-preparation": "En préparation",
  "a-valider": "À valider",
  pret: "Prêt",
  programme: "Programmé",
  publie: "Publié",
  echec: "Échec",
  archive: "Archivé",
};

export function libelleStatutCommun(s: StatutCommun): string {
  return LIBELLES_COMMUNS[s];
}

const DEPUIS_VISUEL: Readonly<Record<StatutVisuel, StatutCommun>> = {
  brouillon: "brouillon",
  ecrit: "en-preparation",
  bloque: "bloque",
  rendu_en_cours: "en-preparation",
  echec_rendu: "echec",
  a_valider: "a-valider",
  valide: "pret",
  refuse: "brouillon",
  programme: "programme",
  publie: "publie",
  echec_envoi: "echec",
};

const DEPUIS_VIDEO: Readonly<Record<StatutVideo, StatutCommun>> = {
  brouillon: "brouillon",
  maquette: "brouillon",
  en_file: "en-preparation",
  en_fabrication: "en-preparation",
  prete: "pret",
  echec: "echec",
  annulee: "archive",
  archivee: "archive",
};

export function projeterStatutVisuel(s: StatutVisuel): StatutCommun {
  return DEPUIS_VISUEL[s];
}

export function projeterStatutVideo(s: StatutVideo): StatutCommun {
  return DEPUIS_VIDEO[s];
}
