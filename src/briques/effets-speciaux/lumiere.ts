/**
 * LUMIÈRE DE LA VRAIE PRISE (lot F3) : direction, teinte et intensité, pour éclairer l'objet 3D comme Will est
 * éclairé. PUR, sans alias « @/ ».
 *
 * `estimerLumiere` lit les pixels RVB d'une image de la prise (zone du visage) : le côté le plus clair du visage
 * donne la direction ; les pixels les plus clairs, la teinte de la lumière ; les plus sombres, l'ambiance. À défaut
 * d'image, `lumiereParDefaut` part de la luminance médiane du visage (piste `/visages`).
 */
import type { CaracterePrise, CarteEnvironnement, Lumiere } from "./types";

const borne = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function hex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(borne(v, 0, 255)).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** Lumière douce de face, légèrement chaude (pièce éclairée ordinaire). */
export function lumiereParDefaut(luminanceVisage?: number): Lumiere {
  const intensite = typeof luminanceVisage === "number" ? borne(luminanceVisage / 120, 0.55, 1.35) : 1;
  return { directionX: -0.35, directionY: 0.55, teinte: "#FFE6CC", ambiance: "#3A2A20", intensite: +intensite.toFixed(3), temperatureK: temperatureDe("#FFE6CC") };
}

/**
 * Estime la lumière d'après une image RVB (3 octets par pixel, lignes de `largeur` pixels). `zone` : boîte du visage
 * en pixels (x, y, l, h) ; absente, l'image entière.
 */
export function estimerLumiere(rvb: ArrayLike<number>, largeur: number, hauteur: number, zone?: [number, number, number, number]): Lumiere {
  const [zx, zy, zl, zh] = zone ?? [0, 0, largeur, hauteur];
  const x0 = Math.max(0, Math.floor(zx));
  const y0 = Math.max(0, Math.floor(zy));
  const x1 = Math.min(largeur, Math.ceil(zx + zl));
  const y1 = Math.min(hauteur, Math.ceil(zy + zh));
  if (x1 - x0 < 4 || y1 - y0 < 4) return lumiereParDefaut();
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  let gauche = 0;
  let droite = 0;
  let haut = 0;
  let bas = 0;
  let nG = 0;
  let nD = 0;
  let nH = 0;
  let nB = 0;
  const lums: { l: number; r: number; g: number; b: number }[] = [];
  const pas = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 4000)));
  for (let y = y0; y < y1; y += pas) {
    for (let x = x0; x < x1; x += pas) {
      const k = (y * largeur + x) * 3;
      const r = rvb[k];
      const g = rvb[k + 1];
      const b = rvb[k + 2];
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lums.push({ l, r, g, b });
      if (x < mx) {
        gauche += l;
        nG++;
      } else {
        droite += l;
        nD++;
      }
      if (y < my) {
        haut += l;
        nH++;
      } else {
        bas += l;
        nB++;
      }
    }
  }
  const lg = gauche / Math.max(1, nG);
  const ld = droite / Math.max(1, nD);
  const lh = haut / Math.max(1, nH);
  const lb = bas / Math.max(1, nB);
  lums.sort((a, b) => a.l - b.l);
  const moyenne = (t: typeof lums) => t.reduce((s, p) => ({ r: s.r + p.r / t.length, g: s.g + p.g / t.length, b: s.b + p.b / t.length, l: s.l + p.l / t.length }), { r: 0, g: 0, b: 0, l: 0 });
  const clairs = moyenne(lums.slice(Math.floor(lums.length * 0.9)));
  const sombres = moyenne(lums.slice(0, Math.max(1, Math.floor(lums.length * 0.3))));
  const tous = moyenne(lums);
  // Teinte de la lumière : la couleur des hautes lumières, ramenée à pleine luminosité (seule la couleur compte).
  const m = Math.max(clairs.r, clairs.g, clairs.b, 1);
  const teinte = hex((clairs.r / m) * 255, (clairs.g / m) * 255, (clairs.b / m) * 255);
  return {
    temperatureK: temperatureDe(teinte),
    directionX: +borne(((ld - lg) / Math.max(1, ld + lg)) * 6, -1, 1).toFixed(3),
    directionY: +borne(((lh - lb) / Math.max(1, lh + lb)) * 6 + 0.35, -1, 1).toFixed(3),
    teinte,
    ambiance: hex(sombres.r * 0.6, sombres.g * 0.6, sombres.b * 0.6),
    intensite: +borne(tous.l / 115, 0.5, 1.4).toFixed(3),
  };
}

/* ------------------------------------------------------------------ */
/* Lot I2 : température, reflets de la pièce, flou et grain de la prise */
/* ------------------------------------------------------------------ */

const lineaire = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

/** Température de couleur (K) d'une teinte `#RRGGBB` (formule de McCamy), bornée à 1 800 - 12 000 K. */
export function temperatureDe(teinte: string): number {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(teinte.trim());
  if (!m) return 5000;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => lineaire(parseInt(h, 16)));
  const X = 0.4124 * r + 0.3576 * g + 0.1805 * b;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = 0.0193 * r + 0.1192 * g + 0.9505 * b;
  const somme = X + Y + Z;
  if (somme <= 1e-6) return 5000;
  const x = X / somme;
  const y = Y / somme;
  const n = (x - 0.332) / (0.1858 - y);
  const cct = 449 * n ** 3 + 3525 * n ** 2 + 6823.3 * n + 5520.33;
  return Math.round(borne(cct, 1800, 12000) / 50) * 50;
}

/** Grille de moyennes (boîtes) de l'image : `gl` × `gh` cellules RVB. */
function grilleMoyennes(rvb: ArrayLike<number>, largeur: number, hauteur: number, gl: number, gh: number): number[] {
  const sortie = new Array(gl * gh * 3).fill(0);
  const pas = Math.max(1, Math.floor(Math.min(largeur / gl, hauteur / gh) / 4));
  for (let cy = 0; cy < gh; cy++) {
    for (let cx = 0; cx < gl; cx++) {
      const x0 = Math.floor((cx * largeur) / gl);
      const x1 = Math.max(x0 + 1, Math.floor(((cx + 1) * largeur) / gl));
      const y0 = Math.floor((cy * hauteur) / gh);
      const y1 = Math.max(y0 + 1, Math.floor(((cy + 1) * hauteur) / gh));
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = y0; y < y1; y += pas)
        for (let x = x0; x < x1; x += pas) {
          const k = (y * largeur + x) * 3;
          r += rvb[k];
          g += rvb[k + 1];
          b += rvb[k + 2];
          n++;
        }
      const o = (cy * gl + cx) * 3;
      sortie[o] = r / Math.max(1, n);
      sortie[o + 1] = g / Math.max(1, n);
      sortie[o + 2] = b / Math.max(1, n);
    }
  }
  return sortie;
}

/**
 * Carte d'environnement (panorama équirectangulaire, `largeur` × `hauteur`, ligne 0 = vers le BAS) construite à partir
 * de l'image de la prise : devant l'objet (ce que voit la caméra), l'image elle-même, très adoucie ; derrière la
 * caméra (jamais filmé), son reflet en miroir, un peu assombri — l'astuce classique des incrustations : les reflets
 * du métal et du verre reprennent les couleurs et les clartés de la vraie pièce. Repère : x droite, y haut, z vers
 * la caméra ; u = 0,25 regarde la scène (−z), u = 0,75 la caméra (+z), comme le placage équirectangulaire de Three.js.
 */
export function carteEnvironnement(rvb: ArrayLike<number>, largeur: number, hauteur: number, opts: { largeur?: number; hauteur?: number } = {}): CarteEnvironnement {
  const L = opts.largeur ?? 64;
  const H = opts.hauteur ?? 32;
  const gl = 24;
  const gh = Math.max(8, Math.round((gl * hauteur) / Math.max(1, largeur)));
  const grille = grilleMoyennes(rvb, largeur, hauteur, gl, gh);
  const lire = (u: number, v: number) => {
    // Bilinéaire sur la grille, bords prolongés.
    const fx = borne(u * gl - 0.5, 0, gl - 1);
    const fy = borne(v * gh - 0.5, 0, gh - 1);
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const x1 = Math.min(gl - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1);
    const ax = fx - x0, ay = fy - y0;
    const p = (x: number, y: number, c: number) => grille[(y * gl + x) * 3 + c];
    return [0, 1, 2].map((c) => (p(x0, y0, c) * (1 - ax) + p(x1, y0, c) * ax) * (1 - ay) + (p(x0, y1, c) * (1 - ax) + p(x1, y1, c) * ax) * ay);
  };
  const format = hauteur / Math.max(1, largeur);
  const pixels: number[] = [];
  for (let j = 0; j < H; j++) {
    const lat = ((j + 0.5) / H - 0.5) * Math.PI;
    for (let i = 0; i < L; i++) {
      const lon = ((i + 0.5) / L - 0.5) * 2 * Math.PI;
      // Même placage que Three.js : u = atan2(z, x) / 2π + 0,5.
      const dx = Math.cos(lat) * Math.cos(lon);
      const dz = Math.cos(lat) * Math.sin(lon);
      const dy = Math.sin(lat);
      const avant = dz <= 0;
      const profondeur = Math.max(0.35, Math.abs(dz));
      // Projection perspective large (≈ 100°) sur l'image ; derrière la caméra, en miroir.
      const u = 0.5 + ((avant ? dx : -dx) / profondeur) * 0.42;
      const v = 0.5 - (dy / profondeur) * 0.42 / Math.max(0.5, format);
      const c = lire(borne(u, 0, 1), borne(v, 0, 1));
      const k = avant ? 1 : 0.78;
      for (const x of c) pixels.push(Math.round(borne(x * k, 0, 255)));
    }
  }
  return { largeur: L, hauteur: H, pixels };
}

/**
 * Caractère de la prise autour de la main (zone en px de l'image lue) : grain (écart type du bruit sur les zones
 * unies, 0-255) et flou (largeur des contours nets, ramenée en px de SORTIE par `echelle` = px de sortie par px lu).
 */
export function caracterePrise(rvb: ArrayLike<number>, largeur: number, hauteur: number, zone?: [number, number, number, number], echelle = 1): CaracterePrise {
  const [zx, zy, zl, zh] = zone ?? [0, 0, largeur, hauteur];
  const x0 = Math.max(2, Math.floor(zx));
  const y0 = Math.max(2, Math.floor(zy));
  const x1 = Math.min(largeur - 3, Math.ceil(zx + zl));
  const y1 = Math.min(hauteur - 3, Math.ceil(zy + zh));
  if (x1 - x0 < 8 || y1 - y0 < 8) return { flouPx: 0, grain: 2 };
  const lum = (x: number, y: number) => {
    const k = (y * largeur + x) * 3;
    return 0.2126 * rvb[k] + 0.7152 * rvb[k + 1] + 0.0722 * rvb[k + 2];
  };
  const bruits: number[] = [];
  const largeurs: number[] = [];
  const pas = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 20000)));
  for (let y = y0; y < y1; y += pas) {
    for (let x = x0; x < x1; x += pas) {
      const c = lum(x, y);
      const gx = (lum(x + 1, y) - lum(x - 1, y)) / 2;
      const gy = (lum(x, y + 1) - lum(x, y - 1)) / 2;
      const g = Math.hypot(gx, gy);
      const lap = c - (lum(x + 1, y) + lum(x - 1, y) + lum(x, y + 1) + lum(x, y - 1)) / 4;
      if (g < 3) bruits.push(Math.abs(lap));
      else if (g > 12) {
        // Largeur du contour : écart des clartés sur ±2 px dans le sens du gradient, rapporté à la pente maximale.
        const ux = gx / g;
        const uy = gy / g;
        const a = lum(Math.round(x - 2 * ux), Math.round(y - 2 * uy));
        const b = lum(Math.round(x + 2 * ux), Math.round(y + 2 * uy));
        const saut = Math.abs(b - a);
        if (saut > 20) largeurs.push(saut / g);
      }
    }
  }
  const mediane = (t: number[]) => {
    if (!t.length) return 0;
    const s = [...t].sort((p, q) => p - q);
    return s[Math.floor(s.length / 2)];
  };
  // Laplacien d'un bruit blanc σ : écart moyen absolu ≈ 0,89 σ ; contour net : largeur ≈ 1,3 px.
  const grain = borne(mediane(bruits) * 1.48 / 1.12, 0.5, 14);
  const flou = borne((mediane(largeurs) - 1.3) * 0.7, 0, 8) * echelle;
  return { flouPx: +flou.toFixed(2), grain: +grain.toFixed(2) };
}
