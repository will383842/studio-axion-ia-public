/** Règles de position sur la toile, en coordonnées de la toile (x de 0 à N × 1080) : fonctions PURES appliquées par `MesureToile`. */
import { BANDE_COUTURE, COIN_RESERVE, coutures, LARGEUR_PAGE, MARGE_SURE } from "../../../../../src/domaine/visuels/continu/geometrie";
import type { Boite } from "../../commun/zones";

/** Vrai si la boîte entre dans la bande de ±`BANDE_COUTURE` px autour d'une couture interne d'une toile de `n` pages. */
export function surCouture(b: Boite, n: number): boolean {
  return coutures(n).some((x) => b.gauche < x + BANDE_COUTURE && b.droite > x - BANDE_COUTURE);
}

/** Vrai si la boîte sort de la marge sûre de la page qui contient son centre. */
export function horsMarge(b: Boite, hauteur: number): boolean {
  const x0 = Math.floor((b.gauche + b.droite) / 2 / LARGEUR_PAGE) * LARGEUR_PAGE;
  return b.gauche < x0 + MARGE_SURE || b.droite > x0 + LARGEUR_PAGE - MARGE_SURE || b.haut < MARGE_SURE || b.bas > hauteur - MARGE_SURE;
}

/** Vrai si la boîte touche le coin bas droit réservé (`COIN_RESERVE` × `COIN_RESERVE`) d'une page. */
export function dansCoinReserve(b: Boite, hauteur: number): boolean {
  if (b.bas <= hauteur - COIN_RESERVE) return false;
  const premiere = Math.max(0, Math.floor(b.gauche / LARGEUR_PAGE));
  const derniere = Math.floor((b.droite - 1) / LARGEUR_PAGE);
  for (let i = premiere; i <= derniere; i++) {
    const fin = (i + 1) * LARGEUR_PAGE;
    if (b.droite > fin - COIN_RESERVE && b.gauche < fin) return true;
  }
  return false;
}

/** Vrai si la boîte passe de part et d'autre de l'abscisse `x` (un objet à cheval sur la couture). */
export function traverseCouture(b: Boite, x: number): boolean {
  return b.gauche < x && b.droite > x;
}
