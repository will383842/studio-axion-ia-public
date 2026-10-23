/**
 * GARDE-FOU DE VARIÉTÉ VISUELLE — BRIQUE COMMUNE (organisation du studio, ligne M ; tâche ORG-14). Types PURS.
 *
 * La brique ne regarde que le VISUEL (structure, dessins, accroche affichée). La variété du texte dit reste aux
 * contrôles de script existants (`src/domaine/controles-script/diversite.ts`) : ils ne sont ni touchés ni recopiés.
 * Aucun format n'est nommé ici : le format est une simple étiquette fournie par l'appelant.
 */

/** Ce qui se voit d'une vidéo. */
export interface ResumeVisuel {
  /** Structure du récit (par exemple « erreur-corrigee »). Texte libre : la brique ne connaît aucune liste. */
  structure: string;
  /** Identifiants des dessins posés dans la vidéo, dans l'ordre. */
  dessins: string[];
  /** Texte de l'accroche affichée à l'écran. */
  accroche: string;
  /** Étiquette du format de la vidéo ; seules les vidéos du même format sont comparées. */
  format: string;
}

/** Réglages. Tous ont une valeur prudente par défaut (`SEUILS_VARIETE_DEFAUT`). */
export interface SeuilsVariete {
  /** Nombre de vidéos récentes lues (les plus récentes d'abord). */
  historique: number;
  /** Nombre de dernières vidéos dont la structure est interdite. */
  structuresInterdites: number;
  /**
   * Part (0 à 1) des dessins de la nouvelle vidéo déjà présents dans UNE même vidéo récente. Refus à partir de ce
   * seuil (inclus).
   */
  dessinsCommunsMax: number;
  /** Ressemblance (0 à 1) entre deux accroches, mesurée sur les mots. Refus à partir de ce seuil (inclus). */
  accrocheProcheMax: number;
}

export const SEUILS_VARIETE_DEFAUT: SeuilsVariete = {
  historique: 10,
  structuresInterdites: 2,
  dessinsCommunsMax: 0.6,
  accrocheProcheMax: 0.7,
};

export type RegleVariete = "structure" | "dessins" | "accroche";

/** Un refus : la règle et un message complet en français, sans sigle. */
export interface RefusVariete {
  regle: RegleVariete;
  message: string;
}

/** Geste motivé qui lève les refus. Un motif vide ou fait d'espaces ne lève rien. */
export interface LeveeVariete {
  motif: string;
  /** Qui a levé le refus (pour la trace). */
  auteur?: string;
}

export interface OptionsVariete {
  seuils?: Partial<SeuilsVariete>;
  /** Structures possibles pour la proposition, dans l'ordre de préférence en cas d'égalité. */
  structuresPossibles: readonly string[];
  /** Noms lisibles pour les messages (clé = structure). Sinon le tiret devient une espace. */
  nomsLisibles?: Readonly<Record<string, string>>;
  levee?: LeveeVariete;
}

export interface ResultatVariete {
  /** Vrai s'il n'y a aucun refus, ou si les refus ont été levés par un geste motivé. */
  accepte: boolean;
  /** Les refus constatés (conservés même quand ils sont levés, pour la trace). */
  refus: RefusVariete[];
  /** Vrai si des refus existent et ont été levés. */
  leve: boolean;
  /** Motif de la levée, tel que fourni (sans espaces autour). */
  motifLevee?: string;
  /** Structure conseillée pour la prochaine vidéo, `null` si aucune n'est possible. Toujours calculée. */
  proposition: string | null;
}
