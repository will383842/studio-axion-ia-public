import type { CSSProperties } from "react";
import { COULEURS, FOND_CARTE_CLAIR, OMBRE_CARTE } from "./constantes";

/** Fond et ombre d'une carte selon son rang (à partir de 1) : rang impair = fond blanc + ombre décalée, rang pair = fond pâle, à plat. */
export function styleCarte(rang: number): Pick<CSSProperties, "background" | "boxShadow"> {
  return rang % 2 === 1 ? { background: FOND_CARTE_CLAIR, boxShadow: OMBRE_CARTE } : { background: COULEURS.pale };
}
