// Vidéos sur le site, lot S4 — « lecture immédiate » d'un MP4 (PUR) : l'atome `moov` vient-il avant `mdat` ?
// On ne lit que les en-têtes d'atomes du début du fichier ; aucune lecture hors des octets donnés.

export type LectureImmediate = "oui" | "non" | "inconnu";

const TAILLE_ENTETE = 8;
const TAILLE_ENTETE_LARGE = 16;

const type4 = (o: Uint8Array, i: number) => String.fromCharCode(o[i], o[i + 1], o[i + 2], o[i + 3]);

/**
 * `"oui"` : `moov` avant `mdat` (le lecteur démarre sans télécharger tout le fichier) ; `"non"` : `mdat` d'abord ;
 * `"inconnu"` : octets tronqués, vides, atome illisible ou trop grand pour voir la suite (le stockage n'a pas donné
 * assez d'octets, ou ce n'est pas un MP4).
 */
export function lectureImmediate(octets: Uint8Array): LectureImmediate {
  const v = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  let pos = 0;
  while (pos + TAILLE_ENTETE <= octets.length) {
    const type = type4(octets, pos + 4);
    if (type === "moov") return "oui";
    if (type === "mdat") return "non";
    let taille = v.getUint32(pos);
    if (taille === 1) {
      // Taille sur 64 bits, juste après le type.
      if (pos + TAILLE_ENTETE_LARGE > octets.length) return "inconnu";
      const haut = v.getUint32(pos + 8);
      const bas = v.getUint32(pos + 12);
      taille = haut * 2 ** 32 + bas;
      if (!Number.isSafeInteger(taille) || taille < TAILLE_ENTETE_LARGE) return "inconnu";
    } else if (taille === 0) {
      // Atome qui court jusqu'à la fin du fichier, ni `moov` ni `mdat` : il n'y a rien derrière.
      return "inconnu";
    } else if (taille < TAILLE_ENTETE) {
      return "inconnu";
    }
    if (pos + taille > octets.length) return "inconnu";
    pos += taille;
  }
  return "inconnu";
}
