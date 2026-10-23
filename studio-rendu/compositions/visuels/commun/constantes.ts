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

/** Tailles de texte (px) hors titre de page : toutes ≥ 26 ; le texte courant (Inter SemiBold) ≥ 30. */
export const TAILLES = {
  corps: 30,
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

/**
 * Corps minimal (px) des grands titres qui n'ont pas de place pour 90 px une fois en capitales (plus larges que les minuscules) : couvertures
 * (titre sur trois ou quatre lignes) et message clé de T10 (six lignes). Le corps ajusté reste le plus grand qui tient : ces planchers ne jouent
 * que pour les titres les plus longs, ou faits de mots longs.
 */
export const TITRE_MIN_COUVERTURE = 72;
export const TITRE_MIN_MESSAGE = 64;

/** Largeur visée d'un titre dans une zone mesurée : la ligne la plus large peut dépasser de `tolerance`, jamais de la zone. */
export const LARGEUR_TITRE = LARGEUR_TEXTE - TITRE.tolerance;

export const COULEURS = CHARTE_CARROUSEL.couleurs;

/** Les polices sont chargées par `../polices.ts` (mêmes noms de familles). */
export const POLICE_TITRE = '"Axion Archivo Black", "Archivo Black", sans-serif';
export const POLICE_CORPS = '"Axion Inter", "Inter", sans-serif';
/** Annotations manuscrites (L9) : Kalam Bold, à l'encre, jamais sous `TAILLE_MANUSCRITE`. */
export const POLICE_MANUSCRITE = '"Axion Kalam", "Kalam", cursive';
export const TAILLE_MANUSCRITE = 34;

/** Ombre décalée ORANGE (L9) : la carte qui porte la bonne réponse (réalité, « avec nous »). */
export const OMBRE_ORANGE = `12px 12px 0 ${CHARTE_CARROUSEL.couleurs.orange}`;
export const OMBRE_ORANGE_DECALAGE = 12;
/** Le « froid » (colonne SANS, mythe) : encre ATTÉNUÉE en gris, jamais de bleu ; posé sur le blanc de carte (contraste ≈ 7:1, test `l9-gabarits`). */
export const PART_ENCRE_GRIS = 70;
/** Gris du « froid » : mélange de l'encre et du blanc de la charte (aucune couleur hors charte n'est écrite). */
export const GRIS = `color-mix(in srgb, ${CHARTE_CARROUSEL.couleurs.encre} ${PART_ENCRE_GRIS}%, ${CHARTE_CARROUSEL.couleurs.blanc})`;

/** Fond clair des cartes impaires (blanc chaud) ; les cartes paires gardent le fond pâle de la charte. */
export const FOND_CARTE_CLAIR = COULEURS.blanc;
/** Ombre décalée pleine (sans flou) d'une carte sur deux ; elle déborde de `OMBRE_DECALAGE` px à droite et en bas : la zone qui porte les cartes réserve cette marge. */
export const OMBRE_DECALAGE = 8;
export const OMBRE_CARTE = `8px 8px 0 ${COULEURS.encre}`;
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
/** Bordure et remplissage (px) d'une carte de la page dense. */
export const BORDURE_CARTE = 4;
export const REMPLISSAGE_CARTE = 22;
