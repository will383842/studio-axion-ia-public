// Vidéos sur le site, lot S4 — lien de la page et chapitres dans la description YouTube (PUR).
import type { ChapitreWeb } from "./types";

/** « 0:06 », « 1:15 », « 1:02:05 » : le format que YouTube reconnaît pour ses chapitres. */
export function horodatageChapitre(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const deux = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${deux(m)}:${deux(r)}` : `${m}:${deux(r)}`;
}

/** Une ligne « 0:00 Accroche » par chapitre : le même découpage que la page du site (correction A4 n° 4). */
export function chapitresYoutube(chapitres: ChapitreWeb[]): string {
  return chapitres.map((c) => `${horodatageChapitre(c.debutSec)} ${c.libelle}`).join("\n");
}

/** Réseaux dont la description reçoit le lien de la page. */
export const RESEAUX_LIEN_SITE: readonly string[] = ["youtube", "youtube-shorts"];

/**
 * Description complétée du lien de la page et des chapitres. Idempotente : un texte qui porte déjà le lien n'est pas
 * complété une seconde fois (Will peut avoir enregistré le texte complété).
 */
export function descriptionAvecPage(texte: string, page: { url: string; chapitres: ChapitreWeb[] }): string {
  if (texte.includes(page.url)) return texte;
  const chapitres = page.chapitres.length ? `\n\n${chapitresYoutube(page.chapitres)}` : "";
  return `${texte.trimEnd()}\n\nLa page de la vidéo : ${page.url}${chapitres}`;
}
