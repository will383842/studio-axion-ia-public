/** Constantes de la composition VisuelPage : format, marges, tailles de texte (jamais sous 26 px) et couleurs de la charte. */
import { CHARTE_CARROUSEL } from "../../../../src/briques/visuels/charte-carrousel";

export const FORMAT = { largeur: 1080, hauteur: 1350, fps: 25 } as const;
/** Identifiant de la composition dans Remotion (module pur : importable par les scripts sans charger les polices). */
export const ID_COMPOSITION_PAGE = "VisuelPage";
/** Planche des 15 éléments décoratifs (sans propriété, sans texte). */
export const ID_COMPOSITION_DECORS = "VisuelDecors";
/** Marge extérieure (ART-1, style C + A : plus d'air) : 64 px de chaque côté, en haut et en bas. */
export const MARGE = 64;
/** Largeur utile d'une ligne : 1080 − 2 × 64. */
export const LARGEUR_TEXTE = FORMAT.largeur - 2 * MARGE;

/** Plancher de tout texte de la composition. */
export const TAILLE_TEXTE_MIN = 26;

/** Tailles de référence (px) du texte hors titres (ART-1) : toutes ≥ 26 ; le texte courant (Inter SemiBold) ≥ 30. Les gabarits les agrandissent avec `k()` pour remplir la page. */
export const TAILLES = {
  corps: 30,
  /** Titre d'un élément (carte, étape, question). */
  elementTitre: 36,
  /** Point d'une liste (T06). */
  liste: 38,
  /** Phrase d'avant / après (T08). */
  panneau: 46,
  /** Sous-titre de couverture. */
  sousTitre: 40,
  /** Phrase de la page sombre (T21). */
  phrase: 46,
} as const;

/** Mise en page commune des pages à titre : hauteurs (px) du titre (deux lignes au plus) et du pied. */
export const PAGE = { hauteurTitre: 250, hauteurPied: 56, ecart: 24 } as const;

/**
 * Ajustement du titre de page : corps cherché par dichotomie entre `min` et `max`, ligne visée à `cible` ± `tolerance`. `interligne` : valeur
 * par défaut des blocs qui n'ont pas d'interligne calculé ; les titres en capitales prennent `interligneCapitales` (jamais une cédille contre
 * un accent). `min` 60 : un titre fait d'un mot long (« PROFESSIONNALISATION ») tient sur la largeur.
 */
export const TITRE = { min: 60, max: 112, cible: LARGEUR_TEXTE, tolerance: 4, interligne: 1.02 } as const;

/** Corps maximal (px) des grands titres du style C : couvertures, message clé, page sombre. */
export const TITRE_MAX_COUVERTURE = 230;
export const TITRE_MAX_MESSAGE = 150;

/**
 * Corps minimal (px) des grands titres qui n'ont pas de place pour 90 px une fois en capitales (plus larges que les minuscules) : couvertures
 * (titre sur trois ou quatre lignes) et message clé de T10 (six lignes). Le corps ajusté reste le plus grand qui tient : ces planchers ne jouent
 * que pour les titres les plus longs, ou faits de mots longs.
 */
export const TITRE_MIN_COUVERTURE = 52;
export const TITRE_MIN_MESSAGE = 56;

/** Largeur visée d'un titre dans une zone mesurée : la ligne la plus large peut dépasser de `tolerance`, jamais de la zone. */
export const LARGEUR_TITRE = LARGEUR_TEXTE - TITRE.tolerance;

export const COULEURS = CHARTE_CARROUSEL.couleurs;

/** Les polices sont chargées par `../polices.ts` (mêmes noms de familles). */
/** Titres : Inter Display Black (900), toujours avec `fontWeight: 900` (`GRAISSE_TITRE`). */
export const POLICE_TITRE = '"Axion Inter Display", "Inter Display", "Inter", sans-serif';
export const GRAISSE_TITRE = 900;
export const POLICE_CORPS = '"Axion Inter", "Inter", sans-serif';
/** Annotations manuscrites (L9) : Kalam Bold, à l'encre, jamais sous `TAILLE_MANUSCRITE`. */
export const POLICE_MANUSCRITE = '"Axion Kalam", "Kalam", cursive';
export const TAILLE_MANUSCRITE = 34;

/** Filet du style éditorial (A) : 2 px, encre. Il remplace les contours de 3-4 px et les ombres décalées (abandonnés en ART-1). */
export const FILET = 2;
/** Surface douce (B, accent ponctuel) : rayon et ombre floue légère (encre à 10 %). */
export const RAYON_DOUX = 24;
export const OMBRE_DOUCE = `0 12px 32px color-mix(in srgb, ${CHARTE_CARROUSEL.couleurs.encre} 10%, transparent)`;
/** Rubrique : Inter Bold en capitales espacées. */
export const INTERLETTRAGE_RUBRIQUE = "0.16em";

/** Le « froid » (colonne SANS, mythe) : encre ATTÉNUÉE en gris, jamais de bleu ; posé sur le blanc de carte (contraste ≈ 7:1, test `l9-gabarits`). */
export const PART_ENCRE_GRIS = 70;
/** Gris du « froid » : mélange de l'encre et du blanc de la charte (aucune couleur hors charte n'est écrite). */
export const GRIS = `color-mix(in srgb, ${CHARTE_CARROUSEL.couleurs.encre} ${PART_ENCRE_GRIS}%, ${CHARTE_CARROUSEL.couleurs.blanc})`;

/** Étiquette de rubrique et signature : corps (px) ≥ plancher. */
export const TAILLE_RUBRIQUE = 28;
export const TAILLE_SIGNATURE = 26;

/**
 * Bord droit (px) de TOUT texte courant des pages : à droite de x = 912, la flèche de LinkedIn (x ≥ 920, y 560-790) et le compteur de Meta
 * (x ≥ 860, y ≥ 1080) recouvrent l'image. Chaque colonne de texte porte `maxWidth = BORD_DROIT_TEXTE − abscisse de début du texte` (`zones.ts`).
 */
export const BORD_DROIT_TEXTE = 912;
/** Largeur visée (px) d'un titre posé à la marge gauche des pages à zones réservées (couvertures, message de T10) : il s'arrête à `BORD_DROIT_TEXTE`, la ligne la plus large peut dépasser de `tolerance` au plus. */
export const LARGEUR_TITRE_BORNE = BORD_DROIT_TEXTE - MARGE - TITRE.tolerance;
/** Zones recouvertes par la plateforme (px, page de 1080 × 1350) : le texte n'y entre jamais ; la mesure du rendu le vérifie. */
export const ZONE_FLECHE = { gauche: 920, haut: 560, bas: 790 } as const;
export const ZONE_COMPTEUR = { gauche: 860, haut: 1080 } as const;
/** Comme `LARGEUR_TITRE_BORNE` pour un titre qui peut descendre sous y = 1080 (couverture B) : il s'arrête avant le compteur de Meta (x ≥ 860). */
export const LARGEUR_TITRE_BAS = ZONE_COMPTEUR.gauche - MARGE - TITRE.tolerance;
