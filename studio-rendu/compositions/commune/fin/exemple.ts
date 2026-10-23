/**
 * Propriétés PAR DÉFAUT de la fin (TB-15) : cadre et bande de la mise en page du tableau (`mise-en-page-tableau/2`,
 * zone sûre de tous les réseaux 9:16), recopiés ; les vraies propriétés arrivent par la demande de rendu.
 */
import { VERSION_FIN, type ProprietesFin } from "./plan";

export const FIN_EXEMPLE: ProprietesFin = {
  version: VERSION_FIN,
  largeur: 1080,
  hauteur: 1920,
  fps: 25,
  stylo: "crayon/1",
  dureeMs: 3_500,
  phrase: "Enregistrez pour la retrouver",
  cadre: { x: 79, y: 283, largeur: 793, hauteur: 792 },
  bande: { x: 65, y: 1075, largeur: 821, hauteur: 269 },
};
