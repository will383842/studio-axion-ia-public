/**
 * Sous-titres de l'aperçu du lot D : le VRAI moteur `SousTitres.tsx` (mot à mot, mot fort sur plaque orange) sur la phrase d'exemple
 * commune de la v3 : « Vos devis partent tout seuls pendant que vous êtes sur le chantier. »
 * Chaque élément se déclenche sur un mot de cette phrase ; `origine` = instant (s) où Will dit « devis », ce qui cale la phrase sur l'élément.
 */
import React from "react";
import { poserGroupe, SousTitres } from "../../SousTitres";
import type { GroupeSousTitre, MotSousTitre } from "../../SousTitres";

/** Instants (s) des mots, relatifs à « devis » = 0. */
export const MOTS_PHRASE: readonly MotSousTitre[] = [
  { w: "Vos", a: -0.3 },
  { w: "devis", a: 0, fort: true },
  { w: "partent", a: 0.42 },
  { w: "tout", a: 0.72 },
  { w: "seuls", a: 0.95, fort: true },
  { w: "pendant", a: 1.45 },
  { w: "que", a: 1.7 },
  { w: "vous", a: 1.82 },
  { w: "êtes", a: 2.1 },
  { w: "sur", a: 2.3 },
  { w: "le", a: 2.45 },
  { w: "chantier", a: 2.6, fort: true },
];
/** Instants des mots déclencheurs (relatifs à « devis »). */
export const T_MOT = Object.freeze({ devis: 0, partent: 0.42, tout: 0.72, seuls: 0.95, chantier: 2.6 });
const COUPES: readonly [number, number, number][] = [
  [0, 2, 0.42],
  [2, 5, 1.45],
  [5, 8, 2.1],
  [8, 11, 2.6],
  [11, 12, 3.3],
];

export type InstancePhrase = { origine: number; /** Le premier groupe (« Vos devis ») s'arrête vite : la puce de `mot-saute` a pris le mot. */ saute?: boolean };

/** Groupes de sous-titres d'une ou plusieurs instances de la phrase ; une instance coupe la précédente à son premier mot. */
export function groupesPhrase(instances: readonly InstancePhrase[]): GroupeSousTitre[] {
  const tous: GroupeSousTitre[] = [];
  instances.forEach((ins, n) => {
    const suivant = instances[n + 1];
    const limite = suivant ? suivant.origine + MOTS_PHRASE[0].a : Infinity;
    COUPES.forEach(([d, f, fin], i) => {
      const mots = MOTS_PHRASE.slice(d, f).map((m) => ({ ...m, a: m.a + ins.origine }));
      if (mots[0].a >= limite) return;
      const finG = ins.saute && i === 0 ? ins.origine + 0.14 : fin + ins.origine;
      tous.push({ mots, fin: Math.min(finG, limite) });
    });
  });
  return tous;
}

export const Y_SOUS_TITRES = 0.66;

/** Plaque du mot « devis » dans la ligne « Vos DEVIS » : centre (fractions de L et H) et largeur (px), pour caler la puce de `mot-saute`. */
export function plaqueDevis(W: number, H: number) {
  const g = MOTS_PHRASE.slice(0, 2);
  const pose = poserGroupe(g, W, H, 0);
  const x0 = W / 2 - pose.largeur / 2;
  const cx = x0 + pose.mots[0].largeur + pose.espace + pose.mots[1].largeur / 2;
  return { x: cx / W, y: Y_SOUS_TITRES, largeur: pose.mots[1].largeur, hauteur: pose.mots[1].hauteur };
}

export function SousTitresD({ t, groupes, W, H }: { t: number; groupes: GroupeSousTitre[]; W: number; H: number }) {
  return <SousTitres t={t} groupes={groupes} y={Y_SOUS_TITRES * H} largeurImage={W} hauteurImage={H} />;
}
