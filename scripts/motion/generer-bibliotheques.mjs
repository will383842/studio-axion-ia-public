/**
 * Génère `studio-rendu/compositions/commune/motion/sur-mesure/bibliotheques.genere.ts` : GSAP (et ses plugins),
 * Three.js et Poppins (en `data:`) sous forme de CHAÎNES, injectées dans l'iframe isolée de la carte sur mesure
 * (aucun réseau : la politique de sécurité de l'iframe refuse toute adresse). `node scripts/motion/generer-bibliotheques.mjs`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const vendeur = resolve(racine, "studio-rendu/compositions/commune/motion/sur-mesure/vendeur");
const polices = resolve(racine, "src/briques/motion/polices");
const lire = (f) => readFileSync(resolve(vendeur, f), "utf8");
/** Une balise </script> dans le code fermerait le bloc : on l'échappe. */
const sur = (js) => js.replace(/<\/script/gi, "<\\/script");

const gsap = ["gsap", "CustomEase", "DrawSVGPlugin", "MorphSVGPlugin", "MotionPathPlugin", "SplitText"].map((f) => sur(lire(`${f}.min.js`))).join("\n;\n");
const trois = sur(lire("three.min.js"));
const PLAGES = {
  latin: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
  "latin-ext": "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
};
const faces = [];
for (const graisse of [500, 600, 700, 800, 900]) {
  for (const [sous, plage] of Object.entries(PLAGES)) {
    const b64 = readFileSync(resolve(polices, `poppins-${sous}-${graisse}-normal.woff2`)).toString("base64");
    for (const famille of ["Axion Poppins", "Poppins"]) faces.push(`@font-face{font-family:"${famille}";font-weight:${graisse};font-style:normal;src:url(data:font/woff2;base64,${b64}) format("woff2");unicode-range:${plage}}`);
  }
}
writeFileSync(
  resolve(racine, "studio-rendu/compositions/commune/motion/sur-mesure/bibliotheques.genere.ts"),
  `/* FICHIER GÉNÉRÉ par scripts/motion/generer-bibliotheques.mjs — ne pas modifier. Licences : ./vendeur/LICENCES.md */
/** GSAP 3.13 et ses plugins (CustomEase, DrawSVG, MorphSVG, MotionPath, SplitText). */
export const GSAP_JS = ${JSON.stringify(gsap)};
/** three.js r159 (UMD : \`window.THREE\`). */
export const TROIS_D_JS = ${JSON.stringify(trois)};
/** Poppins 500-900 en \`data:\` (familles « Axion Poppins » et « Poppins »). */
export const POLICES_CSS = ${JSON.stringify(faces.join("\n"))};
`,
);
console.log("bibliothèques écrites");
