/**
 * Image d'une épingle (PUR) : le type RÉEL et les dimensions se lisent dans les premiers octets (PNG, JPEG, WebP), jamais dans
 * l'extension. Règles (ADR-0015) : JPEG, PNG ou WebP ; ratio 2:3 à ± 1 % ; largeur ≥ 1 000 px ; 20 Mo au plus.
 */
export type MimeEpingle = "image/jpeg" | "image/png" | "image/webp";
export interface EnteteImage {
  mime: MimeEpingle;
  largeur: number;
  hauteur: number;
}

export const EPINGLE_LARGEUR_MIN = 1000;
export const EPINGLE_TAILLE_MAX = 20 * 1024 * 1024;
export const EPINGLE_OCTETS_ENTETE = 65_536;

const u32 = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const l24 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.slice(i, i + n));

/** Type réel et dimensions depuis les premiers octets ; null si ce n'est ni un PNG, ni un JPEG, ni un WebP lisible. */
export function lireEnteteImage(b: Uint8Array): EnteteImage | null {
  // PNG : signature puis IHDR.
  if (b.length >= 24 && b[0] === 0x89 && ascii(b, 1, 3) === "PNG") {
    const largeur = u32(b, 16);
    const hauteur = u32(b, 20);
    return largeur > 0 && hauteur > 0 ? { mime: "image/png", largeur, hauteur } : null;
  }
  // JPEG : on cherche un marqueur SOFn.
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        const hauteur = (b[i + 5] << 8) | b[i + 6];
        const largeur = (b[i + 7] << 8) | b[i + 8];
        return largeur > 0 && hauteur > 0 ? { mime: "image/jpeg", largeur, hauteur } : null;
      }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      i += 2 + ((b[i + 2] << 8) | b[i + 3]);
    }
    return null;
  }
  // WebP : RIFF....WEBP puis VP8 (avec perte), VP8L (sans perte) ou VP8X (étendu).
  if (b.length >= 30 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") {
    const type = ascii(b, 12, 4);
    if (type === "VP8X") return { mime: "image/webp", largeur: l24(b, 24) + 1, hauteur: l24(b, 27) + 1 };
    if (type === "VP8L" && b[20] === 0x2f) {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { mime: "image/webp", largeur: (bits & 0x3fff) + 1, hauteur: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (type === "VP8 " && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
      return { mime: "image/webp", largeur: (b[26] | (b[27] << 8)) & 0x3fff, hauteur: (b[28] | (b[29] << 8)) & 0x3fff };
    }
  }
  return null;
}

/** Raisons pour lesquelles l'image ne convient pas à une épingle ; liste vide = conforme. */
export function raisonsImageEpingle(e: EnteteImage | null, taille: number): string[] {
  if (!e) return ["image : ni PNG, ni JPEG, ni WebP lisible"];
  const r: string[] = [];
  if (e.largeur < EPINGLE_LARGEUR_MIN) r.push(`image : largeur ${e.largeur} px, 1 000 px au moins`);
  if (Math.abs(e.largeur / e.hauteur - 2 / 3) > (2 / 3) * 0.01) r.push(`image : ${e.largeur} × ${e.hauteur}, le format 2:3 (± 1 %) est exigé`);
  if (taille > EPINGLE_TAILLE_MAX) r.push("image : 20 Mo au plus");
  if (taille <= 0) r.push("image : fichier vide");
  return r;
}

export const EXTENSION_DE_MIME: Record<MimeEpingle, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
