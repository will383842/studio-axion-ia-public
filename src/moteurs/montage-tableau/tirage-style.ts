/**
 * TIRAGE DU STYLE DU TABLEAU (« reference/3 ») : tableau blanc, ardoise ou paperboard tirés avec une graine stable
 * (sha256 de l'identifiant de la vidéo, jamais de `Math.random`), avec la même rotation anti-répétition que la variété
 * du cas concret : jamais le style des 2 dernières vidéos du générateur quand l'historique est connu. Le choix posé
 * (`styleImpose`, ou `styleTableau` déjà dans la fiche) l'emporte toujours sur le tirage. Un historique lu comme celui de
 * `casConcret.historiqueTirages` : une ligne par vidéo, de la plus ancienne à la plus récente, 42 lignes au plus.
 * Les habillages (5) ne sont PAS tirés : seuls « reference/3 » porte les trois styles (voir la PR).
 */
import { createHash } from "node:crypto";
import { STYLES_TABLEAU, estStyleTableau, styleTableauDe, type StyleTableau } from "@/briques/tableau-scene/trois-styles/styles";

/** Nombre de dernières vidéos dont le style n'est pas repris. */
export const STYLES_RECENTS_EVITES = 2;
/** Taille de l'historique gardé (comme celui du cas concret). */
export const TAILLE_HISTORIQUE_STYLES = 42;

/** Une ligne de l'historique : la vidéo et le style de son tableau. */
export interface EntreeHistoriqueStyle {
  videoId: string;
  style: StyleTableau;
}

/** Historique lu sans exception : les lignes illisibles sont ignorées, les 42 dernières gardées. */
export function lireHistoriqueStyles(brut: unknown): EntreeHistoriqueStyle[] {
  if (!Array.isArray(brut)) return [];
  return brut
    .flatMap((x): EntreeHistoriqueStyle[] => {
      const o = x && typeof x === "object" ? (x as Record<string, unknown>) : undefined;
      return o && typeof o.videoId === "string" && o.videoId && estStyleTableau(o.style) ? [{ videoId: o.videoId, style: o.style }] : [];
    })
    .slice(-TAILLE_HISTORIQUE_STYLES);
}

/** Ajoute (ou remplace) la ligne d'une vidéo ; 42 lignes au plus (les plus récentes). */
export function ajouterAHistoriqueStyles(historique: readonly EntreeHistoriqueStyle[], entree: EntreeHistoriqueStyle, max = TAILLE_HISTORIQUE_STYLES): EntreeHistoriqueStyle[] {
  return [...historique.filter((e) => e.videoId !== entree.videoId), entree].slice(-max);
}

/** Graine stable d'une vidéo : 32 premiers bits de son sha256. */
export function graineStyle(videoId: string): number {
  return createHash("sha256").update(`tableau-style:${videoId}`).digest().readUInt32BE(0);
}

/**
 * Tire le style d'une vidéo. Déterministe : même identifiant, même historique → même style. Les styles des
 * `STYLES_RECENTS_EVITES` dernières autres vidéos sont écartés (la ligne de la vidéo elle-même est ignorée : un re-tirage
 * ne dépend pas d'elle) ; s'il n'en reste aucun, tous reviennent.
 */
export function tirerStyleTableau(videoId: string, historique: readonly EntreeHistoriqueStyle[] = []): StyleTableau {
  const recents = new Set(historique.filter((e) => e.videoId !== videoId).slice(-STYLES_RECENTS_EVITES).map((e) => e.style));
  const permis = STYLES_TABLEAU.filter((s) => !recents.has(s));
  const liste = permis.length ? permis : STYLES_TABLEAU;
  return liste[graineStyle(videoId) % liste.length]!;
}

/** Ce que le découpage sait du tirage (facultatif : absent, le style reste celui de la série). */
export interface ChoixStyle {
  /** Style choisi par Will pour cette vidéo ou cette série : respecté tel quel. */
  styleImpose?: string;
  /** Présent : le style est tiré (graine de la vidéo), avec cet historique s'il est connu. */
  tirage?: { historique?: readonly EntreeHistoriqueStyle[] };
}

/** Style d'une vidéo au découpage : imposé, sinon tiré (si demandé), sinon celui de la série (comportement d'avant). */
export function styleDuDecoupage(e: ChoixStyle & { videoId: string; serie: { code?: string } }): StyleTableau {
  if (estStyleTableau(e.styleImpose)) return e.styleImpose;
  return e.tirage ? tirerStyleTableau(e.videoId, e.tirage.historique) : styleTableauDe({ serie: e.serie });
}
