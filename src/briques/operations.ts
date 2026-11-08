/**
 * OPÉRATIONS DE RETOUCHE TYPÉES (lot C, PRÉPARATION — non implémentées) : ce que le futur chat de retouche
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

export type OperationRetouche = OperationChangerMot | OperationAjouterChiffre | OperationChangerBrique | OperationDecalerScene | OperationChangerHabillage;
export type TypeOperationRetouche = OperationRetouche["type"];

export const TYPES_OPERATIONS_RETOUCHE = ["changer-mot", "ajouter-chiffre", "changer-brique", "decaler-scene", "changer-habillage"] as const satisfies readonly TypeOperationRetouche[];
