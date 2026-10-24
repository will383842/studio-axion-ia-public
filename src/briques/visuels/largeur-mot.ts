/**
 * Largeur d'un mot insécable du texte d'une page de carrousel (ART-1, tour 2), en fonctions PURES : chasses RÉELLES d'Inter Bold (`metriques-inter`),
 * borne haute du texte courant (SemiBold et Medium sont plus étroits). Lues par la porte qualité (MOT_TROP_LONG, AVANT le rendu) et par les
 * gabarits (corps abaissé pour qu'un mot long tienne). Le texte passe d'abord par la typographie française : « mot : » devient un seul bloc
 * insécable (espace insécable devant « : »).
 */
import { CARACTERES_INTER, INTER_BOLD } from "../composition/metriques-inter";
import { typographieFrancaise } from "./typographie-francaise";

const CHASSES = new Map([...CARACTERES_INTER].map((c, i) => [c, INTER_BOLD.largeurs[i] / INTER_BOLD.unitesParEm] as const));
/** Un signe absent de la table compte comme le plus large de la table (choix prudent). */
const CHASSE_MAX = Math.max(...CHASSES.values());
/** Marge de sécurité sur la mesure (versions d'Inter, arrondis du moteur de rendu). */
export const MARGE_MESURE = 1.03;

/** Mots insécables d'un texte affiché : seuls l'espace ordinaire, les blancs de contrôle et les tirets ASCII / U+2010 coupent (choix prudent). */
export function motsInsecables(texte: string): string[] {
  return typographieFrancaise(texte)
    .split(/[ \t\n\r\f]+|(?<=[-‐])/u)
    .filter((m) => m !== "");
}

/** Largeur (px) d'un mot en Inter Bold au corps `taille`, marge de sécurité comprise. */
export function largeurMot(mot: string, taille: number): number {
  let em = 0;
  for (const c of mot) em += c === " " || c === " " ? (CHASSES.get(" ") ?? CHASSE_MAX) : (CHASSES.get(c) ?? CHASSE_MAX);
  return em * taille * MARGE_MESURE;
}

/** Mot le plus large d'un texte au corps `taille` (chaîne vide si le texte est vide). */
export function motLePlusLarge(texte: string, taille: number): { mot: string; largeur: number } {
  return motsInsecables(texte).reduce((a, m) => {
    const l = largeurMot(m, taille);
    return l > a.largeur ? { mot: m, largeur: l } : a;
  }, { mot: "", largeur: 0 });
}

/** Plus grand corps entier ≤ `base` (et ≥ `min`) où le mot le plus large de chaque texte tient dans `largeur` px ; `min` si aucun ne tient. */
export function corpsPourMots(textes: readonly string[], largeur: number, base: number, min: number): number {
  const em = Math.max(0, ...textes.map((t) => motLePlusLarge(t, 1).largeur));
  return em === 0 ? base : Math.max(min, Math.min(base, Math.floor(largeur / em)));
}
