/**
 * MESURES SANS IA DE LA VIDÉO FINIE : pièce COMMUNE, 0 €, appelable par tout générateur (T-EXT-54a).
 * Noir et figé sur tout le fichier, netteté d'une zone (comparaison à la source), règle d'agrandissement,
 * lisibilité après zoom. PUR et déterministe : aucune exécution de FFmpeg, aucune lecture, aucun réseau, ne lève jamais.
 * Rien ne l'appelle encore (aucun branchement sur un générateur). Import par le chemin du fichier : non exporté par `index.ts`.
 */
import { nombre } from "./seuils";
import type { MesuresExport } from "./types";

// Valeurs de départ, recalées au pilote 05.
/** Score de netteté minimal d'une zone (1 = identique à la source). */
export const SEUIL_SSIM_ZONE = 0.9;
/** Pixels de sortie par pixel source : au-delà, le zoom agrandit l'image au-delà de sa finesse. */
export const ECHELLE_SOURCE_MAX = 1.0;
/** Une image qui ne bouge pas au moins aussi longtemps est « figée » (règle de Williams). */
export const SEUIL_FIGE_MS = 1500;
export const NOIR_MIN_SEC = 0.1;
export const NOIR_SEUIL_PIXEL = 0.1;
export const FIGE_BRUIT = 0.003;

/** Rectangle en pixels, origine en haut à gauche. */
export interface Rect {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export interface ZoneMesure {
  /** Libre : étape, scène… */
  id: string;
  tSourceSec: number;
  tVideoSec: number;
  rectSource: Rect;
  rectVideo: Rect;
  /** Pixels de sortie par pixel source. */
  echelleSource: number;
  policeSourcePx?: number;
  minimumPx?: number;
}

export interface MesureZone {
  id: string;
  ssim: number | null;
  echelleSource: number;
  policeEffectivePx?: number;
  verdict: "ok" | "a-revoir" | "non-mesure";
  raisons: string[];
}

export interface DetectionsVideo {
  imagesFigeesHorsFin?: number;
  imageNoireTete?: number;
  imagesNoiresHorsFin?: number;
}

/** Tout préfixe de protocole FFmpeg (`cache:`, `concat:`, `subfile,…:`, `pipe:`, `data:`, `https:`…) au début du chemin. */
const PREFIXE_PROTOCOLE = /^[a-z][a-z0-9+.,_-]+:/i;

function fichierLocal(chemin: unknown): chemin is string {
  if (typeof chemin !== "string") return false;
  const c = chemin.trim();
  return c.length > 0 && !c.includes("://") && !PREFIXE_PROTOCOLE.test(c);
}

function rectValide(r: Rect | undefined): r is Rect {
  return !!r && [r.x, r.y, r.largeur, r.hauteur].every((n) => Number.isFinite(n)) && r.x >= 0 && r.y >= 0 && r.largeur >= 1 && r.hauteur >= 1;
}

const entier = (n: number): number => Math.max(1, Math.round(n));

/** Arguments FFmpeg (sans le programme) pour comparer une zone de la vidéo à la même zone de la source ; `null` si refusé. */
export function argumentsSsim(e: { source: string; video: string; zone: ZoneMesure }): string[] | null {
  try {
    const { source, video, zone: z } = e;
    if (!fichierLocal(source) || !fichierLocal(video)) return null;
    if (!rectValide(z?.rectSource) || !rectValide(z?.rectVideo)) return null;
    if (!Number.isFinite(z.tSourceSec) || !Number.isFinite(z.tVideoSec) || z.tSourceSec < 0 || z.tVideoSec < 0) return null;
    const rs = z.rectSource;
    const rv = z.rectVideo;
    const w = entier(rv.largeur);
    const h = entier(rv.hauteur);
    const crop = (r: Rect) => `crop=${entier(r.largeur)}:${entier(r.hauteur)}:${Math.round(r.x)}:${Math.round(r.y)}`;
    const graphe = [
      `[0:v]${crop(rs)},scale=${w}:${h}:flags=lanczos,format=gray[a]`,
      `[1:v]${crop(rv)},format=gray[b]`,
      "[a][b]ssim",
    ].join(";");
    return [
      "-hide_banner", "-nostdin",
      "-ss", String(z.tSourceSec), "-i", source,
      "-ss", String(z.tVideoSec), "-i", video,
      "-filter_complex", graphe,
      "-frames:v", "1", "-an", "-f", "null", "-",
    ];
  } catch {
    return null;
  }
}

/** Lit « All:0.9734 (…) » dans la sortie d'erreur de FFmpeg ; `null` si absent. */
export function lireSsim(stderr: string): number | null {
  if (typeof stderr !== "string") return null;
  const m = /\bAll:\s*([0-9]*\.?[0-9]+)/.exec(stderr);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** Arguments FFmpeg (sans le programme) pour détecter les images figées et noires sur tout le fichier ; `null` si refusé. */
export function argumentsDetections(video: string): string[] | null {
  if (!fichierLocal(video)) return null;
  return [
    "-hide_banner", "-nostdin", "-i", video,
    "-vf", `freezedetect=n=${FIGE_BRUIT}:d=${SEUIL_FIGE_MS / 1000},blackdetect=d=${NOIR_MIN_SEC}:pix_th=${NOIR_SEUIL_PIXEL}`,
    "-an", "-f", "null", "-",
  ];
}

const nb = (s: string): number => Number(s);

/**
 * Lit les plages figées et noires. `finUtileMs` : début de la carte de fin, ou durée s'il n'y en a pas.
 * Une plage compte quand sa partie AVANT `finUtileMs` dure au moins `SEUIL_FIGE_MS`. Sans `freeze_end` (gel jusqu'au bout du
 * fichier), la fin est la durée du fichier (`Duration:`), ou `finUtileMs` si elle manque.
 * Sortie illisible (aucune trace de FFmpeg) → `{}` : le contrôle reste « non fait ».
 */
export function lireDetections(stderr: string, e: { finUtileMs: number }): DetectionsVideo {
  if (typeof stderr !== "string" || !Number.isFinite(e?.finUtileMs)) return {};
  const lisible = /lavfi\.freezedetect|black_start|\bDuration:|\bvideo:\s*\d|\bframe=\s*\d/.test(stderr);
  if (!lisible) return {};
  const finSec = e.finUtileMs / 1000;
  let figes = 0;
  let noirsHorsFin = 0;
  let noirTete = 0;

  const compterFige = (debut: number, fin: number) => {
    if ((Math.min(fin, finSec) - debut) * 1000 >= SEUIL_FIGE_MS) figes += 1;
  };
  const md = /\bDuration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  const dureeFichierSec = md ? Number(md[1]) * 3600 + Number(md[2]) * 60 + Number(md[3]) : finSec;

  let debutFige: number | null = null;
  for (const ligne of stderr.split(/\r?\n|\r/)) {
    const fs = /freeze_start:\s*(-?[0-9.]+)/.exec(ligne);
    if (fs) {
      // Un gel précédent sans fin court jusqu'au bout du fichier : on le ferme avant d'en ouvrir un autre.
      if (debutFige !== null) compterFige(debutFige, dureeFichierSec);
      debutFige = nb(fs[1]);
      continue;
    }
    if (/freeze_duration:/.test(ligne)) continue;
    const fe = /freeze_end:\s*([0-9.]+)/.exec(ligne);
    if (fe && debutFige !== null) {
      compterFige(debutFige, nb(fe[1]));
      debutFige = null;
      continue;
    }
    const nr = /black_start:\s*([0-9.]+)\s+black_end:\s*([0-9.]+)/.exec(ligne);
    if (nr) {
      const debut = nb(nr[1]);
      const fin = nb(nr[2]);
      if (debut <= 0) noirTete = 1;
      else if (fin <= finSec) noirsHorsFin += 1;
    }
  }
  if (debutFige !== null) compterFige(debutFige, Number.isFinite(dureeFichierSec) ? dureeFichierSec : finSec);
  return { imagesFigeesHorsFin: figes, imageNoireTete: noirTete, imagesNoiresHorsFin: noirsHorsFin };
}

/** Règle d'agrandissement : le zoom ne dépasse pas 1 pixel de sortie par pixel source. */
export function agrandissementOk(echelleSource: number): boolean {
  return Number.isFinite(echelleSource) && echelleSource <= ECHELLE_SOURCE_MAX;
}

/** Taille réellement affichée (pixels de sortie) d'un texte de `policeSourcePx` pixels dans la source. */
export function policeApresZoomPx(policeSourcePx: number, echelleSource: number): number {
  return policeSourcePx * echelleSource;
}

export function lisibleApresZoom(policeEffectivePx: number, minimumPx: number): boolean {
  return Number.isFinite(policeEffectivePx) && policeEffectivePx >= minimumPx;
}

/** Note chaque zone. Une mesure absente (`null`) est « non mesurée » : jamais un succès. Raisons en mots simples. */
export function noterZones(zones: ZoneMesure[], ssims: Record<string, number | null>, seuil: number = SEUIL_SSIM_ZONE): MesureZone[] {
  return zones.map((z) => {
    const ssim = ssims[z.id] ?? null;
    const police = z.policeSourcePx !== undefined ? policeApresZoomPx(z.policeSourcePx, z.echelleSource) : undefined;
    const base = { id: z.id, ssim, echelleSource: z.echelleSource, ...(police !== undefined ? { policeEffectivePx: police } : {}) };
    if (ssim === null) {
      return { ...base, verdict: "non-mesure" as const, raisons: [`Zone « ${z.id} » : la netteté n'a pas pu être mesurée.`] };
    }
    const raisons: string[] = [];
    if (ssim < seuil) raisons.push(`Zone « ${z.id} » : le texte perd en netteté (score ${nombre(ssim, 2)}).`);
    if (!agrandissementOk(z.echelleSource)) raisons.push(`Zone « ${z.id} » : le zoom agrandit l'image au-delà de sa finesse.`);
    if (police !== undefined && z.minimumPx !== undefined && !lisibleApresZoom(police, z.minimumPx)) {
      raisons.push(`Zone « ${z.id} » : le plus petit texte montré fait ${Math.round(police)} px, il en faut ${Math.round(z.minimumPx)}.`);
    }
    return { ...base, verdict: raisons.length ? ("a-revoir" as const) : ("ok" as const), raisons };
  });
}

/** Mesures à passer à `controlerImageFinale` / `controlerVideoFinie` : seules les clés lues sont reprises. */
export function mesuresPourControle(d: DetectionsVideo): Partial<MesuresExport> {
  const sortie: Record<string, number> = {};
  for (const k of ["imagesFigeesHorsFin", "imageNoireTete", "imagesNoiresHorsFin"] as const) {
    const v = d?.[k];
    if (typeof v === "number" && Number.isFinite(v)) sortie[k] = v;
  }
  return sortie;
}
