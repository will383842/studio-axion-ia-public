/**
 * Opération `analyse-media` (file courte) : ffprobe d'un rush lu directement sur son adresse R2 signée
 * (orientation, HDR, durée, cadence, taille). Sert au vérificateur de rushs (vidéo horizontale ou HDR refusée).
 * Entrée : `media`. Sortie : le rapport JSON déposé à `sortie.urlDepot` ; les mesures sont aussi rendues dans l'état.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ErreurRendu, type Operation } from "../contrat.js";
import { deposer, executer, exigerAdressePermise, FFPROBE } from "../outils.js";

interface FluxProbe {
  codec_type?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  color_transfer?: string;
  color_primaries?: string;
  pix_fmt?: string;
  side_data_list?: { rotation?: number; dv_profile?: number }[];
  tags?: { rotate?: string };
}

/** Mesures lisibles d'une sortie ffprobe (PUR, testé). */
export function lireProbe(json: string): Record<string, number> {
  const p = JSON.parse(json) as { streams?: FluxProbe[]; format?: { duration?: string; size?: string } };
  const video = p.streams?.find((s) => s.codec_type === "video");
  const audio = p.streams?.find((s) => s.codec_type === "audio");
  const [n, d] = (video?.r_frame_rate ?? "0/1").split("/").map(Number);
  const rotation = Math.abs(Number(video?.side_data_list?.find((x) => x.rotation !== undefined)?.rotation ?? video?.tags?.rotate ?? 0)) % 180;
  const largeur = video?.width ?? 0;
  const hauteur = video?.height ?? 0;
  // Une rotation de 90° échange largeur et hauteur à l'affichage.
  const [l, h] = rotation === 90 ? [hauteur, largeur] : [largeur, hauteur];
  const transfert = video?.color_transfer ?? "";
  return {
    dureeSec: Number(p.format?.duration ?? 0),
    taille: Number(p.format?.size ?? 0),
    largeur: l,
    hauteur: h,
    vertical: h > l ? 1 : 0,
    fps: d ? Math.round((n / d) * 100) / 100 : 0,
    hdr: transfert === "arib-std-b67" || transfert === "smpte2084" ? 1 : 0,
    // 09/10 : détail du HDR iPhone (HLG, souvent Dolby Vision 8.4), converti en SDR BT.709 par la préparation de
    // studio-aligneur (table 3D, `media.filtre_preparation`) avant la passe image.
    hlg: transfert === "arib-std-b67" ? 1 : 0,
    pq: transfert === "smpte2084" ? 1 : 0,
    bt2020: video?.color_primaries === "bt2020" ? 1 : 0,
    dolbyVision: Number(video?.side_data_list?.find((x) => x.dv_profile !== undefined)?.dv_profile ?? 0),
    bits10: /p10|p12|p16/.test(video?.pix_fmt ?? "") ? 1 : 0,
    audio: audio ? 1 : 0,
  };
}

/** Formats qu'une analyse peut lire : jamais une liste de lecture (HLS, concat…) qui irait chercher d'autres adresses. */
export const FORMATS_ANALYSE = "mov,matroska,webm,avi,mp3,wav,flac,ogg,aac,image2,png_pipe,jpeg_pipe,webp_pipe";

export const analyseMedia: Operation = async (demande, contexte) => {
  if (!demande.entrees.media) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Entrée « media » manquante." });
  // Relecture sécurité R45 n° 4 : seulement une adresse du stockage du studio, lue par les seuls protocoles du réseau.
  // 2e lecture, A : ffprobe ne reçoit que l'adresse normalisée, exactement celle qui a été vérifiée.
  const media = exigerAdressePermise(demande.entrees.media);
  contexte.progression(10);
  const protocoles = /^https:/i.test(media) ? "https,tls,tcp" : "http,tcp";
  const json = await executer(FFPROBE, ["-v", "error", "-protocol_whitelist", protocoles, "-format_whitelist", FORMATS_ANALYSE, "-print_format", "json", "-show_format", "-show_streams", media], contexte.signal);
  const mesures = lireProbe(json);
  const chemin = join(contexte.dossier, "analyse.json");
  await writeFile(chemin, JSON.stringify({ mesures, brut: JSON.parse(json) }));
  contexte.progression(80);
  await deposer(demande.sortie.urlDepot, chemin, "application/json", contexte.signal);
  return { mesures };
};
