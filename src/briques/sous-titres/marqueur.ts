/**
 * Préréglages du surlignage « marqueur » (C2-U5) : paires de la charte seulement (`PAIRES_TEXTE`).
 * Pur, lu par le rendu : aucun alias `@/`. `SURLIGNAGE_CAS_CONCRET` n'est pas remplacé.
 */
import { PALETTE } from "../charte/axion-2026";
import type { SurlignageSousTitres } from "./scene";
import type { TeinteMarqueurRendu } from "./types-rendu";

export const MARQUEURS: Readonly<Record<TeinteMarqueurRendu, SurlignageSousTitres>> = Object.freeze({
  terracotta: Object.freeze({ fond: PALETTE.terracotta, texte: PALETTE.blanc }),
  ivoire: Object.freeze({ fond: PALETTE.ivoire, texte: PALETTE.noir, fondClair: PALETTE.noir, texteClair: PALETTE.ivoire }),
  ardoise: Object.freeze({ fond: PALETTE.noir, texte: PALETTE.orange }),
});
