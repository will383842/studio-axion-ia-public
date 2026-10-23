/**
 * IMAGE → VIDÉO · QUEUE DE FIN (Q19, Q24 « image figée hors voix »). PUR.
 *
 * La vidéo dure `REGLES_SCENE_IV.queue` de plus que la voix (Q19 : voix finie ≥ 1,5 s avant la fin). Sur le fichier
 * final, FFmpeg (`freezedetect=n=-60dB:d=0.1`, `argumentsNoirEtFige`) compte comme FIGÉE toute image qui ne change pas,
 * et une image figée sans voix est refusée au-delà de 0,5 s (`FIGE_IV.horsVoixMaxSec`, décision de Will du 17/10).
 *
 * `passagesFigesPrevusIV` prévoit, depuis la ligne de temps seule, les passages figés de la FIN de la vidéo : du dernier
 * changement visible jusqu'à la fin, hors du trait de fin qui se dessine pendant la queue (`ligne.queue`, plan pur
 * `@/briques/schema-motion/queue-fin`). Jugés avec `figeHorsVoixMaxSec` et les paroles de la ligne, ils disent AVANT
 * le rendu si la queue sera refusée.
 */
import type { PassageFigeIV } from "./commandes-ffmpeg";
import type { LigneDeTempsIV } from "./mise-en-scene";

const arrondi = (x: number) => Math.round(x * 1000) / 1000;

/** La marque de fin est un événement du rythme et des bruitages, sans dessin propre : elle ne fait rien bouger. */
const SANS_DESSIN = new Set(["marque-fin"]);

/** Dernier changement visible de la ligne avant `avant` : début du dernier bloc commencé ou dernier événement visible. */
function dernierChangement(ligne: Pick<LigneDeTempsIV, "blocs" | "evenements">, avant: number): number {
  const blocs = ligne.blocs.filter((b) => b.debut < avant - 1e-6).map((b) => b.debut);
  const evenements = ligne.evenements.filter((e) => e.visible && !SANS_DESSIN.has(e.id) && e.instantSec < avant - 1e-6).map((e) => e.instantSec);
  return Math.max(0, ...blocs, ...evenements);
}

/** Passages figés prévisibles de la fin de la ligne (début, durée), dans l'ordre. */
export function passagesFigesPrevusIV(ligne: Pick<LigneDeTempsIV, "dureeSec" | "blocs" | "evenements" | "queue">): PassageFigeIV[] {
  const passage = (a: number, b: number): PassageFigeIV[] => (b - a > 1e-6 ? [{ debutSec: arrondi(a), dureeSec: arrondi(b - a) }] : []);
  const q = ligne.queue;
  if (!q) return passage(dernierChangement(ligne, ligne.dureeSec), ligne.dureeSec);
  // Le trait bouge de `q.debutSec` à `q.finSec` : figé avant (s'il n'y a rien d'autre) et après (image finale posée).
  return [...passage(dernierChangement(ligne, q.debutSec), q.debutSec), ...passage(q.finSec, ligne.dureeSec)];
}
