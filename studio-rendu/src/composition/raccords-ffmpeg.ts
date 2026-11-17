/**
 * C6-H24c-a · raccords (fondu, glissement) → morceaux de graphe FFmpeg `xfade`. PUR, NON BRANCHÉ : rien n'importe ce
 * fichier ; aucune exécution de FFmpeg. L'appelant (fiche H24c-c) garde son `concat` quand la fonction rend `null`.
 * Aucun visage traité ici : un raccord n'est jamais demandé sur un plan avec la personne (Q7, H24b-a).
 */

/** Recopie de `RaccordMontage` (src/briques/composition/raccords.ts:9-13) : le rendu n'importe rien de `src/`. */
export interface RaccordLocal {
  /** Indice du morceau qui précède le raccord (le raccord est entre `indexAvant` et `indexAvant + 1`). */
  indexAvant: number;
  type: "fondu" | "glissement";
}

/** Durée par défaut d'un raccord (s), proposition de C6-H24a (en-tête de tests/raccords/constat-raccords.test.ts). */
export const DUREE_RACCORD_DEFAUT_SEC = 0.3;

const f3 = (x: number) => x.toFixed(3);

export function filtresRaccords(
  entrees: { debutImage: number; finImage: number }[],
  raccords: readonly RaccordLocal[],
  fps: number,
  options: { dureeSec?: number; formats?: { rvb: string } } = {},
): { filtres: string[]; sortie: string } | null {
  const rvb = options.formats?.rvb ?? "gbrp";
  const voulu = options.dureeSec ?? DUREE_RACCORD_DEFAUT_SEC;
  const parIndex = new Map<number, RaccordLocal>();
  for (const r of raccords) {
    if (Number.isInteger(r.indexAvant) && r.indexAvant >= 0 && r.indexAvant + 1 < entrees.length && !parIndex.has(r.indexAvant)) {
      parIndex.set(r.indexAvant, r);
    }
  }
  if (parIndex.size === 0 || !(fps > 0)) return null;

  const secondes = (n: number) => n / fps;
  const filtres: string[] = [];
  let courant = "m0"; // étiquette de la chaîne en cours (entrées attendues : [m0], [m1]…)
  let dureeCourante = secondes(entrees[0]!.finImage - entrees[0]!.debutImage);
  const dernier = entrees.length - 2;
  for (let i = 0; i <= dernier; i++) {
    const suivante = entrees[i + 1]!;
    const dureeSuivante = secondes(suivante.finImage - suivante.debutImage);
    const sortieEtiquette = i === dernier ? "raccords" : `${parIndex.has(i) ? "x" : "c"}${i}`;
    const r = parIndex.get(i);
    if (r) {
      const plusCourt = Math.min(secondes(entrees[i]!.finImage - entrees[i]!.debutImage), dureeSuivante);
      const d = Math.max(0, Math.min(voulu, plusCourt / 2));
      const offset = Math.max(0, dureeCourante - d);
      const transition = r.type === "glissement" ? "slideleft" : "fade";
      filtres.push(`[${courant}][m${i + 1}]xfade=transition=${transition}:duration=${f3(d)}:offset=${f3(offset)},format=${rvb}[${sortieEtiquette}]`);
      dureeCourante = dureeCourante + dureeSuivante - d;
    } else {
      filtres.push(`[${courant}][m${i + 1}]concat=n=2:v=1:a=0,format=${rvb}[${sortieEtiquette}]`);
      dureeCourante += dureeSuivante;
    }
    courant = sortieEtiquette;
  }
  return { filtres, sortie: "[raccords]" };
}
