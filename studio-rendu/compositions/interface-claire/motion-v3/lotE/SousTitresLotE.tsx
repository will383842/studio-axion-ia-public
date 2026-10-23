import React from "react";
/**
 * Sous-titres du lot E : le VRAI moteur `SousTitres.tsx` (mot à mot, mot fort sur plaque orange), sur la phrase d'exemple commune
 * « Vos devis partent tout seuls pendant que vous êtes sur le chantier. », répétée en boucle sur la durée de l'extrait.
 * Pendant un plein écran (coup de poing), la bande descend à 0,88 H (sous les mots des éléments, au-dessus de 0,92 H) ;
 * hors plein écran, elle reste à sa place habituelle (0,64 H, sous le visage).
 */
import { GroupeSousTitre, SousTitres } from "../../SousTitres";

/** [mot, instant (s) dans un tour, fort] ; un tour dure 3,9 s. */
const TOUR: [string, number, boolean?][] = [
  ["Vos", 0.0], ["devis", 0.22, true], ["partent", 0.6], ["tout", 1.05], ["seuls", 1.25, true], ["pendant", 1.75], ["que", 2.1], ["vous", 2.2], ["êtes", 2.5], ["sur", 2.85], ["le", 3.0], ["chantier", 3.12, true],
];
const GROUPES_TOUR: number[][] = [[0, 1], [2], [3, 4], [5, 6, 7], [8], [9, 10, 11]];
const DUREE_TOUR = 3.9;

/** Groupes de sous-titres couvrant [0, fin] (le premier mot tombe à `depart`). */
export function groupesPhrase(depart: number, fin: number): GroupeSousTitre[] {
  const g: GroupeSousTitre[] = [];
  for (let tour = 0; depart + tour * DUREE_TOUR < fin; tour++) {
    const base = depart + tour * DUREE_TOUR;
    for (let k = 0; k < GROUPES_TOUR.length; k++) {
      const mots = GROUPES_TOUR[k].map((i) => ({ w: TOUR[i][0], a: +(base + TOUR[i][1]).toFixed(3), ...(TOUR[i][2] ? { fort: true } : {}) }));
      const suivant = k + 1 < GROUPES_TOUR.length ? base + TOUR[GROUPES_TOUR[k + 1][0]][1] : base + DUREE_TOUR;
      g.push({ mots, fin: +Math.min(suivant, mots[mots.length - 1].a + 0.9).toFixed(3) });
    }
  }
  return g;
}

export function SousTitresE({ t, W, H, pleinEcran, groupes }: { t: number; W: number; H: number; pleinEcran: boolean; groupes: GroupeSousTitre[] }) {
  return <SousTitres t={t} groupes={groupes} y={(pleinEcran ? 0.88 : 0.64) * H} largeurImage={W} hauteurImage={H} />;
}
