/**
 * CHARTE `charte-duo/1` — habillage à deux fonds (nuit et ivoire) du format « Cas concret MD » (valeurs exactes de la
 * vidéo 1). PUR, sans React ni Remotion et SANS alias « @/ » : lu tel quel par `studio-rendu`. FIGÉE (objets gelés) :
 * un changement de charte = une nouvelle version (`charte-duo/2`), jamais une retouche.
 *
 * `charte-video/1` (`charte-video.ts`) et `motion-1` (`src/briques/motion/jetons.ts`) sont distinctes et inchangées.
 * Le contraste se mesure avec `contraste.ts`.
 */

import { FAMILLE_CSS, POLICE, PALETTE } from "../charte/axion-2026";

export const VERSION_CHARTE_DUO = "charte-duo/1";

/** Couleurs par rôle. L'orange est un accent : sur ivoire `orange`, sur nuit `orangeVif`. */
export const COULEURS_DUO = Object.freeze({
  nuit: PALETTE.noir,
  nuitHaut: PALETTE.noir,
  nuitLueur: PALETTE.terracotta,
  ivoire: PALETTE.ivoire,
  ivoireHaut: PALETTE.ivoire,
  encre: PALETTE.noir,
  orange: PALETTE.terracotta,
  orangeVif: PALETTE.orange,
  /** Texte secondaire sur ivoire : le noir (la charte n'a pas de gris pour le texte sur clair). */
  gris: PALETTE.noir,
  grisClair: PALETTE.grisSurNoir,
  /** Plus de vert dans la charte 2026 : l'accent. */
  vert: PALETTE.orange,
  blanc: PALETTE.ivoire,
} as const);

export type RoleCouleurDuo = keyof typeof COULEURS_DUO;

/** Les deux fonds : couleur du fond, du texte, de l'accent et du texte secondaire. */
export const FONDS = Object.freeze({
  sombre: Object.freeze({
    fond: COULEURS_DUO.nuit,
    texte: COULEURS_DUO.ivoire,
    accent: COULEURS_DUO.orangeVif,
    secondaire: COULEURS_DUO.grisClair,
  }),
  ivoire: Object.freeze({
    fond: COULEURS_DUO.ivoire,
    texte: COULEURS_DUO.encre,
    accent: COULEURS_DUO.orange,
    secondaire: COULEURS_DUO.gris,
  }),
});

/**
 * Polices : Manrope seule (charte Axion 2026, SIL OFL 1.1), rangée dans
 * `studio-rendu/compositions/commune/polices/` et chargées PAR FONCTION (`commune/polices.ts`), jamais à l'import.
 * `droit` = identifiant de l'entrée du registre des droits.
 */
export const POLICES_DUO = Object.freeze({
  affiche: Object.freeze({ famille: FAMILLE_CSS, graisse: 800, voulue: POLICE, droit: "police-manrope" }),
  texte: Object.freeze({ famille: FAMILLE_CSS, graisse: 700, voulue: POLICE, droit: "police-manrope" }),
});

/** Plancher (fraction de la hauteur) de tout texte porteur de sens, sauf `etiquette` et `marque`. */
export const TAILLE_PLANCHER_DUO = 0.03;

/** Tailles par niveau, en fraction de la HAUTEUR de la vidéo. */
export const TAILLES_DUO = Object.freeze({
  geant: 0.375,
  affiche: 0.12,
  titre: 0.099,
  ligne: 0.022,
  etiquette: 0.0146,
  marque: 0.0188,
} as const);

export type CouleurFondDuo = { texte: RoleCouleurDuo; fond: RoleCouleurDuo };

/** Seuils de contraste (rapport, 1 à 21) : texte courant 7 ; texte d'affiche (au moins 5 % de la hauteur) 3. */
export const CONTRASTE_TEXTE_DUO_MIN = 7;
export const CONTRASTE_AFFICHE_MIN = 3;

/** Couples (texte, fond) du texte courant : chacun doit atteindre `CONTRASTE_TEXTE_DUO_MIN`. */
export const COUPLES_TEXTE_DUO: readonly CouleurFondDuo[] = Object.freeze([
  Object.freeze({ texte: "ivoire", fond: "nuit" }),
  Object.freeze({ texte: "blanc", fond: "nuit" }),
  Object.freeze({ texte: "grisClair", fond: "nuit" }),
  Object.freeze({ texte: "encre", fond: "ivoire" }),
] as const);

/** Couples du texte d'affiche (au moins 5 % de la hauteur) : chacun doit atteindre `CONTRASTE_AFFICHE_MIN`. */
export const COUPLES_AFFICHE_DUO: readonly CouleurFondDuo[] = Object.freeze([
  Object.freeze({ texte: "orangeVif", fond: "nuit" }),
  Object.freeze({ texte: "orange", fond: "ivoire" }),
  Object.freeze({ texte: "vert", fond: "nuit" }),
  Object.freeze({ texte: "gris", fond: "ivoire" }),
] as const);
