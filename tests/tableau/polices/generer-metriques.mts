/**
 * Génère `src/briques/stylo/metriques-ecriture.ts` : chasse de chaque caractère de Montserrat ExtraBold, d'Inter Bold et d'Inter Medium,
 * lue dans les fichiers de police DESSINÉS par le rendu (`studio-rendu/compositions/commune/polices/`).
 * Usage (depuis la racine) : npx tsx tests/tableau/polices/generer-metriques.mts
 */
import { writeFileSync } from "node:fs";
import { CARACTERES_ECRITURE, FICHIER_INTER, FICHIER_INTER_MEDIUM, FICHIER_MONTSERRAT, tableDepuis } from "./tables";

const texte = [
  "/**",
  " * MÉTRIQUES RÉELLES des polices écrites au stylo (tableau animé) : chasse de chaque caractère, en unités de la police,",
  " * lue dans `studio-rendu/compositions/commune/polices/` (Montserrat-ExtraBold.ttf, Inter-Bold.ttf, Inter-Medium.ttf).",
  " * GÉNÉRÉ par tests/tableau/polices/generer-metriques.mts : ne pas modifier à la main. PUR (lu aussi par Remotion).",
  " */",
  `export const CARACTERES_ECRITURE = ${JSON.stringify(CARACTERES_ECRITURE)};`,
  `export const MONTSERRAT_EXTRABOLD = ${JSON.stringify(tableDepuis(FICHIER_MONTSERRAT))};`,
  `export const INTER_BOLD = ${JSON.stringify(tableDepuis(FICHIER_INTER))};`,
  `export const INTER_MEDIUM = ${JSON.stringify(tableDepuis(FICHIER_INTER_MEDIUM))};`,
  "",
].join("\n");
writeFileSync("src/briques/stylo/metriques-ecriture.ts", texte, "utf8");
console.log("ok", Array.from(CARACTERES_ECRITURE).length);
