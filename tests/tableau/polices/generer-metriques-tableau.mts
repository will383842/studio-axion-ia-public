/**
 * Génère `src/briques/tableau-scene/trois-styles/metriques.ts` : chasse de chaque caractère des polices du tableau.
 * Depuis le 08/11 (`083d531e`) le rendu dessine les trois styles en Manrope (400 pour `marker` et `caveat`, 700 pour
 * `kalam`) : la mesure lit donc Manrope Medium (mesure prudente du 400 : le fichier variable a pour défaut le poids
 * 200 et il n'y a pas de fichier Regular) et Manrope Bold (exacte pour le 700), dans `src/briques/sous-titres/polices/`.
 * Les tables des anciennes polices manuscrites (Permanent Marker, Kalam Bold, Caveat Brush) sont conservées, non lues.
 * Usage (depuis la racine) : npx tsx tests/tableau/polices/generer-metriques-tableau.mts
 */
import { writeFileSync } from "node:fs";
import { CARACTERES_ECRITURE, tableDepuis } from "./tables";

const P = "studio-rendu/compositions/commune/polices";
const M = "src/briques/sous-titres/polices";
const texte = [
  "/**",
  " * MÉTRIQUES RÉELLES des polices du tableau (chasse de chaque caractère, en unités de la police). Le rendu dessine les",
  " * trois styles en Manrope (400 pour marker et caveat, 700 pour kalam) : MANROPE_MEDIUM (mesure prudente du 400) et",
  " * MANROPE_BOLD (exacte pour le 700), lues dans `src/briques/sous-titres/polices/`. Les tables manuscrites",
  " * (PermanentMarker-Regular.ttf, Kalam-Bold.ttf, CaveatBrush-Regular.ttf, `studio-rendu/compositions/commune/polices/`)",
  " * restent, non lues. GÉNÉRÉ par tests/tableau/polices/generer-metriques-tableau.mts : ne pas modifier à la main.",
  " * PUR (lu aussi par Remotion).",
  " */",
  `export const CARACTERES_TABLEAU = ${JSON.stringify(CARACTERES_ECRITURE)};`,
  `export const PERMANENT_MARKER = ${JSON.stringify(tableDepuis(`${P}/PermanentMarker-Regular.ttf`))};`,
  `export const KALAM_BOLD = ${JSON.stringify(tableDepuis(`${P}/Kalam-Bold.ttf`))};`,
  `export const CAVEAT_BRUSH = ${JSON.stringify(tableDepuis(`${P}/CaveatBrush-Regular.ttf`))};`,
  `export const MANROPE_MEDIUM = ${JSON.stringify(tableDepuis(`${M}/Manrope-Medium.ttf`))};`,
  `export const MANROPE_BOLD = ${JSON.stringify(tableDepuis(`${M}/Manrope-Bold.ttf`))};`,
  "",
].join("\n");
writeFileSync("src/briques/tableau-scene/trois-styles/metriques.ts", texte, "utf8");
console.log("ok", Array.from(CARACTERES_ECRITURE).length);
