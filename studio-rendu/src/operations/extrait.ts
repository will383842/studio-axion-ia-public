/**
 * Opération `extrait` (file courte ; lots R7a et R7d du double, plan double B.3 et B.2 bis).
 *
 *  - `parametres.type = "video"` : le passage d'entraînement (30 à 120 s) d'une prise, envoyé seul à HeyGen.
 *    Coupe EXACTE (ré-encodage), image ramenée à `largeur` (1080 : HeyGen rend le personnage en 1080p au plus), débit
 *    imposé par le studio pour tenir sous le plafond d'envoi de HeyGen, cadence et son d'origine gardés, aucun filtre
 *    de couleur (la prise est SDR : une vidéo HDR est refusée avant d'arriver ici). Sortie : MP4 H.264 + AAC.
 *  - `parametres.type = "audio"` : une tranche de l'audio maître (second angle ± 1 s), coupée à l'échantillon, WAV.
 *
 * Entrée : `media` (adresse de lecture signée, lue directement par FFmpeg : rien n'est téléchargé en entier).
 * Mesures : `dureeSec`, `taille`, et pour la vidéo `largeur`, `hauteur`.
 */
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { ErreurRendu, type Operation } from "../contrat.js";
import { deposer, executer, FFMPEG, FFPROBE } from "../outils.js";

export interface ParametresExtrait {
  source: string;
  sortie: string;
  type: "video" | "audio";
  debutSec: number;
  dureeSec: number;
  /** Vidéo : débit visé (kbit/s) et largeur de sortie. */
  videoKbps?: number;
  largeur?: number;
}

/**
 * Arguments FFmpeg (PURS, testés). `-ss` AVANT `-i` : recherche rapide dans le fichier distant (pas de lecture depuis
 * le début) ET exacte, puisque tout est ré-encodé (FFmpeg décode depuis l'image clé précédente et jette le surplus).
 */
export function argumentsExtrait(p: ParametresExtrait): string[] {
  const debut = String(+p.debutSec.toFixed(3));
  const duree = String(+p.dureeSec.toFixed(3));
  if (p.type === "audio") return ["-hide_banner", "-y", "-ss", debut, "-i", p.source, "-t", duree, "-vn", "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", p.sortie];
  const kbps = Math.max(500, Math.round(p.videoKbps ?? 6000));
  return [
    "-hide_banner",
    "-y",
    "-ss",
    debut,
    "-i",
    p.source,
    "-t",
    duree,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0",
    "-vf",
    `scale=${p.largeur ?? 1080}:-2:flags=lanczos`,
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-b:v",
    `${kbps}k`,
    "-maxrate",
    `${Math.round(kbps * 1.2)}k`,
    "-bufsize",
    `${kbps * 2}k`,
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    "48000",
    "-movflags",
    "+faststart",
    p.sortie,
  ];
}

function nombre(v: unknown, nom: string): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new ErreurRendu({ code: "refuse", reessayable: false, message: `Paramètre « ${nom} » invalide.` });
  return n;
}

export const extrait: Operation = async (demande, contexte) => {
  const media = demande.entrees.media;
  if (!media) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Entrée « media » manquante." });
  const type = demande.parametres.type === "audio" ? "audio" : demande.parametres.type === "video" ? "video" : null;
  if (!type) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Type d'extrait inconnu." });
  const debutSec = nombre(demande.parametres.debutSec, "debutSec");
  const dureeSec = nombre(demande.parametres.dureeSec, "dureeSec");
  if (dureeSec <= 0 || dureeSec > 600) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Durée d'extrait hors limites." });
  const sortie = join(contexte.dossier, type === "audio" ? "extrait.wav" : "extrait.mp4");
  contexte.progression(5);
  await executer(FFMPEG, argumentsExtrait({ source: media, sortie, type, debutSec, dureeSec, videoKbps: Number(demande.parametres.videoKbps) || undefined, largeur: Number(demande.parametres.largeur) || undefined }), contexte.signal);
  contexte.progression(80);
  const probe = JSON.parse(await executer(FFPROBE, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", sortie], contexte.signal)) as { streams?: { codec_type?: string; width?: number; height?: number }[]; format?: { duration?: string } };
  const video = probe.streams?.find((s) => s.codec_type === "video");
  const { size } = await stat(sortie);
  await deposer(demande.sortie.urlDepot, sortie, type === "audio" ? "audio/wav" : "video/mp4", contexte.signal);
  contexte.progression(100);
  return { mesures: { dureeSec: Number(probe.format?.duration ?? dureeSec), taille: size, ...(video ? { largeur: video.width ?? 0, hauteur: video.height ?? 0 } : {}) } };
};
