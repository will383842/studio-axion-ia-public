/**
 * C11-T4-a : apparition au mot des sous-titres. Fonctions PURES, sans React ni Remotion, sans horloge ni hasard, imports
 * relatifs seulement (importable par Remotion). Trois pièces :
 *  - `etatMotApparition` : le mot à venir n'existe pas encore (invisible), puis passe du flou au net en 0,2 s ;
 *  - `gabaritContexteMotCle` : un groupe peut s'écrire en petite ligne de contexte + le mot-clé seul, gros, sur sa ligne ;
 *  - `tailleMotCle` / `tailleContexte` : les deux tailles.
 * Éteint : seul `APPARITION_ACTIVE = true` allumerait, et RIEN n'importe ce fichier (le branchement est C11-T4-b). La
 * sortie en fondu de 0,2 s existe déjà (`sortie.ts`) : non refaite ici.
 */
import { FLOU_MAX_PX } from "../motion/texte-effets/effets";
import { largeurMot } from "./mesure";
import { motsAPlaque } from "./pave";

/** Interrupteur : seul `true` allumerait. Éteint ici, rien ne l'allume. */
export const APPARITION_ACTIVE = false;

export const APPARITION = Object.freeze({
  /** Durée de l'entrée flou → net, en secondes. */
  dureeS: 0.2,
  /** Taille du mot-clé seul, en multiple de la taille du groupe. */
  facteurMotCle: 1.6,
  /** Taille de la ligne de contexte, en multiple de la taille du groupe. */
  facteurContexte: 0.7,
  /** Un groupe de moins de 3 mots ne se coupe pas en contexte + mot-clé. */
  motsMin: 3,
});

export interface EtatMotApparition {
  visible: boolean;
  opacite: number;
  flouPx: number;
}

export interface OptionsApparition {
  dureeS?: number;
  flouMaxPx?: number;
}

const NET: EtatMotApparition = Object.freeze({ visible: true, opacite: 1, flouPx: 0 });
const borne = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/**
 * État du mot à l'instant `t` (s) quand il est dit à `debutMot` (s). Avant : invisible (opacité 0 ; la PLACE du mot reste
 * réservée par l'appelant, aucune mesure ne change). De `debutMot` à `debutMot + durée` : opacité 0 → 1 et flou max → 0
 * (plafonné à `FLOU_MAX_PX`, 6 px). Après : net. Une entrée non finie rend le mot net, jamais d'exception.
 */
export function etatMotApparition(t: number, debutMot: number, options: OptionsApparition = {}): EtatMotApparition {
  const duree = options.dureeS ?? APPARITION.dureeS;
  const flouMax = borne(options.flouMaxPx ?? FLOU_MAX_PX, 0, FLOU_MAX_PX);
  if (!Number.isFinite(t) || !Number.isFinite(debutMot) || !Number.isFinite(duree) || !Number.isFinite(flouMax) || duree <= 0) return { ...NET };
  if (t < debutMot) return { visible: false, opacite: 0, flouPx: flouMax };
  const p = borne((t - debutMot) / duree, 0, 1);
  return { visible: true, opacite: p, flouPx: flouMax * (1 - p) };
}

export interface GabaritContexteMotCle {
  /** Indices (dans le groupe) des mots écrits en petite ligne de contexte, dans l'ordre. */
  contexte: number[];
  /** Indice du mot-clé, seul sur sa ligne. */
  cle: number;
}

/**
 * Gabarit « ligne de contexte + mot-clé seul ». Le mot-clé est le premier mot fort du groupe (`motsAPlaque(…, "forts")`,
 * jamais le mot souligné). `null` si aucun mot fort ou si le groupe a moins de 3 mots. Ne lève jamais.
 */
export function gabaritContexteMotCle(segment: { mots: { mot: string }[]; souligne?: number | null }): GabaritContexteMotCle | null {
  try {
    const mots = segment.mots;
    if (!Array.isArray(mots) || mots.length < APPARITION.motsMin) return null;
    const cle = motsAPlaque(segment, "forts")[0];
    if (cle === undefined) return null;
    return { cle, contexte: mots.map((_, i) => i).filter((i) => i !== cle) };
  } catch {
    return null;
  }
}

/**
 * Taille du mot-clé seul : 1,6 × la taille du groupe ; avec `mot` et `largeurLibrePx`, plafonnée pour que le mot tienne
 * dans la zone libre (mesure Manrope ExtraBold, la plus large). 0 si la taille n'est pas un nombre positif.
 */
export function tailleMotCle(taillePx: number, mot?: string, largeurLibrePx?: number): number {
  if (!(taillePx > 0) || !Number.isFinite(taillePx)) return 0;
  const voulue = APPARITION.facteurMotCle * taillePx;
  if (mot === undefined || largeurLibrePx === undefined || !(largeurLibrePx > 0)) return voulue;
  const l = largeurMot(mot, "Manrope ExtraBold", voulue);
  return l <= largeurLibrePx ? voulue : Math.floor((voulue * largeurLibrePx) / l);
}

/** Taille de la ligne de contexte : 0,7 × la taille du groupe. 0 si la taille n'est pas un nombre positif. */
export function tailleContexte(taillePx: number): number {
  if (!(taillePx > 0) || !Number.isFinite(taillePx)) return 0;
  return APPARITION.facteurContexte * taillePx;
}
