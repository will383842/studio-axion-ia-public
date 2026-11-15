/**
 * Durée visée d'une vidéo contre la limite de chaque réseau (PUR : aucun appel, aucune écriture, rien n'est bloqué).
 * Les limites viennent du relevé docs/reseaux/regles-officielles.json (cellule, URL, date) ; une cellule « inconnu » donne
 * « limite non vérifiée », jamais un chiffre. Facebook : REEL_FACEBOOK_DUREE_SEC.max, importée de zernio-corps.ts.
 */
import { REEL_FACEBOOK_DUREE_SEC } from "@/fournisseurs/publication/zernio-corps";
import type { DureesFormat } from "@/formats/types";

export const RESEAUX_DUREE = ["tiktok", "instagram", "youtube-shorts", "linkedin", "facebook"] as const;
export type ReseauDuree = (typeof RESEAUX_DUREE)[number];

const NOMS: Readonly<Record<ReseauDuree, string>> = { tiktok: "TikTok", instagram: "Instagram", "youtube-shorts": "YouTube Shorts", linkedin: "LinkedIn", facebook: "Facebook" };

export interface SourceLimite {
  /** Chemin de la cellule dans le relevé (ex. « reseaux.facebook.reseau.format_video »). */
  cellule: string;
  url: string;
  date: string;
}

export interface LimiteDuree {
  reseau: string;
  /** null : limite non vérifiée. */
  limiteSec: number | null;
  source: SourceLimite | null;
}

/**
 * Source de la limite Facebook : copie de la cellule docs/reseaux/regles-officielles.json (le dossier docs/ n'est pas dans
 * l'image de build). Le test lit le relevé et échoue si cette copie s'en écarte ou si la cellule perd sa preuve.
 */
export const SOURCE_FACEBOOK_DUREE: SourceLimite = { cellule: "reseaux.facebook.reseau.format_video", url: "https://zernio.com/openapi.json", date: "2026-11-12" };

/** Limite de durée vidéo d'un réseau et sa source. Chiffre seulement pour un réseau dont la cellule de preuve est copiée ici. */
export function limiteDureeReseau(reseau: string): LimiteDuree {
  if (reseau === "facebook") return { reseau, limiteSec: REEL_FACEBOOK_DUREE_SEC.max, source: SOURCE_FACEBOOK_DUREE };
  return { reseau, limiteSec: null, source: null };
}

export interface AlerteDuree {
  genre: "ok" | "depasse" | "non-verifiee";
  phrase: string | null;
}

function nom(reseau: string): string {
  return (NOMS as Record<string, string>)[reseau] ?? reseau;
}

/** Durée connue contre la limite du réseau. Durée inconnue ou dans la limite : aucune phrase. */
export function alerteDuree(reseau: string, dureeSec: number | undefined | null): AlerteDuree {
  if (typeof dureeSec !== "number" || !Number.isFinite(dureeSec) || dureeSec <= 0) return { genre: "ok", phrase: null };
  const l = limiteDureeReseau(reseau);
  if (l.limiteSec === null || !l.source) return { genre: "non-verifiee", phrase: `${nom(reseau)} : limite non vérifiée.` };
  if (dureeSec <= l.limiteSec) return { genre: "ok", phrase: null };
  return {
    genre: "depasse",
    phrase: `${nom(reseau)} : cette vidéo dure ${Math.round(dureeSec)} s, la limite est de ${l.limiteSec} s (source : ${new URL(l.source.url).hostname}, relevé du ${l.source.date}). Rien n'est bloqué.`,
  };
}

/** Une alerte par réseau coché qui dépasse ou dont la limite n'est pas vérifiée ; les autres n'en ont pas. */
export function alertesDuree(reseaux: readonly string[], dureeSec: number | undefined | null): AlerteDuree[] {
  return reseaux.map((r) => alerteDuree(r, dureeSec)).filter((a) => a.genre !== "ok");
}

/** Durée visée d'un format « depuis-script » : cible par défaut, sinon borne haute de la zone verte ; autre format : inconnue. */
export function dureeViseeFormat(durees: DureesFormat): number | undefined {
  if (durees.mode !== "depuis-script") return undefined;
  return durees.cibleParDefautSec > 0 ? durees.cibleParDefautSec : durees.zoneSec[1];
}
