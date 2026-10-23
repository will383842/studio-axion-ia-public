/**
 * SÉRIES RECONNAISSABLES (équipe 7, docs/conception/TIKTOK-SERIES-HASHTAGS.md § 2.3). PUR : importable côté client.
 *
 * Le même titre de série apparaît à l'écran (ligne « Série : » de l'encadré d'ouverture, déjà dessinée par la
 * composition) et en tête de la description (« L'IA qui fait gagner 1 h · ép. 3 »).
 */
import type { Id } from "./types";

/** Longueurs permises d'un nom de série (la largeur à l'écran est vérifiée en plus, par le service). */
export const NOM_SERIE_MIN = 2;
export const NOM_SERIE_MAX = 40;

/** Réglage facultatif d'une série : absent ou `true` = numérotée (« Série · ép. N »), `false` = le nom seul. */
export function serieNumerotee(serie: { numeroter?: boolean } | null | undefined): boolean {
  return serie?.numeroter !== false;
}

/** En-tête de la description : « Série · ép. 3 » (sans épisode connu, ou série `numeroter: false` : le nom seul). */
export function enteteSerie(nom: string, episode?: number, numeroter?: boolean): string {
  return episode && numeroter !== false ? `${nom} · ép. ${episode}` : nom;
}

/** Accroche d'un texte d'encadré « Thème : accroche » (sans deux-points : le texte entier). */
function accrocheDe(texte: string): string {
  const propre = texte.replace(/\s+/g, " ").trim();
  const i = propre.indexOf(":");
  return i > 0 && i < propre.length - 1 ? propre.slice(i + 1).trim() : propre;
}

/**
 * Texte de l'encadré d'ouverture d'une vidéo en série : « Série : accroche ». La composition dessine la partie avant
 * « : » sur sa propre ligne, au-dessus de l'accroche en majuscules : aucun changement du rendu. Un ancien thème est
 * remplacé par le nom de la série ; sans accroche, le nom seul.
 */
export function encadreAvecSerie(texte: string | undefined, nomSerie: string): string {
  const accroche = texte ? accrocheDe(texte) : "";
  return accroche ? `${nomSerie} : ${accroche}` : nomSerie;
}

/** Série d'une vidéo : la sienne, sinon celle du sujet d'où vient sa version (avec l'épisode du sujet). */
export function serieEffective(
  video: { serieId?: Id; episodeSerie?: number },
  sujet: { brief: { serieId?: Id }; episodeSerie?: number } | null | undefined,
): { serieId: Id; episode?: number } | null {
  if (video.serieId) return { serieId: video.serieId, episode: video.episodeSerie };
  if (sujet?.brief.serieId) return { serieId: sujet.brief.serieId, episode: sujet.episodeSerie };
  return null;
}

/** Numéro du prochain épisode : après le compteur de la série, ou après le plus grand épisode connu. Jamais réutilisé. */
export function prochainEpisode(dernier: number | undefined, connus: (number | undefined)[]): number {
  return Math.max(dernier ?? 0, ...connus.map((n) => n ?? 0)) + 1;
}
