/**
 * Tirage semé avec repli (E2-ANTI-REPETITION, X2-04) : essaie des candidates jusqu'à en trouver une assez différente ;
 * sinon garde la moins ressemblante (jamais de vidéo bloquée). PUR : ni date, ni hasard, ni réseau. Aucun appelant.
 */
import { rangGraine } from "../bibliotheque-video/graine";
import { verifier, type OptionsGarde } from "./garde";
import type { EmpreinteVideo, ResultatGarde, Voisine } from "./types";

export interface OptionsTirage extends OptionsGarde {
  /** Nombre d'essais (16 par défaut). */
  essais?: number;
  /** Graine facultative : mélange l'ordre d'essai de façon stable. Absente : 0, 1, 2… */
  graine?: string;
}

export interface Tirage<C> {
  candidat: C;
  sel: number;
  repli: boolean;
  resultat: ResultatGarde;
}

export function choisirCandidat<C>(
  fabrique: (sel: number) => C,
  empreinteDe: (c: C) => EmpreinteVideo,
  voisines: readonly Voisine[],
  { essais = 16, graine, ...garde }: OptionsTirage = {},
): Tirage<C> {
  const n = Math.max(1, Math.floor(essais));
  let ordre = Array.from({ length: n }, (_, i) => i);
  if (graine !== undefined) {
    const rang = new Map(ordre.map((s) => [s, rangGraine(graine, String(s))] as const));
    ordre = [...ordre].sort((a, b) => (rang.get(a)! < rang.get(b)! ? -1 : rang.get(a)! > rang.get(b)! ? 1 : a - b));
  }
  let meilleur: (Tirage<C> & { pire: number }) | null = null;
  for (const sel of ordre) {
    const candidat = fabrique(sel);
    const resultat = verifier(empreinteDe(candidat), voisines, garde);
    if (resultat.ok) return { candidat, sel, repli: false, resultat };
    const pire = resultat.score ?? 0;
    if (!meilleur || pire < meilleur.pire || (pire === meilleur.pire && sel < meilleur.sel)) {
      meilleur = { candidat, sel, repli: true, resultat, pire };
    }
  }
  const { pire: _pire, ...repli } = meilleur!;
  return repli;
}
