/**
 * Poppins du motion design (500 à 900, SIL OFL 1.1), chargée EN LOCAL dans Remotion : aucune dépendance réseau au
 * rendu. Le rendu attend son chargement (`delayRender`) : jamais une image avec une police de secours.
 * Fichiers : `src/briques/motion/polices/` (Fontsource, sous-ensembles latin et latin étendu).
 */
import { continueRender, delayRender } from "remotion";
import { POLICE_MOTION } from "../../../../src/briques/motion/jetons";
import l500 from "../../../../src/briques/motion/polices/poppins-latin-500-normal.woff2";
import l600 from "../../../../src/briques/motion/polices/poppins-latin-600-normal.woff2";
import l700 from "../../../../src/briques/motion/polices/poppins-latin-700-normal.woff2";
import l800 from "../../../../src/briques/motion/polices/poppins-latin-800-normal.woff2";
import l900 from "../../../../src/briques/motion/polices/poppins-latin-900-normal.woff2";
import e500 from "../../../../src/briques/motion/polices/poppins-latin-ext-500-normal.woff2";
import e600 from "../../../../src/briques/motion/polices/poppins-latin-ext-600-normal.woff2";
import e700 from "../../../../src/briques/motion/polices/poppins-latin-ext-700-normal.woff2";
import e800 from "../../../../src/briques/motion/polices/poppins-latin-ext-800-normal.woff2";
import e900 from "../../../../src/briques/motion/polices/poppins-latin-ext-900-normal.woff2";

/** Plages Unicode des deux sous-ensembles (Fontsource). Le latin couvre le français (œ, €, −, espaces fines). */
export const PLAGE_LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
export const PLAGE_LATIN_ETENDU = "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";

const FICHIERS: { graisse: number; latin: string; etendu: string }[] = [
  { graisse: 500, latin: l500, etendu: e500 },
  { graisse: 600, latin: l600, etendu: e600 },
  { graisse: 700, latin: l700, etendu: e700 },
  { graisse: 800, latin: l800, etendu: e800 },
  { graisse: 900, latin: l900, etendu: e900 },
];

let chargement: Promise<void> | null = null;

/** Charge Poppins (5 graisses) une fois par page de rendu. */
export function chargerPolicesMotion(): void {
  if (chargement || typeof document === "undefined") return;
  const attente = delayRender("Polices du motion design");
  chargement = Promise.all(
    FICHIERS.flatMap((f) => [
      new FontFace(POLICE_MOTION, `url(${f.latin}) format("woff2")`, { weight: String(f.graisse), unicodeRange: PLAGE_LATIN }),
      new FontFace(POLICE_MOTION, `url(${f.etendu}) format("woff2")`, { weight: String(f.graisse), unicodeRange: PLAGE_LATIN_ETENDU }),
    ]).map(async (face) => {
      await face.load();
      document.fonts.add(face);
    }),
  ).then(() => continueRender(attente));
}
