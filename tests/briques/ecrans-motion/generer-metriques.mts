/**
 * Génère `src/briques/ecrans-motion/metriques-anton.ts` et `metriques-inter-gras.ts` : chasse de chaque caractère
 * d'Anton et d'Inter Bold (charte `charte-duo/1`), lue dans les fichiers de police DESSINÉS par le rendu
 * (`studio-rendu/compositions/commune/polices/`).
 * Usage (depuis la racine) : npx tsx tests/briques/ecrans-motion/generer-metriques.mts
 */
import { writeFileSync } from "node:fs";
import { CARACTERES_ECRITURE, FICHIER_INTER, tableDepuis } from "../../tableau/polices/tables";

export const FICHIER_ANTON = "studio-rendu/compositions/commune/polices/Anton-Regular.ttf";

const fichier = (nomConstante: string, police: string, source: string, cible: string) => {
  const texte = [
    "/**",
    ` * MÉTRIQUES RÉELLES d'${police} (écrans du format à deux fonds, charte \`charte-duo/1\`) : chasse de chaque caractère,`,
    ` * en unités de la police, lue dans \`${source}\`.`,
    " * GÉNÉRÉ par tests/briques/ecrans-motion/generer-metriques.mts : ne pas modifier à la main. PUR (lu aussi par Remotion).",
    " */",
    `export const CARACTERES = ${JSON.stringify(CARACTERES_ECRITURE)};`,
    `export const ${nomConstante} = ${JSON.stringify(tableDepuis(source))};`,
    "",
  ].join("\n");
  writeFileSync(cible, texte, "utf8");
};

fichier("ANTON", "Anton", FICHIER_ANTON, "src/briques/ecrans-motion/metriques-anton.ts");
fichier("INTER_GRAS", "Inter Bold", FICHIER_INTER, "src/briques/ecrans-motion/metriques-inter-gras.ts");
console.log("ok", Array.from(CARACTERES_ECRITURE).length);
