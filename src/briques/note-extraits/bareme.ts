/**
 * Barème de la note d'intérêt (X4-04, étude E4 § b.3). Une seule table, pour être réglée. Constantes pures.
 * Aucun bonus de vues (Q-E4-6). Tout éteint : appelée par personne tant que X4-06 n'est pas branchée.
 */
import type { IdPiece } from "@/briques/plan-scenes/catalogue";
import { MONTRE_PAR_PIECE } from "./moments-ecran";
import { SEUILS_PAR_DEFAUT } from "./reglage";
import type { Montre } from "./types";

export const POINTS = {
  interface: 35,
  chiffre: 25,
  demarche: 15,
  geste: 10,
  sourcePropre: 20,
  texteIncruste: -15,
  sujetReconnu: 15,
  sujetAbsent: -10,
  fait: 10,
  motCle: 5,
  duree: 10,
  creuse: -20,
} as const;

/** Points de la famille montrée (texte, visage, inconnu : 0). */
export const POINTS_PAR_MONTRE: Readonly<Record<Montre, number>> = {
  interface: POINTS.interface,
  chiffre: POINTS.chiffre,
  demarche: POINTS.demarche,
  geste: POINTS.geste,
  texte: 0,
  visage: 0,
  inconnu: 0,
};

/** Barème rangé par pièce (les familles du catalogue ne collent pas à l'usage). Une pièce neuve doit recevoir sa ligne (test). */
export const INTERET_PAR_PIECE: Readonly<Record<IdPiece, number>> = Object.fromEntries(
  (Object.entries(MONTRE_PAR_PIECE) as [IdPiece, Montre][]).map(([id, m]) => [id, POINTS_PAR_MONTRE[m]]),
) as Record<IdPiece, number>;

export const SEUIL_GARDE = SEUILS_PAR_DEFAUT.garde;
export const SEUIL_PEUT_ETRE = SEUILS_PAR_DEFAUT.peutEtre;
export const GARDES_MAX_PAR_VIDEO = SEUILS_PAR_DEFAUT.gardesMax;

export const DUREE_BONUS_MIN_SEC = 3;
export const DUREE_BONUS_MAX_SEC = 6;
/** Phrase « creuse » : moins de ce nombre de mots pleins. */
export const MOTS_PLEINS_MIN = 4;

/** Formules d'ouverture / fermeture (à comparer sur un texte normalisé : minuscules, sans accent ni ponctuation). */
export const MOTS_CREUX: readonly string[] = [
  "bonjour", "bonsoir", "salut", "abonnez vous", "abonne toi", "dans cette video", "aujourd hui je vais",
  "n oubliez pas", "a bientot", "merci d avoir regarde", "mettez un pouce", "likez",
];

/** Mots vides français (constante). */
export const MOTS_VIDES: readonly string[] = [
  "de", "du", "des", "d", "la", "le", "les", "l", "un", "une", "en", "et", "a", "au", "aux", "pour", "sur",
  "vos", "votre", "mes", "mon", "ma", "ce", "ces", "dans", "par", "avec", "sans", "vous", "je", "tu", "il",
  "on", "nous", "elle", "ils", "elles", "que", "qui", "est", "sont", "ca", "se", "si", "ou", "mais", "y", "ne", "pas",
];
