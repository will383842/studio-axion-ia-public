/** Constantes de la composition VisuelPage : format, marges, tailles de texte (jamais sous 26 px) et couleurs de la charte. */
import { CHARTE_CARROUSEL } from "../../../../src/briques/visuels/charte-carrousel";

export const FORMAT = { largeur: 1080, hauteur: 1350, fps: 25 } as const;
/** Identifiant de la composition dans Remotion (module pur : importable par les scripts sans charger les polices). */
export const ID_COMPOSITION_PAGE = "VisuelPage";
/** Planche des 15 éléments décoratifs (sans propriété, sans texte). */
export const ID_COMPOSITION_DECORS = "VisuelDecors";
export const MARGE = 48;
/** Largeur utile d'une ligne : 1080 − 2 × 48. */
export const LARGEUR_TEXTE = FORMAT.largeur - 2 * MARGE;

/** Plancher de tout texte de la composition. */
export const TAILLE_TEXTE_MIN = 26;

/** Tailles de texte (px) hors titre de page : toutes ≥ 26. */
export const TAILLES = {
  corps: 28,
  carteTitre: 38,
  badge: 30,
  /** Point de la liste numérotée (T06). */
  liste: 36,
  /** Texte d'un panneau avant / après (T08). */
  panneau: 40,
  /** Titre d'une étape (T20). */
  etapeTitre: 38,
  /** Phrase de la page sombre (T21). */
  phrase: 44,
} as const;

/** Mise en page commune des pages à titre : hauteurs (px) du titre et du pied. */
export const PAGE = { hauteurTitre: 310, hauteurPied: 56, ecart: 24 } as const;

/** Ajustement du titre de page : corps cherché par dichotomie entre `min` et `max`, ligne visée à `cible` ± `tolerance`. */
export const TITRE = { min: 90, max: 170, cible: LARGEUR_TEXTE, tolerance: 4, interligne: 1.02 } as const;

/** Largeur visée d'un titre dans une zone mesurée : la ligne la plus large peut dépasser de `tolerance`, jamais de la zone. */
export const LARGEUR_TITRE = LARGEUR_TEXTE - TITRE.tolerance;

export const COULEURS = CHARTE_CARROUSEL.couleurs;

/** Les polices sont chargées par `../polices.ts` (mêmes noms de familles). */
export const POLICE_TITRE = '"Axion Archivo Black", "Archivo Black", sans-serif';
export const POLICE_CORPS = '"Axion JetBrains Mono", "JetBrains Mono", monospace';
