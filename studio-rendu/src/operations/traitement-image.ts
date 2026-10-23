/**
 * Opération `traitement-image` (file courte, lot A2 « Mes images ») : l'ORIGINAL n'est jamais modifié, chaque
 * demande produit un NOUVEAU fichier déposé à `sortie.urlDepot`.
 * Entrée : `image` (adresse signée). Paramètres :
 *  - `mode: "flouter"` + `zones` [{ x, y, largeur, hauteur }] (px de l'image d'origine) → JPEG, zones floutées fort ;
 *  - `mode: "vignette"` + `point` { x, y } (0-1) → JPEG 540 × 960, recadré en 9:16 autour du point d'intérêt ;
 *  - `mode: "mesurer"` → JSON (largeur, hauteur, luminosité moyenne, flou), aussi rendu dans les mesures.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ErreurRendu, type Operation } from "../contrat.js";
import { deposer, executer, executerAvecErreurs, FFMPEG, FFPROBE, telecharger } from "../outils.js";

export interface ZoneFlou {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

/** Zones bornées à l'image, dimensions paires (exigence des filtres), vides retirées. PUR. */
export function zonesBornees(zones: ZoneFlou[], largeur: number, hauteur: number): ZoneFlou[] {
  const pair = (n: number) => Math.max(2, Math.floor(n / 2) * 2);
  return zones
    .map((z) => {
      const x = Math.max(0, Math.min(largeur - 2, Math.round(z.x)));
      const y = Math.max(0, Math.min(hauteur - 2, Math.round(z.y)));
      return { x, y, largeur: pair(Math.min(largeur - x, z.largeur)), hauteur: pair(Math.min(hauteur - y, z.hauteur)) };
    })
    .filter((z) => z.largeur >= 2 && z.hauteur >= 2);
}

/** Graphe FFmpeg du floutage : chaque zone est découpée, floutée fort (deux passes), puis reposée. PUR, testé. */
export function grapheFlou(zones: ZoneFlou[]): string {
  if (!zones.length) return "[0:v]null[out]";
  const parties: string[] = [`[0:v]split=${zones.length + 1}[base]${zones.map((_, i) => `[s${i}]`).join("")}`];
  zones.forEach((z, i) => {
    const rayon = Math.max(4, Math.min(40, Math.floor(Math.min(z.largeur, z.hauteur) / 4)));
    parties.push(`[s${i}]crop=${z.largeur}:${z.hauteur}:${z.x}:${z.y},boxblur=${rayon}:3[f${i}]`);
  });
  let courant = "base";
  zones.forEach((z, i) => {
    const sortie = i === zones.length - 1 ? "out" : `o${i}`;
    parties.push(`[${courant}][f${i}]overlay=${z.x}:${z.y}[${sortie}]`);
    courant = sortie;
  });
  return parties.join(";");
}

/** Recadrage 9:16 autour d'un point d'intérêt (0-1), puis 540 × 960. PUR, testé. */
export function filtreVignette(largeur: number, hauteur: number, point: { x: number; y: number }): string {
  const cible = 9 / 16;
  let l = largeur;
  let h = hauteur;
  if (largeur / hauteur > cible) l = Math.floor((hauteur * cible) / 2) * 2;
  else h = Math.floor(largeur / cible / 2) * 2;
  const x = Math.max(0, Math.min(largeur - l, Math.round(point.x * largeur - l / 2)));
  const y = Math.max(0, Math.min(hauteur - h, Math.round(point.y * hauteur - h / 2)));
  return `crop=${l}:${h}:${x}:${y},scale=540:960:flags=lanczos`;
}

async function dimensions(chemin: string, signal: AbortSignal): Promise<{ largeur: number; hauteur: number }> {
  const json = await executer(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", chemin], signal);
  const s = (JSON.parse(json) as { streams?: { width?: number; height?: number }[] }).streams?.[0];
  if (!s?.width || !s.height) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Image illisible." });
  return { largeur: s.width, hauteur: s.height };
}

/** Luminosité moyenne (0-255) et flou (FFmpeg `blurdetect`, plus haut = plus flou) ; absents si le filtre manque. */
async function mesurer(chemin: string, signal: AbortSignal): Promise<Record<string, number>> {
  const sortie: Record<string, number> = {};
  try {
    const { erreurs } = await executerAvecErreurs(FFMPEG, ["-hide_banner", "-i", chemin, "-vf", "signalstats,metadata=print:key=lavfi.signalstats.YAVG", "-frames:v", "1", "-f", "null", "-"], signal);
    const m = /YAVG=([\d.]+)/.exec(erreurs);
    if (m) sortie.luminosite = Number(m[1]);
  } catch {
    /* mesure facultative */
  }
  try {
    const { erreurs } = await executerAvecErreurs(FFMPEG, ["-hide_banner", "-i", chemin, "-vf", "blurdetect", "-frames:v", "1", "-f", "null", "-"], signal);
    const m = /blur mean:\s*([\d.]+)/.exec(erreurs);
    if (m) sortie.flou = Number(m[1]);
  } catch {
    /* filtre absent : pas de mesure */
  }
  return sortie;
}

export const traitementImage: Operation = async (demande, contexte) => {
  const url = demande.entrees.image;
  if (!url) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Entrée « image » manquante." });
  const mode = demande.parametres.mode;
  if (mode !== "flouter" && mode !== "vignette" && mode !== "mesurer") throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Mode inconnu." });
  const original = join(contexte.dossier, "original");
  await telecharger(url, original, contexte.signal);
  contexte.progression(20);
  const { largeur, hauteur } = await dimensions(original, contexte.signal);
  const mesures: Record<string, number> = { largeur, hauteur };

  if (mode === "mesurer") {
    Object.assign(mesures, await mesurer(original, contexte.signal));
    const chemin = join(contexte.dossier, "mesures.json");
    await writeFile(chemin, JSON.stringify(mesures));
    await deposer(demande.sortie.urlDepot, chemin, "application/json", contexte.signal);
    return { mesures };
  }

  const sortie = join(contexte.dossier, "sortie.jpg");
  if (mode === "flouter") {
    const zones = zonesBornees(Array.isArray(demande.parametres.zones) ? (demande.parametres.zones as ZoneFlou[]) : [], largeur, hauteur);
    await executer(FFMPEG, ["-hide_banner", "-y", "-i", original, "-filter_complex", grapheFlou(zones), "-map", "[out]", "-frames:v", "1", "-q:v", "2", sortie], contexte.signal);
    mesures.zones = zones.length;
  } else {
    const p = (demande.parametres.point ?? { x: 0.5, y: 0.45 }) as { x: number; y: number };
    await executer(FFMPEG, ["-hide_banner", "-y", "-i", original, "-vf", filtreVignette(largeur, hauteur, p), "-frames:v", "1", "-q:v", "3", sortie], contexte.signal);
  }
  contexte.progression(80);
  await deposer(demande.sortie.urlDepot, sortie, "image/jpeg", contexte.signal);
  return { mesures };
};
