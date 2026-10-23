/**
 * SCHÉMA ZOD COMMUN de la fiche de scènes (version `fiche-scenes/1`). Côté studio seulement (Zod n'est pas dans
 * `studio-rendu`, qui lit `types.ts`). Imports relatifs, sans alias « @/ ».
 *
 * Schéma EXACT : tout champ inconnu est refusé, aucune valeur n'est corrigée (ni rognée, ni complétée par défaut).
 * Point d'extension : le format fournit le schéma de ses éléments et ses règles propres (`ExtensionFormat`).
 */
import { z } from "zod";
import {
  BORNES_FICHE,
  RATIOS_FICHE,
  ROLES_SCENE,
  STRUCTURES_FICHE,
  VERSION_FICHE_SCENES,
  type BornesFiche,
  type FicheScenes,
} from "./types";

/** Une règle propre à un format, lancée après les règles communes sur une fiche déjà conforme au schéma. */
export interface RegleFormat<E> {
  /** Nom en clair, cité dans le message (par exemple « accroche courte »). */
  nom: string;
  /** Liste des manquements (vide si la règle est respectée). `detail` dit ce qui ne va pas, en français. */
  verifier: (fiche: FicheScenes<E>) => readonly { sceneId?: string; detail: string }[];
}

/** Ce qu'un format déclare pour utiliser la fiche de scènes commune. */
export interface ExtensionFormat<E, C = unknown, G = unknown> {
  /** Identifiant du format ; la fiche doit porter le même `formatId`. */
  formatId: string;
  /** Schéma d'UN élément de scène (union discriminée par type, en général). Il doit lui aussi être exact. */
  schemaElement: z.ZodType<E>;
  regles: readonly RegleFormat<E>[];
  /**
   * Ajout pur, FACULTATIF : schéma d'UN écran d'une scène (champ `ecrans` de la scène, 1 ou 2 écrans). Absent : le
   * champ `ecrans` est refusé comme tout champ inconnu (comportement d'avant).
   */
  schemaEcran?: z.ZodType<C>;
  /**
   * Ajout pur, FACULTATIF (14/10/2026, tableau animé style « reference/2 ») : schéma du GABARIT d'une scène (champ
   * `gabarit` de la scène : rôle de sa page, numéro d'étape…). Absent : le champ `gabarit` est refusé comme tout champ
   * inconnu (comportement d'avant).
   */
  schemaGabarit?: z.ZodType<G>;
  /**
   * Ajout pur, FACULTATIF : bornes communes propres à une fiche (par exemple plus de pages pour un style donné), lues
   * sur la fiche déjà conforme au schéma. Absent : `BORNES_FICHE`.
   */
  bornes?: (fiche: FicheScenes<E, C, G>) => Partial<BornesFiche>;
}

/** Écrans d'une scène au plus (le premier part avec la scène, le second à un mot de la scène). */
export const ECRANS_PAR_SCENE_MAX = 2;

/** Texte obligatoire, refusé s'il est vide ou fait seulement d'espaces (jamais rogné). */
export const texteObligatoire = (max?: number) => {
  const base = z.string().refine((s) => s.trim().length > 0, { message: "le texte est vide" });
  return max === undefined ? base : base.refine((s) => s.length <= max, { message: `${max} caractères au plus` });
};

/** Identifiant rangé dans une clé de stockage : lettres, chiffres, tiret et soulignement seulement. */
export const identifiantSur = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,120}$/, { message: "lettres, chiffres, tiret ou soulignement seulement (120 au plus)" });

const milliseconde = z.number().int().nonnegative();

/** Schéma d'une scène pour un schéma d'élément donné. Les bornes du nombre d'éléments sont vérifiées par `valider.ts`. */
export function schemaScene<E, C = unknown, G = unknown>(schemaElement: z.ZodType<E>, schemaEcran?: z.ZodType<C>, schemaGabarit?: z.ZodType<G>) {
  const base = {
    id: z.string(),
    role: z.enum(ROLES_SCENE),
    page: z.number().int(),
    texteDit: texteObligatoire(),
    elements: z.array(schemaElement),
    debutMs: milliseconde.optional(),
    finMs: milliseconde.optional(),
  };
  return z.strictObject({
    ...base,
    ...(schemaEcran ? { ecrans: z.array(schemaEcran).min(1).max(ECRANS_PAR_SCENE_MAX).optional() } : {}),
    ...(schemaGabarit ? { gabarit: schemaGabarit.optional() } : {}),
  });
}

/**
 * Schéma de la fiche entière pour un schéma d'élément donné. Les règles d'ordre et de bornes (identifiants, nombre de
 * scènes, nombre d'éléments, pages) ne sont pas ici : `valider.ts` les vérifie pour nommer la scène fautive.
 */
export function schemaFicheScenes<E, C = unknown, G = unknown>(schemaElement: z.ZodType<E>, schemaEcran?: z.ZodType<C>, schemaGabarit?: z.ZodType<G>): z.ZodType<FicheScenes<E, C, G>> {
  return z.strictObject({
    version: z.literal(VERSION_FICHE_SCENES),
    formatId: identifiantSur,
    videoId: identifiantSur,
    versionId: identifiantSur,
    habillage: texteObligatoire(),
    stylo: texteObligatoire(),
    ratio: z.enum(RATIOS_FICHE),
    structure: z.enum(STRUCTURES_FICHE),
    serie: z.strictObject({ code: texteObligatoire(), nom: texteObligatoire() }),
    douleur: texteObligatoire(BORNES_FICHE.douleurMax),
    gesteMinute: texteObligatoire(BORNES_FICHE.gesteMinuteMax),
    appelId: texteObligatoire().nullable(),
    styleTableau: z.string().max(40).optional(),
    scenes: z.array(schemaScene(schemaElement, schemaEcran, schemaGabarit)),
  }) as unknown as z.ZodType<FicheScenes<E, C, G>>;
}
