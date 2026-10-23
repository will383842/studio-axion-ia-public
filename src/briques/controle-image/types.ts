/**
 * CONTRÔLE DE L'IMAGE FINALE (pièce L du plan, ORG-13) : types communs. PUR, neutre : aucun format nommé.
 * Ne remplace pas `briqueControleQualite` (simulation, `src/briques/index.ts`), qui reste inchangée.
 */

/** Issue d'un contrôle : « non-fait » = la brique n'a pas pu tourner (mesure absente, erreur) ; n'empêche pas la livraison. */
export type EtatControle = "reussi" | "echoue" | "non-fait";

export type IdControle =
  | "volume"
  | "crete"
  | "image-noire"
  | "image-figee"
  | "duree"
  | "note-qualite"
  | "zone-sure"
  | "bande-sous-titres"
  | "taille-texte"
  | "contraste"
  | "premiere-image";

export interface ResultatControle {
  id: IdControle;
  /** Nom court affiché (français, sans sigle). */
  libelle: string;
  /** Bloquant : un échec empêche le verdict « livrable ». Indicatif : signalé seulement. */
  bloquant: boolean;
  etat: EtatControle;
  /** Raison en français, sans sigle. */
  raison: string;
}

/**
 * Mesures du fichier exporté telles que la composition `complet` les rend (`{ mesures: Record<string, number> }`,
 * `studio-rendu/src/operations/composition.ts`, étapes 7 et 7 bis). Clés lues : `lufs`, `creteVraieDbtp`,
 * `imageNoireTete`, `dureeSec`, `vmaf`, `vmafSeuil` ; `imagesNoiresHorsFin` et `imagesFigeesHorsFin` sont lues si
 * elles existent (pas encore mesurées : le contrôle des images figées est alors « non fait »).
 */
export type MesuresExport = Readonly<Record<string, number | undefined>>;

/** Rôle d'une boîte : `texte` (tout écrit), `accroche` (texte de la première image), `marque` (souligné, cadre, coche). */
export type RoleBoite = "texte" | "accroche" | "marque";

/** Une boîte posée sur l'image. Positions et tailles en FRACTIONS de l'image (0 à 1), origine en haut à gauche. */
export interface Boite {
  role: RoleBoite;
  /** Texte affiché (absent pour une marque). */
  texte?: string;
  /** Taille du texte en fraction de la HAUTEUR de l'image (absent pour une marque). */
  taille?: number;
  /** Couleur du texte, ou du trait pour une marque (`#RGB` ou `#RRGGBB`). */
  couleur: string;
  /** Couleur du fond sous la boîte. */
  fond: string;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  /** Instant d'apparition (s) ; 0 = présente sur la première image. */
  debutSec: number;
}

export interface MiseEnPage {
  boites: Boite[];
}

/** Zone sûre en FRACTIONS de l'image (marges à laisser libres de chaque côté). */
export interface ZoneSure {
  haut: number;
  droite: number;
  bas: number;
  gauche: number;
}

/** Seuils, tous injectables ; valeurs par défaut dans `SEUILS_CONTROLE_IMAGE`. */
export interface SeuilsControleImage {
  volumeCible: number;
  volumeTolerance: number;
  creteMax: number;
  dureeMaxSec: number;
  tailleTexteMin: number;
  contrasteTexteMin: number;
  contrasteMarqueMin: number;
  accrocheMotsMax: number;
  /** Hauteur de la bande des sous-titres, en fraction de la hauteur, prise en bas de la zone sûre. */
  bandeSousTitres: number;
}

export interface RapportControleImage {
  controles: ResultatControle[];
  /** « bloque » dès qu'un contrôle bloquant échoue ; un contrôle non fait ne bloque pas. */
  verdict: "livrable" | "bloque";
  nonFaits: number;
  /** Phrase courte : « Livrable », « Livrable — 1 élément non fait », « Bloqué : 2 contrôles échoués ». */
  resume: string;
}
