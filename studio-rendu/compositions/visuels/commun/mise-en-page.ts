/** Abscisses de départ des textes de la page dense (T02) et largeurs de colonne qui en découlent : fonctions PURES. */
import { BORD_DROIT_TEXTE, BORDURE_CARTE, LARGEUR_TEXTE, MARGE, OMBRE_DECALAGE, REMPLISSAGE_CARTE } from "./constantes";
import { BORD_DROIT_TEXTE_BAS, largeurTexteMax } from "./zones";

/** Écart (px) entre les cartes de la grille. */
export const ECART_GRILLE = 24;
/** Espace (px) entre le mini-visuel et le texte : en ligne (carte large) ou à côté du titre (carte en colonne). */
export const ECART_MINI_LIGNE = 28;
export const ECART_MINI_TITRE = 18;

/** Abscisse du bord gauche de la carte de rang `i` (à partir de 0) dans une grille de `colonnes` colonnes. */
export function gaucheCarte(i: number, colonnes: number): number {
  const largeurColonne = (LARGEUR_TEXTE - OMBRE_DECALAGE - (colonnes - 1) * ECART_GRILLE) / colonnes;
  return MARGE + (i % colonnes) * (largeurColonne + ECART_GRILLE);
}

/** Largeurs maximales (px) du titre et du corps d'une carte dont le bord gauche est à l'abscisse `gauche` : leur texte s'arrête à `BORD_DROIT_TEXTE` (à `BORD_DROIT_TEXTE_BAS` dans la dernière rangée, qui descend sous y = 1080). */
export function largeursTexteCarte({ gauche, miniTaille, enLigne, avecMini, derniereRangee = false }: { gauche: number; miniTaille: number; enLigne: boolean; avecMini: boolean; derniereRangee?: boolean }): { titre: number; corps: number } {
  const debut = gauche + BORDURE_CARTE + REMPLISSAGE_CARTE;
  const apresMini = debut + (avecMini ? miniTaille + (enLigne ? ECART_MINI_LIGNE : ECART_MINI_TITRE) : 0);
  const bord = derniereRangee ? BORD_DROIT_TEXTE_BAS : BORD_DROIT_TEXTE;
  return { titre: largeurTexteMax(apresMini, bord), corps: largeurTexteMax(enLigne ? apresMini : debut, bord) };
}

/** Une page de 2 cartes au plus et de peu de texte agrandit ses caractères (sinon chaque carte reste à moitié vide) ; au-delà, taille normale (les capacités du registre sont mesurées à la taille normale). */
export const ECHELLE_PEU_DE_TEXTE = 1.3;
export function echelleCartes(cartes: readonly { titre: string; corps: string }[]): number {
  const court = cartes.length <= 2 && cartes.every((c) => c.titre.length <= 24 && c.corps.length <= 80);
  return court ? ECHELLE_PEU_DE_TEXTE : 1;
}
