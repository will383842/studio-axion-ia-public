/**
 * X1-02b : sous-titres « minimal dynamique » — découpe en groupes de 1 à 3 mots et un seul mot marqué.
 * Pièce PURE, ÉTEINTE, non branchée : aucune date, aucun hasard, entrées jamais modifiées.
 * Imports relatifs seulement (le dossier est copié tel quel dans l'image du rendu).
 */
import { MARQUEURS } from "./marqueur";
import type { MotRendu, SegmentRendu, TeinteMarqueurRendu } from "./types-rendu";
import { estMotOutil, estNombre, estTrancheMilliers, estUnite } from "./typographie";

export const MINIMAL_DYNAMIQUE = Object.freeze({ motsMax: 3, teinte: "terracotta", hauteurTexteMin: 0.03 } as const);

export interface GroupeMinimal {
  id: string;
  debutSec: number;
  finSec: number;
  mots: MotRendu[];
  /** Index (dans le groupe) du premier mot `enValeur`, sinon null. */
  marque: number | null;
}

/** Longueur de l'unité insécable qui commence au mot `i` (nombre + tranches de milliers + unité), 1 sinon. */
function longueurAtome(mots: readonly MotRendu[], i: number): number {
  if (!estNombre(mots[i].mot)) return 1;
  let n = 1;
  while (i + n < mots.length && estTrancheMilliers(mots[i + n].mot)) n++;
  if (i + n < mots.length && estUnite(mots[i + n].mot)) n++;
  return n;
}

function tailles(mots: readonly MotRendu[], motsMax: number): number[] {
  const res: number[] = [];
  let i = 0;
  while (i < mots.length) {
    // Atomes qui tiennent dans le groupe (un atome trop long est coupé mot à mot).
    const bornes: number[] = [];
    let t = 0;
    while (i + t < mots.length && t < motsMax) {
      const a = longueurAtome(mots, i + t);
      if (a > 1 && a > motsMax) {
        if (t === 0) { bornes.push(1); t = 1; }
        break;
      }
      if (t + a > motsMax) break;
      t += a;
      bornes.push(t);
    }
    if (bornes.length === 0) bornes.push(1);
    // Plus grande taille dont le dernier mot n'est pas un mot outil (sauf si plus aucun mot ne suit).
    let choix = bornes[bornes.length - 1];
    for (let k = bornes.length - 1; k >= 0; k--) {
      const b = bornes[k];
      if (i + b >= mots.length || !estMotOutil(mots[i + b - 1].mot)) { choix = b; break; }
    }
    res.push(choix);
    i += choix;
  }
  return res;
}

export function decouperMinimalDynamique(segments: readonly SegmentRendu[], options?: { motsMax?: 1 | 2 | 3 }): GroupeMinimal[] {
  const motsMax = options?.motsMax === 1 || options?.motsMax === 2 ? options.motsMax : MINIMAL_DYNAMIQUE.motsMax;
  const sortie: GroupeMinimal[] = [];
  for (const seg of segments) {
    const mots = seg.mots;
    const paquets: MotRendu[][] = [];
    let i = 0;
    for (const t of tailles(mots, motsMax)) {
      paquets.push(mots.slice(i, i + t));
      i += t;
    }
    paquets.forEach((groupe, n) => {
      const idx = groupe.findIndex((m) => m.enValeur === true);
      sortie.push({
        id: `${seg.id}-${n}`,
        debutSec: groupe[0].debutSec,
        finSec: n + 1 < paquets.length ? paquets[n + 1][0].debutSec : seg.finSec,
        mots: groupe,
        marque: idx >= 0 ? idx : null,
      });
    });
  }
  return sortie;
}

export function couleursMinimalDynamique(teinte: TeinteMarqueurRendu = "terracotta"): { fond: string; texte: string } {
  const m = MARQUEURS[teinte] ?? MARQUEURS.terracotta;
  return { fond: m.fond, texte: m.texte };
}

export function tailleTexteMinimale(hauteurImagePx: number): number {
  if (!Number.isFinite(hauteurImagePx) || hauteurImagePx <= 0) return 0;
  return Math.ceil(hauteurImagePx * MINIMAL_DYNAMIQUE.hauteurTexteMin);
}
