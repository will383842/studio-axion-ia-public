/**
 * Génère `src/briques/tableau-scene/trois-styles/metriques.ts` : chasse de chaque caractère des trois polices
 * manuscrites des styles du tableau (Permanent Marker, Kalam Bold, Caveat Brush), lue dans les fichiers DESSINÉS par le
 * rendu (`studio-rendu/compositions/commune/polices/`).
 * Usage (depuis la racine) : npx tsx tests/tableau/polices/generer-metriques-tableau.mts
 */
import { writeFileSync } from "node:fs";
import { CARACTERES_ECRITURE, tableDepuis } from "./tables";

const P = "studio-rendu/compositions/commune/polices";
const texte = [
  "/**",
  " * MÉTRIQUES RÉELLES des polices manuscrites des trois styles du tableau (chasse de chaque caractère, en unités de la",
  " * police), lues dans `studio-rendu/compositions/commune/polices/` (PermanentMarker-Regular.ttf, Kalam-Bold.ttf,",
  " * CaveatBrush-Regular.ttf). GÉNÉRÉ par tests/tableau/polices/generer-metriques-tableau.mts : ne pas modifier à la",
  " * main. PUR (lu aussi par Remotion).",
  " */",
  `export const CARACTERES_TABLEAU = ${JSON.stringify(CARACTERES_ECRITURE)};`,
  `export const PERMANENT_MARKER = ${JSON.stringify(tableDepuis(`${P}/PermanentMarker-Regular.ttf`))};`,
  `export const KALAM_BOLD = ${JSON.stringify(tableDepuis(`${P}/Kalam-Bold.ttf`))};`,
  `export const CAVEAT_BRUSH = ${JSON.stringify(tableDepuis(`${P}/CaveatBrush-Regular.ttf`))};`,
  "",
].join("\n");
writeFileSync("src/briques/tableau-scene/trois-styles/metriques.ts", texte, "utf8");
console.log("ok", Array.from(CARACTERES_ECRITURE).length);
