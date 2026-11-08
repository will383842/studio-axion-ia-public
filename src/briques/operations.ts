/**
 * OPÉRATIONS DE RETOUCHE TYPÉES (lot C, appliquées par le chat de retouche du lot R1 : `services/retouche-chat/`) : ce que le chat de retouche
 * produira à partir d'une phrase de Williams. Chaque opération vise une scène du plan (`ScenePlan.id`) ou tout
 * l'habillage ; l'appliquer donnera un nouveau plan, revalidé (`validerPlan`), dont seules les scènes à l'empreinte
 * changée seront re-rendues (`scenesARerendre`). Le script de Williams fait foi : « changer un mot » ne touche que le
 * texte À L'ÉCRAN, jamais le texte lu.
 */
import type { IdPiece } from "./plan-scenes/catalogue";
import type { HabillagePlan } from "./plan-scenes/schema";
import type { Position, Transition } from "./plan-scenes/zones";

/** Changer un mot du texte à l'écran d'une scène (texte de la scène ou d'un paramètre de sa pièce). */
export interface OperationChangerMot {
  type: "changer-mot";
  sceneId: string;
  ancien: string;
  nouveau: string;
  /** Chemin du champ visé (ex. « texte », « parametres.libelle », « calques.2.parametres.texte ») ; absent : le premier trouvé. */
  champ?: string;
}

/** Ajouter un chiffre à l'écran (une carte KPI en calque, ou en pièce si la scène n'a qu'une légende). */
export interface OperationAjouterChiffre {
  type: "ajouter-chiffre";
  sceneId: string;
  valeur: number;
  libelle: string;
  prefixe?: string;
  suffixe?: string;
  /** Zone du calque dans la scène (défaut : « droite »). */
  zone?: Position;
}

/** Changer la brique d'une scène (la scène repasse au niveau 1 avec cette pièce ; paramètres réparés par le validateur). */
export interface OperationChangerBrique {
  type: "changer-brique";
  sceneId: string;
  piece: IdPiece;
  parametres?: Record<string, unknown>;
}

/** Décaler une scène : en mots du script (recalage exact) ou en millisecondes. */
export interface OperationDecalerScene {
  type: "decaler-scene";
  sceneId: string;
  /** Nouveaux mots couverts (indices du minutage). */
  mots?: { premier: number; dernier: number };
  /** Décalage en ms (positif : plus tard), arrondi au mot le plus proche. */
  decalageMs?: number;
}

/** Changer l'habillage de toute la vidéo (fond, accent) ou la transition d'une scène. */
export interface OperationChangerHabillage {
  type: "changer-habillage";
  habillage?: Partial<HabillagePlan>;
  /** Transition d'une scène précise. */
  transition?: { sceneId: string; entree?: Transition; sortie?: Transition; dureeMs?: number };
  /** Position d'une scène précise (jamais devant le visage en face caméra : le validateur y veille). */
  position?: { sceneId: string; position: Position };
}

/* Lot R1 (chat de retouche) : opérations ajoutées. */

/** Ajouter une pièce en calque à une scène (la scène passe au niveau 2 ; sa pièce d'avant reste dessous). */
export interface OperationAjouterPiece {
  type: "ajouter-piece";
  sceneId: string;
  piece: IdPiece;
  parametres?: Record<string, unknown>;
  zone?: Position;
  /** Décalage depuis le début de la scène (ms). */
  debutMs?: number;
}

/** Retirer d'une scène les calques d'une pièce (plus aucun calque : la scène repasse au niveau 1). */
export interface OperationRetirerPiece {
  type: "retirer-piece";
  sceneId: string;
  piece: IdPiece;
}

/** Remplacer une pièce par une autre dans une scène (pièce principale ou calques), paramètres réparés par le validateur. */
export interface OperationRemplacerPiece {
  type: "remplacer-piece";
  sceneId: string;
  ancienne: IdPiece;
  nouvelle: IdPiece;
  parametres?: Record<string, unknown>;
}

/** Changer la transition d'une scène, ou de toutes (`sceneId` absent). */
export interface OperationChangerTransition {
  type: "changer-transition";
  sceneId?: string;
  entree?: Transition;
  sortie?: Transition;
  dureeMs?: number;
}

/** Ajouter du dynamisme à des scènes EXISTANTES (zoom caméra doux + transition plus vive) ; `sceneIds` absent : toutes. */
export interface OperationAjouterDynamisme {
  type: "ajouter-dynamisme";
  sceneIds?: string[];
  intensite: "leger" | "fort";
}

/** Régler le zoom caméra d'une scène (« zoom plus doux sur le bouton ») : facteur, cible, moment. */
export interface OperationAjusterZoom {
  type: "ajuster-zoom";
  sceneId: string;
  facteur?: number;
  cible?: { x: number; y: number };
  moment?: number;
}

/**
 * Modifier le TEXTE LU (script de Williams). Seule opération qui touche la voix ; gardée seulement si la phrase de
 * Williams demande explicitement de modifier le script.
 */
export interface OperationModifierScript {
  type: "modifier-script";
  ancien: string;
  nouveau: string;
}

export type OperationRetouche =
  | OperationChangerMot
  | OperationAjouterChiffre
  | OperationChangerBrique
  | OperationDecalerScene
  | OperationChangerHabillage
  | OperationAjouterPiece
  | OperationRetirerPiece
  | OperationRemplacerPiece
  | OperationChangerTransition
  | OperationAjouterDynamisme
  | OperationAjusterZoom
  | OperationModifierScript;
export type TypeOperationRetouche = OperationRetouche["type"];

export const TYPES_OPERATIONS_RETOUCHE = [
  "changer-mot",
  "ajouter-chiffre",
  "changer-brique",
  "decaler-scene",
  "changer-habillage",
  "ajouter-piece",
  "retirer-piece",
  "remplacer-piece",
  "changer-transition",
  "ajouter-dynamisme",
  "ajuster-zoom",
  "modifier-script",
] as const satisfies readonly TypeOperationRetouche[];
