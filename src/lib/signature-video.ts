/**
 * SIGNATURE D'UN FICHIER VIDÉO (lot R7, relecture sécurité n° 3) : le type d'un fichier est lu dans ses PREMIERS
 * OCTETS, jamais dans ce qu'il déclare (`video/mp4` du navigateur ou imposé au téléchargement). FFmpeg reconnaît le
 * format par le contenu : une liste de lecture (`#EXTM3U`) déguisée en « .mp4 » lui ferait suivre des adresses.
 * Acceptés : ISO-BMFF (MP4, MOV : `ftyp` aux octets 4 à 7) et Matroska / WebM (`1A 45 DF A3` au début).
 * Même règle dans studio-rendu (`studio-rendu/src/entrees-video.ts`).
 */

/** Octets à lire pour reconnaître le format. */
export const OCTETS_SIGNATURE = 16;

export type FormatVideo = "iso-bmff" | "matroska";

/** Format reconnu dans les premiers octets, sinon null. PUR, testé. */
export function signatureVideo(debut: Uint8Array): FormatVideo | null {
  if (debut.length >= 8 && debut[4] === 0x66 && debut[5] === 0x74 && debut[6] === 0x79 && debut[7] === 0x70) return "iso-bmff";
  if (debut.length >= 4 && debut[0] === 0x1a && debut[1] === 0x45 && debut[2] === 0xdf && debut[3] === 0xa3) return "matroska";
  return null;
}
