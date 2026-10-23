/**
 * TYPES DU STYLE « blocs/2 » (écrans de la vidéo modèle). PUR, sans alias « @/ » (lu par `studio-rendu`).
 *
 *  - `DescriptionEcran` : ce qu'un écran montre, tiré de la fiche (avec les replis) par la mise en page du moteur ;
 *  - `GeometrieV2` : où vont l'en-tête, la barre des étapes, le contenu, les sous-titres, le crayon au repos, pour un
 *    format de sortie ;
 *  - `EcranPlace` : les boîtes de texte, les formes et les traits posés en pixels (`disposition.ts`) ;
 *  - `PlanEcranV2` : quand chaque chose entre, quand le crayon trace, les bruitages (`animation.ts`).
 */
import type { FondV2 } from "./charte";

export interface PointV2 {
  x: number;
  y: number;
}

export interface RectV2 {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export type MomentV2 = "accroche" | "douleur" | "retournement" | "promesse" | "etape" | "exemple" | "recapitulatif" | "appel";
export type GabaritV2 =
  | "accroche-cases"
  | "accroche-compteur"
  | "constat"
  | "idee-recue"
  | "etape"
  | "liste"
  | "semaine"
  | "exemple"
  | "recapitulatif"
  | "appel-commentaire"
  | "appel-diagnostic"
  /** Fin sans promesse d'envoi (TikTok, Shorts) : `axion-ia.com` en grand, sous la phrase de la fin s'il y en a une. */
  | "appel-site";

/** Un titre (une ligne de la fiche) : son texte, ses mots forts (blocs) et soulignés, barré ou non. */
export interface TitreDecrit {
  /** Identifiant de l'élément « ligne » (heure du calage). */
  id: string;
  texte: string;
  niveau: "titre" | "texte";
  /** Mots en bloc (clés de mot, `cleMotV2`). */
  forts: string[];
  /** Mots soulignés au crayon (clés de mot). */
  soulignes: string[];
  /** Ligne entière soulignée (marque « souligne » ou geste « souligner »). */
  souligneTout: boolean;
  /** Idée reçue : la ligne est barrée (marque « barre » ou geste « barrer »). */
  barre: boolean;
  /** Ligne entourée (marque « entoure » ou geste « entourer »). */
  entoure: boolean;
  /** Identifiant du geste qui marque la ligne (son heure), s'il y en a un. */
  gesteId?: string;
}

export interface ItemDecrit {
  /** Identifiant (heure du calage) : `<scène>~e<k>~<i>`. */
  id: string;
  texte: string;
  detail?: string;
}

export interface DescriptionEcran {
  /** `<scène>~e<k>` */
  id: string;
  sceneId: string;
  moment: MomentV2;
  gabarit: GabaritV2;
  fond: FondV2;
  /** Étiquette de section (null : aucune). */
  etiquette: string | null;
  /** Étape `n` sur `total`. */
  etape: { n: number; total: number; nom: string } | null;
  titres: TitreDecrit[];
  items: ItemDecrit[];
  /** Chiffre de la scène (compteur, nombre de cases). */
  chiffre: { id: string; valeur: string; unite?: string } | null;
  /**
   * Lignes de la preuve (exemple). `lignes` : toutes, dans l'ordre (l'étiquette avant / après vient de leur préfixe,
   * `panneauxExemple`) ; `avant` et `apres` : lecture d'avant, gardée pour les descriptions écrites à la main.
   */
  avantApres: { id: string; avant: string | null; apres: string; lignes?: string[] } | null;
  /** Mention « Exemple illustratif ». */
  mention: boolean;
  /** Coches demandées par la fiche (geste « cocher ») : identifiant du geste. */
  coches: string[];
  /** Appel : le mot à écrire en commentaire. */
  motCommentaire: string | null;
  /** Dernier écran de la vidéo : la signature y vient en grand après la voix. */
  final: boolean;
  /** Premier écran de la vidéo : tout ce qui est écrit est lisible dès la première image. */
  premier: boolean;
  /** Pictogrammes de la fiche dans cet écran (identifiant de l'élément « dessin », dessin de la banque). */
  dessins?: { id: string; dessinId: string }[];
}

/** Disposition générale d'un format : colonne (titres puis corps) ou côte à côte (titres à gauche, corps à droite). */
export type ModeV2 = "colonne" | "cote";

export interface GeometrieV2 {
  largeur: number;
  hauteur: number;
  /** Échelle des tailles (petit côté ÷ 1080). */
  k: number;
  zoneSure: RectV2;
  /** En-tête : étiquette à gauche, signature à droite. */
  tete: RectV2;
  /** Fil de progression sous l'en-tête. */
  fil: RectV2;
  /** Barre des étapes (écrans de la méthode). */
  barre: RectV2;
  /** Contenu sans barre des étapes, et avec. */
  contenu: RectV2;
  contenuEtape: RectV2;
  /** Bande des sous-titres (pastille centrée dedans), en bas de la zone sûre. */
  bande: RectV2;
  /** Crayon au repos : pointe, inclinaison (couché, corps à droite), hauteur de l'image du crayon. */
  repos: { x: number; y: number; angle: number };
  hauteurCrayon: number;
  mode: ModeV2;
  /**
   * Vertical seulement : les TITRES du haut peuvent aller jusqu'à `droite` (px, bord droit) tant qu'ils finissent
   * au-dessus de `basMax` (px) ; plus bas, la marge droite des boutons des réseaux s'applique (`REGLAGES_GEOMETRIE_V2.hautLarge`).
   */
  titresLarges?: { droite: number; basMax: number };
}

/** Comment une chose entre à l'écran. */
export type EntreeV2 = "gauche" | "claque" | "pop" | "monte" | "fondu" | "tombe" | "barre" | "tape" | "aucune";

/** Un texte posé (une rangée d'un titre, un libellé, un mot dans un bloc…). */
export interface TexteV2 {
  id: string;
  texte: string;
  x: number;
  /** Haut de la boîte de la rangée. */
  y: number;
  largeur: number;
  hauteur: number;
  taille: number;
  police: "titre" | "texte";
  couleur: string;
  /** Couleur réellement derrière le texte (fond de l'écran, d'un bloc, d'une carte) : contrôle du contraste. */
  fond: string;
  /** Élément dont l'heure déclenche l'entrée. */
  source: string;
  entree: EntreeV2;
  /** Mot fort (bloc) : l'entrée suit le mot dit, s'il est connu. */
  motCle?: string;
  /** Groupe de titres (écran qui fait défiler ses titres) : le groupe sort quand le suivant entre. */
  groupe?: number;
  /** Avant son heure : caché, en contour (accroche) ou estompé (récapitulatif, liste). */
  avant?: "cache" | "contour" | "estompe";
  /** Alignement du texte dans sa boîte. */
  centre?: boolean;
  /** Pas de contrôle « dans le contenu » (en-tête, signature, sous-titres de fin). */
  horsContenu?: boolean;
  /** Décalage de l'entrée après l'heure de la source (ms). */
  decalageMs?: number;
  /** Rotation (degrés) autour de `pivot` (tampons). */
  rotation?: number;
  pivot?: PointV2;
  /** Début de la rangée (gardé dans la mise en page ; le rendu ne masque plus le texte derrière un volet, dessin 4). */
  masqueX?: number;
  /** Là dès l'arrivée de l'écran, quelle que soit l'heure de sa source (titre principal d'une étape, premier élément). */
  desLArrivee?: boolean;
  /** Comme `FormeV2.attend` : étiquette d'un cadre d'attente, qui arrive avec lui (au plus `ATTENTE_CADRE_MS` avant). */
  attend?: string;
}

export type SorteForme = "bloc" | "carte" | "case" | "pastille" | "barre-sable" | "rond" | "numero" | "jauge" | "deco" | "bouton" | "bulle" | "dessin";

/** Une forme posée (sans texte : le texte d'un bloc est un `TexteV2` à part). */
export interface FormeV2 {
  id: string;
  sorte: SorteForme;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  rayon: number;
  remplissage: string | null;
  contour: string | null;
  epaisseur: number;
  pointille?: boolean;
  /** Ombre portée pleine (cartes). */
  ombre?: string;
  /** Rotation (degrés), autour du centre. */
  rotation?: number;
  opacite?: number;
  source: string;
  entree: EntreeV2;
  groupe?: number;
  avant?: "cache" | "contour" | "estompe" | "pointille";
  /** Pictogramme de la banque (`src/briques/dessins/traces.ts`), tracé en grand dans la forme (sorte « dessin »). */
  dessin?: string;
  /** Texte de décor (contour, sous la bande des sous-titres) : grand mot ou chiffre. */
  deco?: { texte: string; taille: number };
  /** Peut sortir de la zone sûre (décor, carte qui déborde vers le bas) : jamais de texte dedans. */
  horsZone?: boolean;
  /** Décalage de l'entrée après l'heure de la source (ms). */
  decalageMs?: number;
  /** Mot (clé) dont l'heure, si connue, déclenche l'entrée (bloc d'un mot fort). */
  motCle?: string;
  /** Bruitage à l'entrée (numéro d'étape : « toc »). */
  son?: FamilleBruitageV2;
  /** Cadre d'attente (case en pointillés, bulle, carte) : il n'entre qu'au plus `ATTENTE_CADRE_MS` avant ce qu'il
   *  attend (forme, texte ou trait de cet identifiant), jamais un cadre vide plus d'une seconde. */
  attend?: string;
  /** Comme `TexteV2.masqueX` et `TexteV2.desLArrivee`. */
  masqueX?: number;
  desLArrivee?: boolean;
}

export type SorteTrait = "souligne" | "croix" | "coche" | "entoure" | "barre" | "gribouillis" | "fleche";

/** Un trait tracé (par le crayon, sauf le barré qui se pose seul). */
export interface TraitV2 {
  id: string;
  sorte: SorteTrait;
  /** Chemin (polyligne, px) ; la croix et la coche ont plusieurs segments. */
  segments: PointV2[][];
  epaisseur: number;
  couleur: string;
  source: string;
  /** Décalage après l'heure de la source (ms). */
  decalageMs: number;
  dureeMs: number;
  /** Mot (clé) dont l'heure, si connue, déclenche le trait (soulignement d'un mot fort). */
  motCle?: string;
  /** Tracé par le crayon (sinon il se pose seul : barré). */
  crayon: boolean;
  /** Bruitage du trait. */
  son: FamilleBruitageV2 | null;
  groupe?: number;
}

export type FamilleBruitageV2 = "trait" | "toc" | "validation";

/** Ce qu'il faut d'une ligne pour le rendu : rien d'autre que la disposition. */
export interface EcranPlace {
  id: string;
  sceneId: string;
  fond: FondV2;
  moment: MomentV2;
  gabarit: GabaritV2;
  etiquette: string | null;
  etape: { n: number; total: number; nom: string } | null;
  textes: TexteV2[];
  formes: FormeV2[];
  traits: TraitV2[];
  /** Zones utilisées (contrôles) : titres, corps. */
  zoneTitres: RectV2;
  zoneCorps: RectV2;
  /** Nombre de groupes de titres (1 = tous ensemble). */
  groupes: number;
  final: boolean;
  premier: boolean;
  /** Appel : le mot tapé dans la bulle (identifiant du texte). */
  frappe?: { texteId: string; boutonId: string; coche: string };
  /** Taille réduite pour tenir (1 = tailles visées). */
  reduction: number;
}

/** Étapes de la vidéo, pour la barre (nom court, écran où l'étape commence). */
export interface EtapeBarre {
  n: number;
  nom: string;
  ecranId: string;
}

/** Mot dit (voix maître), pour les sous-titres et l'heure des mots forts. */
export interface MotDitV2 {
  mot: string;
  debutMs: number;
  finMs: number;
}

/** Mise en page du style « blocs/2 » (portée par la mise en page du tableau, champ `styleV2`). */
export interface MiseEnPageV2 {
  style: "blocs/2";
  geometrie: GeometrieV2;
  ecrans: EcranPlace[];
  etapes: EtapeBarre[];
}
