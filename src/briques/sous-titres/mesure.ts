/**
 * MESURE RÉELLE de la largeur rendue d'une ligne (B.5) : chasse de chaque caractère lue dans le fichier de la
 * police (`metriques.ts`, généré), et non un nombre de caractères. PUR, sans dépendance : importable par Remotion.
 */
import { CARACTERES, METRIQUES } from "./metriques";

export type NomPolice = "Poppins ExtraBold" | "Poppins Medium" | "Montserrat Black";

export interface OptionsMesure {
  majuscules?: boolean;
  /** Chiffres à chasse fixe (`tnum`) : chaque chiffre prend la chasse du plus large. */
  chiffresTabulaires?: boolean;
  /** Espace entre les mots, en em (le rendu place les mots avec cet écart). */
  espaceMotsEm?: number;
}

const INDEX = new Map<string, number>();
for (let i = 0; i < CARACTERES.length; i++) if (!INDEX.has(CARACTERES[i])) INDEX.set(CARACTERES[i], i);

function chasse(police: NomPolice, c: string): number {
  const m = METRIQUES[police];
  const i = INDEX.get(c) ?? INDEX.get(c.normalize("NFD")[0]) ?? INDEX.get("n")!;
  return m.largeurs[i];
}

function chasseChiffreMax(police: NomPolice): number {
  let max = 0;
  for (const c of "0123456789") max = Math.max(max, chasse(police, c));
  return max;
}

/** Largeur d'un mot, en px, à la taille donnée. */
export function largeurMot(mot: string, police: NomPolice, taillePx: number, options: OptionsMesure = {}): number {
  const m = METRIQUES[police];
  const texte = options.majuscules ? mot.toLocaleUpperCase("fr-FR") : mot;
  const chiffre = options.chiffresTabulaires ? chasseChiffreMax(police) : 0;
  let total = 0;
  for (const c of texte) total += options.chiffresTabulaires && c >= "0" && c <= "9" ? chiffre : chasse(police, c);
  return (total / m.unitesParEm) * taillePx;
}

/** Largeur d'une ligne de mots séparés par l'espace du rendu (0,28 em par défaut), en px. */
export function largeurLigne(mots: string[], police: NomPolice, taillePx: number, options: OptionsMesure = {}): number {
  const espace = (options.espaceMotsEm ?? 0.28) * taillePx;
  return mots.reduce((s, m) => s + largeurMot(m, police, taillePx, options), 0) + espace * Math.max(0, mots.length - 1);
}

/** Taille ramenée pour que la ligne tienne dans `largeurMaxPx` (jamais agrandie). */
export function tailleQuiTient(mots: string[], police: NomPolice, taillePx: number, largeurMaxPx: number, options: OptionsMesure = {}): number {
  const l = largeurLigne(mots, police, taillePx, options);
  return l <= largeurMaxPx ? taillePx : Math.floor((taillePx * largeurMaxPx) / l);
}

/** Hauteur des capitales en px (placement du soulignement et du bandeau). */
export function hauteurCapitales(police: NomPolice, taillePx: number): number {
  const m = METRIQUES[police];
  return (m.hauteurCapitales / m.unitesParEm) * taillePx;
}
