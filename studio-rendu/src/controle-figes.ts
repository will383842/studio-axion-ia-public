/**
 * IMAGES FIGÉES D'UNE VIDÉO EXPORTÉE (FIX-RENDU-IMAGE-FIGEE, rendu réel `v-64a273d3580c` : « Image figée : Non vérifié »).
 *
 * Mesure gratuite et locale : FFmpeg `freezedetect` sur le fichier exporté. On compte les passages figés qui
 * commencent AVANT la fin propre voulue (image finale tenue puis fondu) : la tenue finale n'est pas une faute.
 * Le contrôle `controleImageFigee` (`src/briques/controle-image/mesures.ts`) lit `imagesFigeesHorsFin`.
 * Les fonctions sont PURES ; `mesurerExport` lance FFmpeg et omet la mesure si elle tombe en panne.
 */

/** Marge (s) avant la fin propre : un passage qui commence dans cette marge est déjà la tenue finale. */
export const MARGE_FIN_FIGES_SEC = 0.1;

export interface PassageFige {
  debutSec: number;
  dureeSec: number;
}

/** Arguments FFmpeg de la détection (rien n'est écrit : sortie nulle). */
export function argumentsFiges(video: string, seuilSec: number): string[] {
  return ["-hide_banner", "-nostats", "-i", video, "-an", "-vf", `freezedetect=n=-60dB:d=${seuilSec}`, "-f", "null", "-"];
}

/** Les passages figés du journal de FFmpeg ; un `freeze_start` sans durée court jusqu'à la fin du fichier. */
export function lirePassagesFigesExport(journal: string, dureeSec: number): PassageFige[] {
  const debuts = [...journal.matchAll(/freeze_start:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  const durees = [...journal.matchAll(/freeze_duration:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  return debuts
    .map((debutSec, k) => ({ debutSec, dureeSec: k < durees.length ? durees[k] : Math.max(0, dureeSec - debutSec) }))
    .filter((p) => Number.isFinite(p.debutSec) && Number.isFinite(p.dureeSec));
}

/** `imagesFigeesHorsFin` (nombre) et `figeMaxHorsFinSec` (plus longue durée) des passages commencés avant la fin propre. */
export function mesuresFiges(journal: string, dureeSec: number, finSec: number): { imagesFigeesHorsFin: number; figeMaxHorsFinSec: number } {
  const limite = dureeSec - Math.max(0, finSec) - MARGE_FIN_FIGES_SEC;
  const hors = lirePassagesFigesExport(journal, dureeSec).filter((p) => p.debutSec < limite);
  return { imagesFigeesHorsFin: hors.length, figeMaxHorsFinSec: Math.round(Math.max(0, ...hors.map((p) => p.dureeSec)) * 100) / 100 };
}
