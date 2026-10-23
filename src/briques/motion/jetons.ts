/**
 * JETONS DE LA CHARTE MOTION — BRIQUE COMMUNE `motion` (plan facecam v4, correctif du 09/10 « qualité extrême et
 * centralisé »). PUR, sans React ni Remotion, et SANS alias « @/ » : lu tel quel par les compositions Remotion de
 * `studio-rendu/compositions/commune/motion/` et par la carte sur mesure (variables CSS injectées dans l'iframe).
 *
 * Ces jetons sont IMPOSÉS à tous les modèles et à toutes les cartes sur mesure : un seul système de design, versionné
 * (`VERSION_CHARTE_MOTION`, à figer dans la recette de chaque vidéo). Poppins dans la vidéo ; l'interface du studio
 * reste en Manrope.
 */

export const VERSION_CHARTE_MOTION = "motion-1";

/** Cadence du studio (toutes les compositions, toutes les cartes). */
export const FPS_MOTION = 25;

/* ------------------------------------------------------------------ */
/* Couleurs                                                              */
/* ------------------------------------------------------------------ */

/** Charte Axion : sombre chaud, orange, crème. Toute autre couleur est refusée dans une carte sur mesure. */
export const COULEURS = {
  /** Fond de la charte (sombre chaud). */
  fond: "#16120F",
  /** Fond profond (coins, vignette, ombres portées). */
  fondProfond: "#0C0A08",
  /** Panneau posé sur le fond (cartes, pastilles). */
  surface: "#211A15",
  /** Panneau relevé (élément actif). */
  surfaceHaute: "#2C221B",
  /** Orange Axion (accent unique). */
  orange: "#C65A2E",
  /** Orange lumineux : lueurs, chiffres sur fond sombre (même teinte, plus clair). */
  orangeVif: "#E07040",
  /** Orange profond : ombres de l'accent, dégradés. */
  orangeProfond: "#8E3B1B",
  /** Crème : texte principal. */
  creme: "#F6EEE0",
  /** Crème atténuée : texte secondaire (≈ 64 %). */
  cremeAttenuee: "#A79E92",
  /** Filets et contours discrets (≈ 14 % de crème). */
  filet: "#3A322B",
} as const;

export type NomCouleur = keyof typeof COULEURS;

/** Couleurs permises (minuscules), pour le contrôle des cartes sur mesure. Le noir et le blanc purs sont refusés. */
export const COULEURS_PERMISES: readonly string[] = Object.values(COULEURS).map((c) => c.toLowerCase());

/** `#RRGGBB` + opacité → `rgba(...)`. */
export function avecOpacite(hex: string, opacite: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, opacite)).toFixed(3)})`;
}

/* ------------------------------------------------------------------ */
/* Typographie                                                           */
/* ------------------------------------------------------------------ */

/** Familles chargées EN LOCAL (Poppins, SIL OFL 1.1) : une famille, cinq graisses. */
export const POLICE_MOTION = "Axion Poppins";
export const GRAISSES = { corps: 500, appui: 600, gras: 700, titre: 800, affiche: 900 } as const;

/**
 * Hiérarchie en 4 tailles, en FRACTION DE LA HAUTEUR DE LA VIDÉO (pas de la carte : une carte en moitié haute garde
 * la même lecture). Plancher absolu : 3 % de la hauteur (garde-fou du plan, B.10).
 */
export const TAILLES = { affiche: 0.088, titre: 0.052, corps: 0.036, legende: 0.03 } as const;
export type NiveauTexte = keyof typeof TAILLES;
export const TAILLE_TEXTE_MIN = 0.03;

/** Interlignage et approche par niveau (les grandes tailles se resserrent). */
export const INTERLIGNE: Record<NiveauTexte, number> = { affiche: 0.98, titre: 1.06, corps: 1.18, legende: 1.25 };
export const APPROCHE_EM: Record<NiveauTexte, number> = { affiche: -0.035, titre: -0.02, corps: -0.005, legende: 0.01 };

/** Taille en px d'un niveau pour une vidéo de `hauteurVideo` px (jamais sous le plancher). */
export function taillePx(niveau: NiveauTexte, hauteurVideo: number): number {
  return Math.round(Math.max(TAILLES[niveau], TAILLE_TEXTE_MIN) * hauteurVideo);
}

/* ------------------------------------------------------------------ */
/* Grille, marges et zones sûres                                         */
/* ------------------------------------------------------------------ */

/**
 * Zones sûres du 9:16 : UNION des zones protégées des réseaux (`src/reseaux` : haut 14 %, droite 18 %, bas 30 %,
 * gauche 6 %), arrondie. Le texte et les éléments porteurs de sens y restent ; le fond, la lumière et les particules
 * débordent librement.
 */
export const ZONES_SURES = {
  "9:16": { haut: 0.14, droite: 0.16, bas: 0.3, gauche: 0.07 },
  "4:5": { haut: 0.06, droite: 0.06, bas: 0.12, gauche: 0.06 },
  "1:1": { haut: 0.06, droite: 0.06, bas: 0.12, gauche: 0.06 },
} as const;
export type RatioMotion = keyof typeof ZONES_SURES;

/** Unité de grille : 1/12 de la largeur utile ; gouttière = une demi-unité. */
export const COLONNES_GRILLE = 12;

/** Rayons et épaisseurs, en fraction de la LARGEUR (1080 px de référence). */
export const FORMES = {
  rayon: 0.034,
  rayonPastille: 0.5,
  trait: 0.0056,
  traitFin: 0.0028,
  ombre: 0.06,
} as const;

/* ------------------------------------------------------------------ */
/* Mouvement : durées, décalages, courbes signature                      */
/* ------------------------------------------------------------------ */

/** Durées types (s). Entrée 300-500 ms, sortie 200-300 ms, décalage entre éléments 60-90 ms. */
export const DUREES = {
  entree: 0.42,
  entreeLongue: 0.5,
  entreeCourte: 0.3,
  sortie: 0.24,
  decalage: 0.075,
  decalageMot: 0.06,
  decalageLettre: 0.022,
  /** Aucun élément ne reste figé plus longtemps (mouvement secondaire obligatoire). */
  figeMax: 1.5,
  /** Une chute (sortie) est obligatoire dans la dernière seconde. */
  chute: 0.36,
  /** Obturateur du flou de mouvement (180° à 25 i/s = 1/50 s). */
  obturateur: 1 / 50,
} as const;

/**
 * Courbes signature (Bézier cubiques CSS) et ressort. `signature` = sortie expo maison (entrée de tous les éléments) ;
 * `anticipation` = léger recul avant le départ ; `sortie` = accélération pour la chute ; `glisse` = déplacements longs
 * (caméra, barre de progression).
 */
export const COURBES = {
  signature: [0.16, 1, 0.3, 1],
  anticipation: [0.36, -0.42, 0.24, 1],
  sortie: [0.7, 0, 0.84, 0],
  glisse: [0.65, 0, 0.35, 1],
  douce: [0.25, 0.1, 0.25, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;
export type NomCourbe = keyof typeof COURBES;

/** Ressorts (raideur, amortissement, masse) : `chute` = petit dépassement (≈ 6 %) puis repos ; `ferme` = sans rebond. */
export const RESSORTS = {
  chute: { raideur: 210, amortissement: 19, masse: 1 },
  souple: { raideur: 120, amortissement: 15, masse: 1 },
  ferme: { raideur: 260, amortissement: 32, masse: 1 },
} as const;
export type NomRessort = keyof typeof RESSORTS;

/** Caméra de la carte : poussée lente (profondeur), 3 % par seconde au plus (grammaire de montage, B.19). */
export const CAMERA = { pousseeParSec: 0.012, pousseeMaxParSec: 0.03, parallaxe: [0.35, 0.7, 1] as const } as const;

/* ------------------------------------------------------------------ */
/* Export des jetons en variables CSS (carte sur mesure)                 */
/* ------------------------------------------------------------------ */

/** Variables CSS imposées à une carte sur mesure (`--axion-orange`…), calculées pour une vidéo `largeur × hauteur`. */
export function variablesCss(largeur: number, hauteur: number): Record<string, string> {
  const v: Record<string, string> = {};
  for (const [nom, valeur] of Object.entries(COULEURS)) v[`--axion-${nom.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`] = valeur;
  for (const n of Object.keys(TAILLES) as NiveauTexte[]) v[`--axion-taille-${n}`] = `${taillePx(n, hauteur)}px`;
  v["--axion-police"] = `"${POLICE_MOTION}", sans-serif`;
  v["--axion-rayon"] = `${Math.round(FORMES.rayon * largeur)}px`;
  v["--axion-trait"] = `${Math.max(2, Math.round(FORMES.trait * largeur))}px`;
  v["--axion-courbe"] = `cubic-bezier(${COURBES.signature.join(", ")})`;
  v["--axion-largeur"] = `${largeur}px`;
  v["--axion-hauteur"] = `${hauteur}px`;
  return v;
}
