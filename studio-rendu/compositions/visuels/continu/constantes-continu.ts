/** Constantes de la toile continue : géométrie (reprise du domaine), polices et tailles de texte de la maquette v3 (jamais sous 26 px). PUR. */
export { BANDE_COUTURE, COIN_RESERVE, coutures, HAUTEURS, LARGEUR_PAGE, largeurToile, MARGE_SURE, type FormatToile } from "../../../../src/domaine/visuels/continu/geometrie";

export const FPS_TOILE = 25;

/** En 3:4, la page gagne 90 px : le calque d'un parcours est décalé de la moitié. */
export const DECALAGE_PARCOURS_34 = 45;

export const FAMILLE_BRICOLAGE = "Axion Bricolage";
export const FAMILLE_INSTRUMENT = "Axion Instrument Serif";

/**
 * Tailles (px) de la maquette : `.p` 38, `.sm` 31, `.bub` 34, `.pill` 28 ; `.lb`, `.chip`, `.tagx` (22 à 24) et `.foot` (25) passent à
 * 26 : plancher de tout texte mesuré.
 */
export const TAILLES_CONTINU = { p: 38, sm: 31, bub: 34, pill: 28, lb: 26, chip: 26, tagx: 26, foot: 26, marque: 46 } as const;

/** Mise en page de l'en-tête et du pied (maquette : `.pg` padding 84 px, `.top` 60 px, `.foot` à 58 px du bas). */
export const ENTETE = { haut: 84, hauteur: 60 } as const;
export const PIED = { bas: 58, ecart: 22, rail: 5 } as const;
/** Carreau du grain (motif SVG carrelé). */
export const CARREAU_GRAIN = 260;
