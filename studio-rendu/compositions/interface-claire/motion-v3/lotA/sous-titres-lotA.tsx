/**
 * Sous-titres mot à mot du lot A : le VRAI moteur `SousTitres.tsx` (aucune imitation), sur la phrase d'exemple commune
 * « Vos devis partent tout seuls pendant que vous êtes sur le chantier. » (répétée pour remplir l'extrait). Mots forts en puce orange.
 */
import React from "react";
import { SousTitres } from "../../SousTitres";
import type { GroupeSousTitre } from "../../SousTitres";

/** [mot, instant (s) de la phrase, fort ?] — rythme d'une voix naturelle (≈ 3,3 mots par seconde). */
const PHRASE: ReadonlyArray<readonly [string, number, boolean]> = [
  ["Vos", 0.0, false],
  ["devis", 0.25, true],
  ["partent", 0.7, false],
  ["tout", 1.1, false],
  ["seuls", 1.35, true],
  ["pendant", 1.85, false],
  ["que", 2.05, false],
  ["vous", 2.2, false],
  ["êtes", 2.4, false],
  ["sur", 2.65, false],
  ["le", 2.8, false],
  ["chantier", 2.95, true],
];
const GROUPES: ReadonlyArray<readonly number[]> = [[0, 1], [2], [3, 4], [5, 6, 7], [8, 9, 10], [11]];
export const DUREE_PHRASE = 3.7;

/** Groupes de sous-titres de la phrase posée à `t0` (secondes), rythme multiplié par `vitesse`. */
export function groupesPhrase(t0: number, vitesse = 1): GroupeSousTitre[] {
  return GROUPES.map((g, n) => {
    const debutProchain = n + 1 < GROUPES.length ? PHRASE[GROUPES[n + 1][0]][1] : DUREE_PHRASE;
    return {
      mots: g.map((k) => ({ w: PHRASE[k][0], a: t0 + PHRASE[k][1] / vitesse, fort: PHRASE[k][2] })),
      fin: t0 + debutProchain / vitesse - 0.02,
    };
  });
}

export function SousTitresLotA({ t, y, groupes, largeurImage, hauteurImage }: { t: number; y: number; groupes: GroupeSousTitre[]; largeurImage: number; hauteurImage: number }) {
  return <SousTitres t={t} groupes={groupes} y={y} largeurImage={largeurImage} hauteurImage={hauteurImage} />;
}
