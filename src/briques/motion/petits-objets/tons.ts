/** Un objet reçoit un TON, jamais une couleur. Seules couleurs possibles : celles de la charte. */
import { accentSur, couleursSur, type FondAxion } from "../../jetons-motion";
import { PALETTE } from "../../charte/axion-2026";
import type { TonObjet } from "./contrat";

/** G1 / W-K : le passage à `#B8341C` est une fiche à part, sur décision de Williams. */
export const ERREUR_FILET_PERMIS = false;

export function couleurDuTon(ton: TonObjet, fond: FondAxion): string {
  switch (ton) {
    case "accent":
      return accentSur(fond, "orange");
    case "valide":
      return PALETTE.reussite;
    case "erreur":
      return accentSur(fond, "terracotta");
    default:
      return couleursSur(fond).texte;
  }
}
