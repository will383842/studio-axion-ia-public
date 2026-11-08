/**
 * CHARTE `charte-duo/1` — habillage à deux fonds (nuit et ivoire) du format « Cas concret MD » (valeurs exactes de la
 * vidéo 1). PUR, sans React ni Remotion et SANS alias « @/ » : lu tel quel par `studio-rendu`. FIGÉE (objets gelés) :
 * un changement de charte = une nouvelle version (`charte-duo/2`), jamais une retouche.
 *
 * `charte-video/1` (`charte-video.ts`) et `motion-1` (`src/briques/motion/jetons.ts`) sont distinctes et inchangées.
 * Le contraste se mesure avec `contraste.ts`.
 */

export const VERSION_CHARTE_DUO = "charte-duo/1";

/**
 * Couleurs par rôle, palette 2026 (V7-03) : ivoire #FAF9F5, noir #141413, terracotta #B23F16 (`orange`, sur ivoire),
 * orange #D97757 et gris #B0AEA5 (`orangeVif`, `grisClair` : sur nuit seulement). Les noms de rôle sont conservés pour
 * les compositions qui les importent ; les rôles `nuitHaut`, `nuitLueur`, `ivoireHaut`, `blanc` valent la couleur de
 * leur fond (plus de dégradé ni de blanc pur). `gris` (texte secondaire sur ivoire) vaut le noir. `vert` (ancien
 * accent vert, supprimé) garde son nom le temps de migrer les plans qui l'importent : il vaut la terracotta.
 */
export const COULEURS_DUO = Object.freeze({
  nuit: "#141413",
  nuitHaut: "#141413",
  nuitLueur: "#141413",
  ivoire: "#FAF9F5",
  ivoireHaut: "#FAF9F5",
  encre: "#141413",
  orange: "#B23F16",
  orangeVif: "#D97757",
  gris: "#141413",
  grisClair: "#B0AEA5",
  vert: "#B23F16",
  blanc: "#FAF9F5",
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
 * Polices : Anton (affiche, SIL OFL 1.1) et Inter Bold (texte, SIL OFL 1.1), rangées dans
 * `studio-rendu/compositions/commune/polices/` et chargées PAR FONCTION (`commune/polices.ts`), jamais à l'import.
 * `droit` = identifiant de l'entrée du registre des droits.
 */
export const POLICES_DUO = Object.freeze({
  affiche: Object.freeze({ famille: "Axion Anton", graisse: 400, voulue: "Anton", droit: "police-anton" }),
  texte: Object.freeze({ famille: "Axion Inter Bold", graisse: 700, voulue: "Inter", droit: "police-inter" }),
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
  Object.freeze({ texte: "gris", fond: "ivoire" }),
] as const);
