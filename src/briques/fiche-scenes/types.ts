/**
 * FICHE DE SCÈNES — BRIQUE COMMUNE (organisation du studio, ligne I ; tâche ORG-08). Types PURS, sans Zod ni alias
 * « @/ » : lisibles tels quels par `studio-rendu` (comme `src/briques/motion/jetons.ts`).
 *
 * Une fiche de scènes décrit une vidéo découpée en scènes. Elle est COMMUNE à tous les formats faits de scènes : les
 * types d'éléments posés dans une scène et les règles propres à un format sont déclarés par ce format
 * (`ExtensionFormat`, voir `schema.ts`), jamais ici.
 */

/** Version courante du format de fiche. Toute autre valeur passe par `migrer.ts` ou est refusée. */
export const VERSION_FICHE_SCENES = "fiche-scenes/1";
export type VersionFicheScenes = typeof VERSION_FICHE_SCENES;

/** Structures de vidéo (recettes de script qui alternent). */
export const STRUCTURES_FICHE = ["erreur-corrigee", "avant-apres", "demonstration", "question-abonne"] as const;
export type StructureFiche = (typeof STRUCTURES_FICHE)[number];

/** Rôle d'une scène dans le récit. */
export const ROLES_SCENE = ["accroche", "douleur", "idee-recue", "etape", "exemple", "preuve", "resultat", "fin"] as const;
export type RoleScene = (typeof ROLES_SCENE)[number];

/** Ratios d'image du studio (mêmes valeurs que `Ratio` du domaine). */
export const RATIOS_FICHE = ["9:16", "1:1", "4:5", "16:9"] as const;
export type RatioFiche = (typeof RATIOS_FICHE)[number];

/** Bornes communes, vérifiées par `valider.ts`. */
export const BORNES_FICHE = {
  scenesMin: 4,
  scenesMax: 10,
  elementsMin: 1,
  elementsMax: 6,
  pageMin: 1,
  pageMax: 6,
  /** Contrat Usine § 21.2. */
  douleurMax: 140,
  gesteMinuteMax: 120,
} as const;

/** Forme des bornes (un format peut en élargir certaines pour une fiche donnée : `ExtensionFormat.bornes`). */
export type BornesFiche = { readonly [K in keyof typeof BORNES_FICHE]: number };

export interface SerieFiche {
  code: string;
  nom: string;
  // Jamais de numéro d'épisode : le schéma refuse tout autre champ.
}

/**
 * Une scène. `E` est le type d'élément déclaré par le format ; `C` celui de ses écrans (champ facultatif `ecrans`,
 * déclaré par le format qui en a : `ExtensionFormat.schemaEcran`).
 */
export interface SceneFiche<E = unknown, C = unknown, G = unknown> {
  /** « s01 » … « s10 », dans l'ordre. */
  id: string;
  role: RoleScene;
  /** Nouvelle page = coupe vers une page blanche. */
  page: number;
  /** Extrait exact du script validé. */
  texteDit: string;
  elements: E[];
  /** Posés par le calage ; absents de la fiche brute. */
  debutMs?: number;
  finMs?: number;
  /**
   * Ajout pur (11/10, tableau animé style v2), FACULTATIF : ce que la scène montre à l'écran (moment, gabarit…), forme
   * déclarée par le format (`ExtensionFormat.schemaEcran`). Refusé, comme tout champ inconnu, par un format qui n'en
   * déclare pas. Absent : comportement d'avant.
   */
  ecrans?: C[];
  /**
   * Ajout pur (14/10/2026, tableau animé style « reference/2 »), FACULTATIF : le gabarit de la page de la scène (rôle de
   * la page, numéro d'étape…), forme déclarée par le format (`ExtensionFormat.schemaGabarit`). Refusé, comme tout champ
   * inconnu, par un format qui n'en déclare pas.
   */
  gabarit?: G;
}

export interface FicheScenes<E = unknown, C = unknown, G = unknown> {
  version: VersionFicheScenes;
  formatId: string;
  videoId: string;
  versionId: string;
  /** Figé à la création, jamais modifié par une retouche. */
  habillage: string;
  /** Figé à la création, jamais modifié par une retouche. */
  stylo: string;
  ratio: RatioFiche;
  structure: StructureFiche;
  serie: SerieFiche;
  douleur: string;
  /** Ce que le spectateur refait dans la minute. */
  gesteMinute: string;
  /** Référence à la bibliothèque « Appels », jamais un texte. */
  appelId: string | null;
  /**
   * Ajout pur (16/10/2026, tableau animé), FACULTATIF : le style du tableau (« tableau-blanc », « ardoise »,
   * « paperboard ») choisi pour cette vidéo ; il prend le dessus sur le style de la série (`STYLE_PAR_SERIE`). Validé
   * par le format du tableau animé.
   */
  styleTableau?: string;
  scenes: SceneFiche<E, C, G>[];
}

/** Un refus : la règle (nom en clair), la scène concernée s'il y en a une, et le message complet en français. */
export interface ProblemeFiche {
  regle: string;
  sceneId?: string;
  message: string;
}

export type ResultatFiche<T> = { ok: true; fiche: T } | { ok: false; problemes: ProblemeFiche[] };
