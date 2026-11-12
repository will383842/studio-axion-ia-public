/** Table pure (sans remotion) des lueurs de l'axe fond. */
import type { Fond as NomFond } from "../../../../../src/briques/ecrans-motion";
import type { CodesParAxe } from "../../../../../src/briques/schema-motion/variete";

/** Indice de lueur (`plans/fond-fort.ts`, LUEURS) de chaque code, par fond : sombre 5 positions, ivoire 3. */
export const LUEUR_DU_CODE_FOND: Readonly<Record<NomFond, Readonly<Record<CodesParAxe["fond"], number>>>> = Object.freeze({
  sombre: Object.freeze({ "FON-A": 0, "FON-B": 1, "FON-C": 2, "FON-D": 3, "FON-E": 4 }),
  ivoire: Object.freeze({ "FON-A": 0, "FON-B": 1, "FON-C": 2, "FON-D": 1, "FON-E": 2 }),
});
