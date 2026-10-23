/**
 * MAT-B · tuiles de bruit en PNG, calculées en JS (PUR, déterministe : générateur de Park-Miller à graine fixe, aucun
 * hasard). Remplace le filtre SVG `feTurbulence` de la maquette : même allure (grain fin + nuages larges, en
 * encre et lueur de la charte), mais le navigateur ne fait plus que répéter une image (le filtre coûtait ≈ +0,5 s par
 * tuile et par image fixe). PNG RGBA non compressé (blocs « stockés » de zlib) : aucun module, ni Node ni navigateur.
 * Calcul paresseux (au premier appel), jamais au chargement du module.
 */
import { alea } from "./trait";

const TABLE_CRC = (() => {
  let table: Uint32Array | null = null;
  return () => {
    if (table) return table;
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  };
})();

function crc32(octets: Uint8Array): number {
  const t = TABLE_CRC();
  let c = 0xffffffff;
  for (let i = 0; i < octets.length; i++) c = t[(c ^ octets[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloc(type: string, donnees: Uint8Array): Uint8Array {
  const sortie = new Uint8Array(12 + donnees.length);
  const vue = new DataView(sortie.buffer);
  vue.setUint32(0, donnees.length);
  for (let i = 0; i < 4; i++) sortie[4 + i] = type.charCodeAt(i);
  sortie.set(donnees, 8);
  vue.setUint32(8 + donnees.length, crc32(sortie.subarray(4, 8 + donnees.length)));
  return sortie;
}

/** zlib sans compression (blocs stockés de 65 535 octets au plus) + somme Adler-32. */
function zlibStocke(brut: Uint8Array): Uint8Array {
  const n = Math.ceil(brut.length / 65535) || 1;
  const sortie = new Uint8Array(2 + brut.length + 5 * n + 4);
  sortie[0] = 0x78;
  sortie[1] = 0x01;
  let o = 2;
  for (let k = 0; k < n; k++) {
    const part = brut.subarray(k * 65535, Math.min(brut.length, (k + 1) * 65535));
    sortie[o++] = k === n - 1 ? 1 : 0;
    sortie[o++] = part.length & 0xff;
    sortie[o++] = part.length >>> 8;
    sortie[o++] = ~part.length & 0xff;
    sortie[o++] = (~part.length >>> 8) & 0xff;
    sortie.set(part, o);
    o += part.length;
  }
  let a = 1;
  let b = 0;
  for (let i = 0; i < brut.length; i++) {
    a = (a + brut[i]) % 65521;
    b = (b + a) % 65521;
  }
  new DataView(sortie.buffer).setUint32(o, ((b << 16) | a) >>> 0);
  return sortie;
}

/** Image PNG (adresse `data:`) d'une couleur unie dont seule l'opacité varie (`alpha` : côté × côté octets). */
export function pngAlpha(cote: number, rgb: [number, number, number], alpha: Uint8Array): string {
  const brut = new Uint8Array(cote * (1 + 4 * cote));
  for (let y = 0; y < cote; y++) {
    const r = y * (1 + 4 * cote);
    for (let x = 0; x < cote; x++) {
      const p = r + 1 + 4 * x;
      brut[p] = rgb[0];
      brut[p + 1] = rgb[1];
      brut[p + 2] = rgb[2];
      brut[p + 3] = alpha[y * cote + x];
    }
  }
  const entete = new Uint8Array(13);
  const v = new DataView(entete.buffer);
  v.setUint32(0, cote);
  v.setUint32(4, cote);
  entete.set([8, 6, 0, 0, 0], 8);
  const morceaux = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), bloc("IHDR", entete), bloc("IDAT", zlibStocke(brut)), bloc("IEND", new Uint8Array(0))];
  let binaire = "";
  for (const m of morceaux) for (let i = 0; i < m.length; i++) binaire += String.fromCharCode(m[i]);
  return `data:image/png;base64,${btoa(binaire)}`;
}

/** Bruit de valeurs PÉRIODIQUE (la tuile se raccorde) dans [0, 1] : `octaves` grilles de 4, 8, 16… cases. */
export function bruitPeriodique(cote: number, octaves: number, graine: number, cases0 = 4): Float32Array {
  const r = alea(graine);
  const sortie = new Float32Array(cote * cote);
  let amplitude = 0.5;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = cases0 << o;
    const grille = Array.from({ length: n * n }, () => (r() + 1) / 2);
    const lisse = (u: number) => u * u * (3 - 2 * u);
    for (let y = 0; y < cote; y++) {
      const gy = (y / cote) * n;
      const y0 = Math.floor(gy);
      const fy = lisse(gy - y0);
      for (let x = 0; x < cote; x++) {
        const gx = (x / cote) * n;
        const x0 = Math.floor(gx);
        const fx = lisse(gx - x0);
        const v = (i: number, j: number) => grille[(j % n) * n + (i % n)];
        const haut = v(x0, y0) * (1 - fx) + v(x0 + 1, y0) * fx;
        const bas = v(x0, y0 + 1) * (1 - fx) + v(x0 + 1, y0 + 1) * fx;
        sortie[y * cote + x] += amplitude * (haut * (1 - fy) + bas * fy);
      }
    }
    total += amplitude;
    amplitude /= 2;
  }
  for (let i = 0; i < sortie.length; i++) sortie[i] /= total;
  return sortie;
}

/** alpha = 255 × max(0, k × bruit + b), comme la matrice de couleur de la maquette. */
function voile(bruit: Float32Array, k: number, b: number): Uint8Array {
  return Uint8Array.from(bruit, (n) => Math.round(255 * Math.max(0, Math.min(1, k * n + b))));
}

let tuiles: { grain: string; nuages: string } | null = null;

/** Les deux tuiles du papier (calculées une fois) : grain fin 128 px (encre), nuages 64 px étirés (lueur). */
export function tuilesPapier(): { grain: string; nuages: string } {
  if (tuiles) return tuiles;
  const r = alea(4);
  const blanc = Float32Array.from({ length: 128 * 128 }, () => (r() + 1) / 2);
  tuiles = {
    grain: pngAlpha(128, [0x15, 0x10, 0x0c], voile(blanc, 0.3, -0.1)),
    nuages: pngAlpha(64, [0x7a, 0x34, 0x18], voile(bruitPeriodique(64, 4, 11), 0.13, -0.045)),
  };
  return tuiles;
}
