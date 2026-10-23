/**
 * TYPES DE LA BRIQUE `motion` : données de chaque modèle d'excellence, mise en page d'une carte et propriétés des
 * compositions Remotion (`studio-rendu/compositions/commune/motion/`). PUR et sans alias « @/ » (lu par Remotion).
 *
 * Toutes les heures (`aSec`) sont RELATIVES AU DÉBUT DE LA CARTE (s) : elles viennent des horodatages au mot de
 * l'aligneur (`calage.ts`), pour que chaque élément apparaisse quand la voix le dit. Absentes : réparties d'office.
 */
import type { NomIcone } from "./icones";
import type { RatioMotion } from "./jetons";
import type { PlacementCarte, StyleMotion } from "./style";

/** Les 6 modèles d'excellence de la v1 (correctif du 09/10). Les modèles 7 à 13 suivront. */
export type IdModeleMotion = "liste" | "chiffre" | "avant-apres" | "ligne-de-temps" | "deux-colonnes" | "titre";

export interface DonneesListe {
  /** Titre de la liste (« Le diagnostic fuite »). */
  titre?: string;
  /** 2 à 5 éléments, chacun apparaît au mot près. */
  elements: { texte: string; icone?: NomIcone; aSec?: number }[];
  /** Pastilles numérotées (1, 2, 3) plutôt que des icônes. Absent : numérotée s'il n'y a aucune icône. */
  numerotee?: boolean;
  /** Instant d'apparition du titre. */
  aSecTitre?: number;
}

export interface DonneesChiffre {
  valeur: number;
  /** Décimales affichées (0 par défaut). */
  decimales?: number;
  /** Texte avant le nombre (« + », « × »). */
  prefixe?: string;
  /** Unité après le nombre (« min », « % », « h »). */
  unite?: string;
  /** Ce que le chiffre veut dire (« pour un diagnostic fuite complet »). */
  libelle: string;
  /** Petit texte au-dessus (« En moyenne »). */
  surTitre?: string;
  /** Valeur de départ du compteur (0 par défaut). */
  depuis?: number;
  icone?: NomIcone;
  /** Instant où le compteur démarre (le mot du chiffre). */
  aSec?: number;
}

export interface ValeurAvantApres {
  valeur: number;
  unite: string;
  /** Légende (« à la main », « avec l'IA »). */
  libelle?: string;
}

export interface DonneesAvantApres {
  titre?: string;
  avant: ValeurAvantApres;
  apres: ValeurAvantApres;
  /** Étiquettes des deux colonnes (« Avant » / « Après » par défaut). */
  etiquetteAvant?: string;
  etiquetteApres?: string;
  /** Écart affiché dans la pastille (« −75 % »). Absent : calculé. Chaîne vide : aucune pastille. */
  ecart?: string;
  /** Instant où « après » arrive (le mot qui le dit). */
  aSecApres?: number;
}

export interface DonneesLigneDeTemps {
  titre?: string;
  /** 3 à 6 étapes ; la ligne avance avec la parole jusqu'à l'étape dite. */
  etapes: { titre: string; detail?: string; icone?: NomIcone; aSec?: number }[];
  /** « etapes » : processus numéroté ; « feuille-de-route » : jalons (Semaine 1, Mois 2…) portés par `detail`. */
  variante?: "etapes" | "feuille-de-route";
}

export interface ColonneComparaison {
  titre: string;
  points: string[];
  icone?: NomIcone;
}

export interface DonneesDeuxColonnes {
  titre?: string;
  gauche: ColonneComparaison;
  droite: ColonneComparaison;
  /** Ce que les deux ont en commun (zone d'intersection). */
  commun: { titre?: string; points: string[] };
  aSecDroite?: number;
  aSecCommun?: number;
}

export interface DonneesTitre {
  /** « titre » : accroche ou titre plein écran (jamais automatique) ; « generique » : carte de fin. */
  variante: "titre" | "generique";
  surTitre?: string;
  titre: string;
  /** Mot (ou groupe) du titre mis en orange. */
  motCle?: string;
  sousTitre?: string;
  /** Générique : lignes qui montent (2 à 5). */
  lignes?: string[];
}

export interface DonneesParModele {
  liste: DonneesListe;
  chiffre: DonneesChiffre;
  "avant-apres": DonneesAvantApres;
  "ligne-de-temps": DonneesLigneDeTemps;
  "deux-colonnes": DonneesDeuxColonnes;
  titre: DonneesTitre;
}

/** Une carte d'un modèle du catalogue, avec ses données. */
export type CarteModele = { [K in IdModeleMotion]: { modele: K; donnees: DonneesParModele[K] } }[IdModeleMotion];

/**
 * Où et comment la carte est posée : plein écran (B-roll animé) ou moitié haute d'un écran partagé (Will en bas).
 * `hauteurVideo` = hauteur de la VIDÉO (les tailles de texte et les zones sûres s'y rapportent, pas à la carte).
 */
export type DispositionCarte = "plein-ecran" | "moitie-haute";

export type MiseEnPageCarte = {
  ratio: RatioMotion;
  largeur: number;
  hauteur: number;
  hauteurVideo: number;
  disposition: DispositionCarte;
  fps: number;
  /** Durée en images (25 i/s). */
  images: number;
  /** Style (lot C2) : absent ou « sobre » = le style validé ; « spectaculaire » = plus d'impact (`style.ts`). */
  style?: StyleMotion;
  /** Placement (lot C2) : absent = « plein » en plein écran (recentré, agrandi), « haut » en moitié haute. */
  placement?: PlacementCarte;
};

/** Propriétés d'une composition de modèle (`MotionListe`…) : la carte et sa mise en page. */
export type ProprietesCarteMotion = CarteModele & MiseEnPageCarte;

/** Propriétés de la composition `CarteSurMesure` : HTML, CSS et timeline GSAP écrits par Claude (déjà contrôlés). */
export type ProprietesCarteSurMesure = MiseEnPageCarte & {
  html: string;
  css: string;
  /**
   * Code de la timeline : il reçoit `gsap`, `racine` (élément de la carte) et `AXION` (jetons, `enregistrer(tl)`), et
   * doit enregistrer UNE timeline en pause (`AXION.enregistrer(tl)`). La carte la cale par `tl.seek(image / 25)`.
   */
  js: string;
  /** Three.js chargé (local) dans l'iframe : 3D en WebGL logiciel. */
  troisD?: boolean;
};
