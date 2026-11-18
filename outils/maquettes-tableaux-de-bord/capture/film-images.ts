// T-EXT-03b : film de navigation image par image, à horloge maîtrisée. Pur, déterministe, ne lève jamais.
// Aucun import de @playwright/test : le lanceur (capturer.mts) fait les gestes, ce fichier ne fait que calculer.
import { createHash } from "node:crypto";
import type { ActionFilm } from "./plan-capture";

/** = `fps` de `src/moteurs/montage-tutoriel-outil/proprietes.ts` : capture = rendu, aucune conversion de cadence. */
export const IMAGES_PAR_SECONDE_FILM = 25;
export const PAS_IMAGE_MS = 40;
export const MARGE_FIN_FILM_MS = 500;
export const ATTENTE_CIBLE_MAX_MS = 5000;

export interface GesteImage {
  image: number;
  etapeId: string;
  aller: string;
  cible?: string;
  attenteMaxImages: number;
}
export type PlanImages = { ok: true; total: number; gestes: GesteImage[] } | { ok: false; erreurs: string[] };

export function planImages(actions: ActionFilm[], dureeVoixMs: number): PlanImages {
  const erreurs: string[] = [];
  const total = Math.ceil((dureeVoixMs + MARGE_FIN_FILM_MS) / PAS_IMAGE_MS);
  const gestes: GesteImage[] = [];
  const prises = new Set<number>();
  for (const a of actions) {
    const image = Math.round(a.gesteMs / PAS_IMAGE_MS);
    if (prises.has(image)) erreurs.push(`Étape ${a.etapeId} : deux gestes tombent sur la même image (${image}).`);
    prises.add(image);
    if (image >= total) erreurs.push(`Étape ${a.etapeId} : le geste tombe après la fin du film.`);
    const attenteMaxImages = Math.max(0, Math.floor(Math.min(ATTENTE_CIBLE_MAX_MS, a.finMs - a.gesteMs) / PAS_IMAGE_MS));
    const g: GesteImage = { image, etapeId: a.etapeId, aller: a.aller, attenteMaxImages };
    if (a.cible !== undefined) g.cible = a.cible;
    gestes.push(g);
  }
  if (erreurs.length > 0 || !Number.isFinite(total)) return { ok: false, erreurs: erreurs.length > 0 ? erreurs : ["Durée de voix invalide."] };
  return { ok: true, total, gestes };
}

/** L'horloge du film EST celle de la voix : `debutFilmMs = 0`. */
export const instantDeLImage = (i: number): number => i * PAS_IMAGE_MS;

/**
 * Auto-suffisante : passée telle quelle à `page.evaluate` (aucune variable extérieure, aucun paramètre par défaut).
 * Met chaque animation en pause et avance son `currentTime` de `pasMs` exactement (une animation neuve part de 0).
 */
export function avancerAnimations(doc: { getAnimations(): { pause(): void; currentTime: number | null }[] }, pasMs: number): number {
  const animations = doc.getAnimations();
  for (const a of animations) {
    a.pause();
    a.currentTime = (typeof a.currentTime === "number" ? a.currentTime : 0) + pasMs;
  }
  return animations.length;
}

/** crf 14 (≤ 16 demandé) ; une image clé par seconde pour le rendu par plages ; taille = celle des PNG, aucune mise à l'échelle. */
export function argumentsEncodage(sortie: string): string[] {
  return [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-c:v", "png", "-framerate", String(IMAGES_PAR_SECONDE_FILM), "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p",
    "-r", String(IMAGES_PAR_SECONDE_FILM), "-g", String(IMAGES_PAR_SECONDE_FILM),
    "-movflags", "+faststart", "-an", sortie,
  ];
}

export interface Cadence {
  ok: boolean;
  images: number;
  ecartsMs: number[];
  remarques: string[];
}

/** Lit `ffprobe -select_streams v:0 -show_entries frame=pts_time -of json`. */
export function lireCadence(jsonFfprobe: string, attendu: { images: number }): Cadence {
  const remarques: string[] = [];
  let temps: number[] = [];
  try {
    const j = JSON.parse(jsonFfprobe) as { frames?: { pts_time?: string }[] };
    temps = (j.frames ?? []).map((f) => Number(f.pts_time));
    if (temps.some((t) => !Number.isFinite(t))) {
      remarques.push("Horodatage illisible.");
      temps = [];
    }
  } catch {
    remarques.push("Sortie de ffprobe illisible.");
  }
  const ecartsMs: number[] = [];
  for (let i = 1; i < temps.length; i++) ecartsMs.push(Math.round((temps[i]! - temps[i - 1]!) * 1000));
  const irregulier = ecartsMs.filter((e) => Math.abs(e - PAS_IMAGE_MS) > 1);
  if (irregulier.length > 0) remarques.push(`${irregulier.length} écart(s) différent(s) de ${PAS_IMAGE_MS} ms.`);
  if (temps.length !== attendu.images) remarques.push(`${temps.length} image(s) au lieu de ${attendu.images}.`);
  return { ok: remarques.length === 0, images: temps.length, ecartsMs, remarques };
}

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (typeof v === "object" && v !== null) {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

/** sha256 canonique (clés triées) du film comme artefact ; `poste` absent → « inconnu ». */
export function empreinteFilm(e: { scenario: unknown; calage: unknown; poste?: string }): string {
  return createHash("sha256")
    .update(stable({ scenario: e.scenario, calage: e.calage, poste: e.poste ?? "inconnu" }))
    .digest("hex");
}
