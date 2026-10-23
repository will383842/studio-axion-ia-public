/**
 * ENTRÉES DE PRISE SÛRES POUR FFMPEG (lot R7, relecture sécurité n° 3, défense en profondeur).
 * Le studio vérifie déjà les premiers octets avant de ranger une prise (`src/lib/signature-video.ts`) ; ici, chaque
 * prise téléchargée est rouverte avec :
 *  - `-protocol_whitelist file` : FFmpeg ne lit que le fichier local, jamais une adresse qu'il contiendrait ;
 *  - `-f mov` ou `-f matroska` : le démultiplexeur est IMPOSÉ d'après les premiers octets (`ftyp` à l'octet 4 ou
 *    `1A 45 DF A3`), jamais deviné par FFmpeg (une liste de lecture `#EXTM3U` déguisée en « .mp4 » est refusée).
 */
import { open } from "node:fs/promises";
import { ErreurRendu } from "./contrat.js";

/** Démultiplexeur FFmpeg reconnu dans les premiers octets, sinon null (PUR, testé). */
export function demultiplexeurPrise(debut: Uint8Array): "mov" | "matroska" | null {
  if (debut.length >= 8 && debut[4] === 0x66 && debut[5] === 0x74 && debut[6] === 0x79 && debut[7] === 0x70) return "mov";
  if (debut.length >= 4 && debut[0] === 0x1a && debut[1] === 0x45 && debut[2] === 0xdf && debut[3] === 0xa3) return "matroska";
  return null;
}

/** Options d'entrée FFmpeg d'une prise LOCALE (à placer juste avant son `-i`) ; refus si ce n'est pas une vidéo. */
export async function optionsEntreePrise(chemin: string): Promise<string[]> {
  const f = await open(chemin, "r");
  const debut = new Uint8Array(16);
  try {
    await f.read(debut, 0, 16, 0);
  } finally {
    await f.close();
  }
  const format = demultiplexeurPrise(debut);
  if (!format) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Une prise n'est pas une vidéo reconnue." });
  return ["-protocol_whitelist", "file", "-f", format];
}
