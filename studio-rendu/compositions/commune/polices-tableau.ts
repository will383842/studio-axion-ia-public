/**
 * Écriture « feutre » des trois styles du tableau : Manrope aussi (charte Axion 2026, police unique). Les anciennes
 * polices manuscrites (Permanent Marker, Kalam, Caveat) sont retirées ; le trait de feutre vient du dessin, pas de la police.
 */
import { FAMILLE_CSS } from "../../../src/briques/charte/axion-2026";
import { policeManropePrete } from "../visuels/police-manrope";

export const FAMILLES_POLICES_TABLEAU = { marker: FAMILLE_CSS, kalam: FAMILLE_CSS, caveat: FAMILLE_CSS } as const;

/** Charge Manrope ; la promesse se résout quand la police est prête. */
export function chargerPolicesTableau(): Promise<void> {
  return policeManropePrete();
}
