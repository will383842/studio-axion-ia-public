/**
 * Analyse d'une image rendue (PNG) : cherche la plus grande ZONE VIDE d'une page, sans dépendance (décodeur PNG minimal).
 * Une zone vide est un rectangle sans aucun pixel « fort » (encre, orange, crème sur fond sombre…), c'est-à-dire sans
 * rien d'autre que le fond de la page ou le remplissage pâle d'une carte. Un cadre vide d'une carte compte donc comme vide.
 */
import { inflateSync } from "node:zlib";

export interface ImageRgb {
  largeur: number;
  hauteur: number;
  /** Trois octets par pixel (R, V, B), ligne après ligne. */
  rgb: Uint8Array;
}

/** Décode un PNG 8 bits RVB ou RVBA sans entrelacement (ce que produit Remotion). Lève une erreur pour tout autre format. */
export function decoderPng(octets: Uint8Array): ImageRgb {
  const tampon = Buffer.from(octets);
  if (tampon.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("PNG attendu");
  let largeur = 0;
  let hauteur = 0;
  let canaux = 0;
  const donnees: Buffer[] = [];
  for (let i = 8; i < tampon.length; ) {
    const longueur = tampon.readUInt32BE(i);
    const type = tampon.toString("latin1", i + 4, i + 8);
    const corps = tampon.subarray(i + 8, i + 8 + longueur);
    if (type === "IHDR") {
      largeur = corps.readUInt32BE(0);
      hauteur = corps.readUInt32BE(4);
      const [profondeur, couleur, , , entrelace] = [corps[8], corps[9], corps[10], corps[11], corps[12]];
      if (profondeur !== 8 || (couleur !== 2 && couleur !== 6) || entrelace !== 0) throw new Error("PNG non géré (8 bits RVB/RVBA, sans entrelacement)");
      canaux = couleur === 2 ? 3 : 4;
    } else if (type === "IDAT") donnees.push(Buffer.from(corps));
    i += 12 + longueur;
  }
  const brut = inflateSync(Buffer.concat(donnees));
  const ligne = largeur * canaux;
  const pixels = Buffer.alloc(hauteur * ligne);
  for (let y = 0; y < hauteur; y++) {
    const filtre = brut[y * (ligne + 1)];
    const source = y * (ligne + 1) + 1;
    for (let x = 0; x < ligne; x++) {
      const a = x >= canaux ? pixels[y * ligne + x - canaux] : 0;
      const b = y > 0 ? pixels[(y - 1) * ligne + x] : 0;
      const c = x >= canaux && y > 0 ? pixels[(y - 1) * ligne + x - canaux] : 0;
      const v = brut[source + x];
      let pred = 0;
      if (filtre === 1) pred = a;
      else if (filtre === 2) pred = b;
      else if (filtre === 3) pred = (a + b) >> 1;
      else if (filtre === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filtre !== 0) throw new Error(`Filtre PNG inconnu : ${filtre}`);
      pixels[y * ligne + x] = (v + pred) & 255;
    }
  }
  const rgb = new Uint8Array(largeur * hauteur * 3);
  for (let p = 0; p < largeur * hauteur; p++) {
    rgb[p * 3] = pixels[p * canaux];
    rgb[p * 3 + 1] = pixels[p * canaux + 1];
    rgb[p * 3 + 2] = pixels[p * canaux + 2];
  }
  return { largeur, hauteur, rgb };
}

export interface ZoneVide {
  /** Hauteur (px) de la plus haute zone vide d'au moins `largeurMinPx` de large. */
  hauteurPx: number;
  /** Coin haut gauche (px) de cette zone. */
  x: number;
  y: number;
}

/** Écart de couleur (somme des écarts R + V + B) au-delà duquel un pixel n'est plus « le fond ». */
const SEUIL_COULEUR = 80;
const CELLULE = 10;

/**
 * Plus haute zone vide d'au moins `largeurMinPx` de large. Les fonds ignorés sont le pixel (2, 2) (le fond de la page)
 * et les couleurs de `fondsSupplementaires` (le remplissage pâle des cartes), au `SEUIL_COULEUR` près.
 */
export function plusHauteZoneVide(image: ImageRgb, fondsSupplementaires: readonly (readonly [number, number, number])[], largeurMinPx: number): ZoneVide {
  const { largeur, hauteur, rgb } = image;
  const px = (x: number, y: number) => [rgb[(y * largeur + x) * 3], rgb[(y * largeur + x) * 3 + 1], rgb[(y * largeur + x) * 3 + 2]] as const;
  const fonds = [px(2, 2), ...fondsSupplementaires];
  const fort = (x: number, y: number) => {
    const [r, g, b] = px(x, y);
    return fonds.every(([fr, fg, fb]) => Math.abs(r - fr) + Math.abs(g - fg) + Math.abs(b - fb) > SEUIL_COULEUR);
  };
  const colonnes = Math.floor(largeur / CELLULE);
  const lignes = Math.floor(hauteur / CELLULE);
  const fenetre = Math.ceil(largeurMinPx / CELLULE);
  const vide = Array.from({ length: lignes }, () => new Array<boolean>(colonnes).fill(true));
  for (let y = 0; y < lignes * CELLULE; y++) {
    for (let x = 0; x < colonnes * CELLULE; x++) {
      if (vide[Math.floor(y / CELLULE)][Math.floor(x / CELLULE)] && fort(x, y)) vide[Math.floor(y / CELLULE)][Math.floor(x / CELLULE)] = false;
    }
  }
  // Histogramme des cellules vides consécutives vers le haut ; pour chaque ligne, la plus haute fenêtre de `fenetre` colonnes.
  const haut = new Array<number>(colonnes).fill(0);
  let meilleur: ZoneVide = { hauteurPx: 0, x: 0, y: 0 };
  for (let l = 0; l < lignes; l++) {
    for (let c = 0; c < colonnes; c++) haut[c] = vide[l][c] ? haut[c] + 1 : 0;
    for (let c = 0; c + fenetre <= colonnes; c++) {
      const h = Math.min(...haut.slice(c, c + fenetre));
      if (h * CELLULE > meilleur.hauteurPx) meilleur = { hauteurPx: h * CELLULE, x: c * CELLULE, y: (l - h + 1) * CELLULE };
    }
  }
  return meilleur;
}
