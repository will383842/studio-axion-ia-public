/** Tableau animé : code local → valeur commune. Codes importés de `tableau-scene/trois-styles/styles.ts` (lecture seule). */
import { STYLES_TABLEAU } from "@/briques/tableau-scene/trois-styles/styles";
import type { AxeCommun } from "../types";

const habillage = {
  "tableau-blanc": "tableau-blanc",
  ardoise: "ardoise",
  paperboard: "paperboard",
} as const satisfies Record<(typeof STYLES_TABLEAU)[number], string>;

export const TABLE_TABLEAU: Readonly<Partial<Record<AxeCommun, Readonly<Record<string, string>>>>> = Object.freeze({ habillage });
