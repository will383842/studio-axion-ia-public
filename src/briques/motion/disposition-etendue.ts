/**
 * PLACE D'UNE CARTE 7 À 13 DANS LA MOITIÉ HAUTE D'UN ÉCRAN PARTAGÉ (brique `motion`, lot F2). En moitié haute, les
 * compositions se resserrent (titres ajustés, textes à la taille de légende, contexte omis) ; mais une check-list de
 * longs points ou une carte documentaire très fournie ne tient pas dans une demi-image sans passer sous 3 % de la
 * hauteur. `tientEnMoitieHaute` le dit AVANT le rendu : le moteur pose alors la carte en plein écran (aucun réglage
 * pour Will). Estimation par la chasse réelle de Poppins (`mesure.ts`), avec une marge. PUR, sans alias « @/ ».
 */
import { couperLignes } from "./mesure";
import { taillePx, ZONES_SURES, type RatioMotion } from "./jetons";
import type { CarteModeleEtendu } from "./types-etendus";

const HAUTEUR_VIDEO: Record<RatioMotion, number> = { "9:16": 1920, "4:5": 1350, "1:1": 1080 };

/** Zone utile (px) de la moitié haute, comme la composition la calcule (`zonesCarte` du noyau). */
function zoneMoitie(ratio: RatioMotion): { largeur: number; hauteur: number } {
  const H = HAUTEUR_VIDEO[ratio];
  const hauteurCarte = Math.round((H * (ratio === "9:16" ? 0.5 : 0.45)) / 2) * 2;
  const z = ZONES_SURES[ratio];
  return { largeur: 1080 * (1 - Math.max(z.gauche, 0.075) - z.droite), hauteur: hauteurCarte - 0.035 * H - z.haut * H };
}

/** Vrai si la carte tient dans la moitié haute d'un écran partagé ; faux : la poser en plein écran. */
export function tientEnMoitieHaute(carte: CarteModeleEtendu, ratio: RatioMotion = "9:16"): boolean {
  const H = HAUTEUR_VIDEO[ratio];
  const zone = zoneMoitie(ratio);
  const legende = taillePx("legende", H);
  const corps = taillePx("corps", H);
  const titre = taillePx("titre", H);
  const marge = 0.96;
  switch (carte.modele) {
    case "check-list": {
      const d = carte.donnees;
      const caseTaille = legende * 1.3;
      const largeurTexte = zone.largeur - caseTaille - 28 - 50;
      const lignes = d.elements.map((e) => couperLignes(e.texte, legende, 600, largeurTexte).length);
      const rangees = lignes.reduce((s, n) => s + Math.max(caseTaille, n * legende * 1.18) + 24, 0) + (d.elements.length - 1) * 10;
      const tete = (d.titre ? zone.hauteur * 0.14 : 0) + 22 + 14;
      return tete + rangees <= zone.hauteur * marge;
    }
    case "documentaire": {
      const d = carte.donnees;
      const largeur = zone.largeur - 44;
      let h = 0;
      if (d.lieu) h += couperLignes(d.lieu.toUpperCase(), corps * 1.15, 800, largeur - corps).length * corps * 1.15 * 1.08 + 14;
      if (d.date) h += legende * 1.1 + 14;
      if (d.chiffre) h += titre * 1.4 + 20 + couperLignes(d.chiffre.libelle, legende, 600, largeur).length * legende * 1.18 + 14;
      return h <= zone.hauteur * marge;
    }
    case "graphique":
      // Barres : une ligne par valeur, au moins 1,3 fois la légende ; au-delà de 5 valeurs, trop serré.
      return carte.donnees.series.length <= (carte.donnees.variante === "barres" ? 5 : 6);
    default:
      return true;
  }
}
