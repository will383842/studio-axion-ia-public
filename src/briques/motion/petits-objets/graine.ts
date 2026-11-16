/** Graine des petits objets. FNV-1a 32 bits COPIÉ de la mémoire d'écriture commune du domaine (non importé). Pur. */

export function fnv1a32(texte: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function graineObjet(idVideo: string, indice: number): number {
  return fnv1a32(`${idVideo}#${indice}`);
}

/** Valeur pure dans [0, 1[ pour (graine, n). */
export function aleaGraine(graine: number, n: number): number {
  let h = (graine ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}
