/**
 * SUPPORTS DES TROIS STYLES DU TABLEAU (portés des maquettes validées, PR #280, `gabarit.html`) : tableau blanc à cadre
 * aluminium et auget (A), ardoise mate à cadre bois, filet de craie et rebord à craies (B), feuille de paperboard sur
 * chevalet, pince et auget à marqueurs (C). Fabriqués UNE FOIS par onglet (bruit à graine fixe, aucune image
 * extérieure) puis posés à chaque image : aucun filtre coûteux par image. Textures de matière de l'encre : grain de la
 * craie, stries du feutre, grain du papier.
 */
import { alea, densifier, tremble, plume } from "../../../../src/briques/tableau-scene/trois-styles/trace";
import { CHARTES_TABLEAU, type StyleTableau } from "../../../../src/briques/tableau-scene/trois-styles/styles";
import type { MiseEnPageTableauStyle } from "../../../../src/briques/tableau-scene/trois-styles/types";

export type Ctx = CanvasRenderingContext2D;

export function toile(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function assombrir(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(((n >> 16) & 255) * f) | 0},${(((n >> 8) & 255) * f) | 0},${((n & 255) * f) | 0})`;
}
export function eclaircir(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgb(${(r + (255 - r) * f) | 0},${(g + (255 - g) * f) | 0},${(b + (255 - b) * f) | 0})`;
}

/** Bruit de valeur (octaves) en niveaux de gris. */
function bruit(w: number, h: number, cellules: number, graine: number, octaves = 4): HTMLCanvasElement {
  const c = toile(w, h);
  const g = c.getContext("2d")!;
  const r = alea(graine);
  g.fillStyle = "#808080";
  g.fillRect(0, 0, w, h);
  let poids = 0.5;
  for (let o = 0; o < octaves; o++) {
    const cw = Math.max(2, Math.ceil(w / cellules));
    const ch = Math.max(2, Math.ceil(h / cellules));
    const p = toile(cw, ch);
    const pg = p.getContext("2d")!;
    const im = pg.createImageData(cw, ch);
    for (let i = 0; i < cw * ch; i++) {
      const v = r() * 255;
      im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v;
      im.data[i * 4 + 3] = 255;
    }
    pg.putImageData(im, 0, 0);
    g.globalAlpha = poids;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(p, 0, 0, w, h);
    cellules /= 2.2;
    poids *= 0.55;
  }
  g.globalAlpha = 1;
  return c;
}

/** Grain fin : chaque pixel reçoit une couleur RGBA tirée autour d'une base. */
function grain(w: number, h: number, graine: number, fn: (r: () => number) => [number, number, number, number]): HTMLCanvasElement {
  const c = toile(w, h);
  const g = c.getContext("2d")!;
  const im = g.createImageData(c.width, c.height);
  const r = alea(graine);
  for (let i = 0; i < c.width * c.height; i++) {
    const [R, G, B, A] = fn(r);
    im.data[i * 4] = R;
    im.data[i * 4 + 1] = G;
    im.data[i * 4 + 2] = B;
    im.data[i * 4 + 3] = A;
  }
  g.putImageData(im, 0, 0);
  return c;
}

export interface Support {
  fond: HTMLCanvasElement;
  /** Matières de l'encre (selon le style). */
  grainCraie?: HTMLCanvasElement;
  stries?: HTMLCanvasElement;
  grainPapier?: HTMLCanvasElement;
}

const CACHE = new Map<string, Support>();

/** Le support d'un style à une taille donnée (fabriqué une fois, puis réutilisé). */
export function support(style: StyleTableau, W: number, H: number, k: number, geo: MiseEnPageTableauStyle): Support {
  const cle = `${style}:${W}x${H}:${k}:${geo.basSupport}:${geo.contenu.x},${geo.contenu.y},${geo.contenu.largeur},${geo.contenu.hauteur}`;
  const deja = CACHE.get(cle);
  if (deja) return deja;
  const s = fabriquer(style, W, H, k, geo);
  CACHE.set(cle, s);
  return s;
}

function cylindre(g: Ctx, x: number, y: number, L: number, d: number, base: string, reflet = 0.35) {
  const gr = g.createLinearGradient(0, y - d / 2, 0, y + d / 2);
  gr.addColorStop(0, assombrir(base, 0.7));
  gr.addColorStop(0.3, eclaircir(base, reflet));
  gr.addColorStop(0.55, base);
  gr.addColorStop(1, assombrir(base, 0.45));
  g.fillStyle = gr;
  g.beginPath();
  g.roundRect(x, y - d / 2, L, d, d * 0.3);
  g.fill();
}

function alu(g: Ctx, W: number, x: number, y: number, w: number, h: number, sens: "h" | "v") {
  const gr = sens === "h" ? g.createLinearGradient(0, y, 0, y + h) : g.createLinearGradient(x, 0, x + w, 0);
  if (sens === "h") {
    gr.addColorStop(0, "#77716B");
    gr.addColorStop(0.18, "#D8D4CF");
    gr.addColorStop(0.4, "#F2F0ED");
    gr.addColorStop(0.62, "#BBB6B0");
    gr.addColorStop(0.9, "#8F8983");
    gr.addColorStop(1, "#5E5852");
  } else {
    const l = x < W / 2;
    gr.addColorStop(l ? 0 : 1, "#6A645E");
    gr.addColorStop(l ? 0.25 : 0.75, "#CFCAC4");
    gr.addColorStop(0.5, "#EEEBE7");
    gr.addColorStop(l ? 0.8 : 0.2, "#A9A39D");
    gr.addColorStop(l ? 1 : 0, "#5E5852");
  }
  g.fillStyle = gr;
  g.fillRect(x, y, w, h);
  g.globalAlpha = 0.08;
  g.fillStyle = "#3A322C";
  const r = alea(Math.round(x + y + w));
  for (let i = 0; i < (sens === "h" ? 260 : 400); i++) {
    if (sens === "h") g.fillRect(x + r() * w, y + r() * h, 20 + r() * 80, 1);
    else g.fillRect(x + r() * w, y + r() * h, 1, 20 + r() * 80);
  }
  g.globalAlpha = 1;
}

function bois(g: Ctx, W: number, x: number, y: number, w: number, h: number, sens: "h" | "v") {
  const gr = sens === "h" ? g.createLinearGradient(0, y, 0, y + h) : g.createLinearGradient(x, 0, x + w, 0);
  gr.addColorStop(0, "#2A1A10");
  gr.addColorStop(0.3, "#5A3A24");
  gr.addColorStop(0.55, "#6B4A30");
  gr.addColorStop(1, "#24160D");
  g.fillStyle = gr;
  g.fillRect(x, y, w, h);
  const r = alea(Math.round(x * 7 + y + 3));
  g.strokeStyle = "rgba(20,10,4,0.35)";
  g.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    g.beginPath();
    if (sens === "h") {
      const yy = y + r() * h;
      g.moveTo(x, yy);
      for (let xx = 0; xx <= w; xx += 40) g.lineTo(x + xx, yy + Math.sin(xx * 0.01 + i) * 2);
    } else {
      const xx = x + r() * w;
      g.moveTo(xx, y);
      for (let yy = 0; yy <= h; yy += 40) g.lineTo(xx + Math.sin(yy * 0.008 + i) * 2, y + yy);
    }
    g.stroke();
  }
  g.fillStyle = "rgba(233,220,200,0.10)";
  if (sens === "h") g.fillRect(x, y + h - 3, w, 2);
  else g.fillRect(x < W / 2 ? x + w - 3 : x + 1, y, 2, h);
}

/** La pince du chevalet (paperboard), redessinée par-dessus la feuille qui se soulève. */
export function pince(g: Ctx, W: number, k: number) {
  g.save();
  g.shadowColor = "rgba(30,18,8,0.5)";
  g.shadowBlur = 16 * k;
  g.shadowOffsetY = 8 * k;
  const gr = g.createLinearGradient(0, 22 * k, 0, 96 * k);
  gr.addColorStop(0, "#4A3A2E");
  gr.addColorStop(0.35, "#2A1F17");
  gr.addColorStop(0.75, "#1A120C");
  gr.addColorStop(1, "#0E0905");
  g.fillStyle = gr;
  g.beginPath();
  g.roundRect(20 * k, 26 * k, W - 40 * k, 66 * k, 12 * k);
  g.fill();
  g.restore();
  g.fillStyle = "rgba(255,240,220,0.18)";
  g.fillRect(30 * k, 32 * k, W - 60 * k, 3 * k);
  for (const x of [150 * k, W - 150 * k]) {
    const v = g.createRadialGradient(x - 4 * k, 55 * k, 2 * k, x, 59 * k, 16 * k);
    v.addColorStop(0, "#D8CBB8");
    v.addColorStop(0.5, "#8C7C6A");
    v.addColorStop(1, "#3A2E24");
    g.fillStyle = v;
    g.beginPath();
    g.arc(x, 59 * k, 15 * k, 0, 7);
    g.fill();
    g.strokeStyle = "rgba(20,12,6,0.7)";
    g.lineWidth = 2.5 * k;
    g.beginPath();
    g.moveTo(x - 8 * k, 59 * k);
    g.lineTo(x + 8 * k, 59 * k);
    g.stroke();
  }
}

function fabriquer(style: StyleTableau, W: number, H: number, k: number, geo: MiseEnPageTableauStyle): Support {
  const fond = toile(W, H);
  const g = fond.getContext("2d")!;
  const bas = geo.basSupport;
  const res: Support = { fond };
  if (style === "tableau-blanc") {
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, "#F8F7F4");
    gr.addColorStop(0.55, "#F2F0EC");
    gr.addColorStop(1, "#E9E6E1");
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    // Traces d'usage : de grands coups de chiffon très flous, sans aucune lettre.
    const r = alea(31);
    g.save();
    g.filter = `blur(${16 * k}px)`;
    for (let i = 0; i < 9; i++) {
      g.globalAlpha = 0.02 + r() * 0.015;
      g.strokeStyle = "#5A4C42";
      g.lineWidth = (90 + r() * 80) * k;
      g.lineCap = "round";
      g.beginPath();
      const x = r() * W;
      const y = geo.contenu.y + r() * geo.contenu.hauteur;
      g.moveTo(x, y);
      g.bezierCurveTo(x + 120 * k, y - 60 * k, x + 260 * k, y + 50 * k, x + (380 + r() * 200) * k, y - 20 * k);
      g.stroke();
    }
    g.restore();
    const n = bruit(W, H, 160 * k, 5, 3);
    g.globalCompositeOperation = "soft-light";
    g.globalAlpha = 0.18;
    g.drawImage(n, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    const yb = geo.contenu.y + geo.contenu.hauteur;
    const d = g.createLinearGradient(0, yb, 0, bas);
    d.addColorStop(0, "rgba(60,45,30,0)");
    d.addColorStop(1, "rgba(60,45,30,0.07)");
    g.fillStyle = d;
    g.fillRect(26 * k, yb, W - 52 * k, bas - yb);
    // Le mur sous le tableau.
    const y0 = bas + 34 * k;
    const m = g.createLinearGradient(0, y0, 0, H);
    m.addColorStop(0, "#C9C0B4");
    m.addColorStop(1, "#B7AC9F");
    g.fillStyle = m;
    g.fillRect(0, y0, W, H - y0);
    if (H - y0 > 4) {
      const nm = bruit(W, H - y0, 120 * k, 61, 3);
      g.save();
      g.globalCompositeOperation = "soft-light";
      g.globalAlpha = 0.3;
      g.drawImage(nm, 0, y0);
      g.restore();
    }
    // Cadre aluminium.
    alu(g, W, 0, 0, W, 34 * k, "h");
    alu(g, W, 0, 0, 26 * k, bas + 34 * k, "v");
    alu(g, W, W - 26 * k, 0, 26 * k, bas + 34 * k, "v");
    alu(g, W, 0, bas, W, 34 * k, "h");
    const o = g.createLinearGradient(0, 34 * k, 0, 52 * k);
    o.addColorStop(0, "rgba(40,30,22,0.22)");
    o.addColorStop(1, "rgba(40,30,22,0)");
    g.fillStyle = o;
    g.fillRect(26 * k, 34 * k, W - 52 * k, 18 * k);
    for (const [x0, x1] of [[26 * k, 40 * k], [W - 26 * k, W - 40 * k]]) {
      const sg = g.createLinearGradient(x0, 0, x1, 0);
      sg.addColorStop(0, "rgba(40,30,22,0.18)");
      sg.addColorStop(1, "rgba(40,30,22,0)");
      g.fillStyle = sg;
      g.fillRect(Math.min(x0, x1), 34 * k, 14 * k, bas - 34 * k);
    }
    // L'auget : deux feutres et la brosse.
    const y = bas + 30 * k;
    if (y + 60 * k < H + 10 * k) {
      g.save();
      g.filter = `blur(${12 * k}px)`;
      g.fillStyle = "rgba(50,35,22,0.38)";
      g.fillRect(30 * k, y + 44 * k, W - 60 * k, 30 * k);
      g.restore();
      g.beginPath();
      g.moveTo(14 * k, y);
      g.lineTo(W - 14 * k, y);
      g.lineTo(W - 2 * k, y + 28 * k);
      g.lineTo(2 * k, y + 28 * k);
      g.closePath();
      const dd = g.createLinearGradient(0, y, 0, y + 28 * k);
      dd.addColorStop(0, "#9E9891");
      dd.addColorStop(0.45, "#D9D5D0");
      dd.addColorStop(1, "#EFECE8");
      g.fillStyle = dd;
      g.fill();
      const f = g.createLinearGradient(0, y + 28 * k, 0, y + 60 * k);
      f.addColorStop(0, "#D2CDC7");
      f.addColorStop(0.3, "#A19A93");
      f.addColorStop(1, "#5E5852");
      g.fillStyle = f;
      g.beginPath();
      g.roundRect(2 * k, y + 28 * k, W - 4 * k, 32 * k, [0, 0, 9 * k, 9 * k]);
      g.fill();
      const feutre = (x: number, yy: number, corps: string, capuchon: string) => {
        g.save();
        g.shadowColor = "rgba(40,28,18,0.45)";
        g.shadowBlur = 6 * k;
        g.shadowOffsetY = 4 * k;
        cylindre(g, x, yy, 250 * k, 24 * k, corps);
        g.restore();
        cylindre(g, x + 190 * k, yy, 62 * k, 27 * k, capuchon);
        cylindre(g, x - 14 * k, yy, 18 * k, 12 * k, capuchon, 0.2);
      };
      feutre(190 * k, y + 14 * k, "#2A1F17", "#B44F29");
      feutre(520 * k, y + 13 * k, "#ECE8E3", "#110A05");
      g.save();
      g.shadowColor = "rgba(40,28,18,0.45)";
      g.shadowBlur = 7 * k;
      g.shadowOffsetY = 4 * k;
      const b = g.createLinearGradient(0, y - 6 * k, 0, y + 24 * k);
      b.addColorStop(0, "#4A3C31");
      b.addColorStop(1, "#140D08");
      g.fillStyle = b;
      g.beginPath();
      g.roundRect(W - 230 * k, y - 8 * k, 150 * k, 30 * k, 8 * k);
      g.fill();
      g.restore();
      g.fillStyle = "#BFA88B";
      g.fillRect(W - 228 * k, y + 16 * k, 146 * k, 6 * k);
    }
    // Stries claires (feutre).
    const st = toile(W, H);
    const sg = st.getContext("2d")!;
    const rr = alea(41);
    for (let i = 0; i < 2400 * (W * H) / (1080 * 1920); i++) {
      sg.globalAlpha = 0.05 + rr() * 0.12;
      sg.fillStyle = "#fff";
      sg.fillRect(rr() * W, rr() * H, (30 + rr() * 120) * k, (1 + rr() * 1.5) * k);
    }
    res.stries = st;
  } else if (style === "ardoise") {
    g.fillStyle = "#110A05";
    g.fillRect(0, 0, W, H);
    const n = bruit(W, H, 220 * k, 9, 4);
    g.globalCompositeOperation = "screen";
    g.globalAlpha = 0.07;
    g.drawImage(n, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    g.drawImage(grain(W, H, 11, (r) => {
      const v = r();
      return v > 0.985 ? [233, 220, 200, 22] : v > 0.9 ? [200, 185, 165, 8] : [0, 0, 0, 0];
    }), 0, 0);
    const r = alea(13);
    g.save();
    g.filter = `blur(${16 * k}px)`;
    for (let i = 0; i < 11; i++) {
      g.globalAlpha = 0.03 + r() * 0.025;
      g.strokeStyle = "#E9DCC8";
      g.lineWidth = (110 + r() * 70) * k;
      g.lineCap = "round";
      g.beginPath();
      const x = -60 * k + r() * W;
      const y = geo.contenu.y + r() * geo.contenu.hauteur;
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 220 * k, y + (-140 + r() * 280) * k, x + (420 + r() * 200) * k, y + 30 * k);
      g.stroke();
    }
    g.restore();
    const v = g.createRadialGradient(W / 2, H * 0.42, 300 * k, W / 2, H * 0.45, Math.max(W, H) * 0.68);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.35)");
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
    // Rebord à craies et poussière au pied, puis le mur sombre.
    const y = bas;
    const m = g.createLinearGradient(0, y, 0, H);
    m.addColorStop(0, "#1C130C");
    m.addColorStop(1, "#0A0603");
    g.fillStyle = m;
    g.fillRect(0, y, W, H - y);
    g.save();
    g.filter = `blur(${14 * k}px)`;
    g.globalAlpha = 0.07;
    g.fillStyle = "#E9DCC8";
    g.fillRect(70 * k, y - 96 * k, W - 140 * k, 56 * k);
    g.restore();
    const d = g.createLinearGradient(0, y, 0, y + 24 * k);
    d.addColorStop(0, "#3A2414");
    d.addColorStop(0.5, "#7A5436");
    d.addColorStop(1, "#8E6644");
    g.fillStyle = d;
    g.beginPath();
    g.moveTo(8 * k, y);
    g.lineTo(W - 8 * k, y);
    g.lineTo(W, y + 24 * k);
    g.lineTo(0, y + 24 * k);
    g.closePath();
    g.fill();
    bois(g, W, 0, y + 24 * k, W, 34 * k, "h");
    const rr = alea(71);
    g.fillStyle = "#E9DCC8";
    for (let i = 0; i < 260; i++) {
      g.globalAlpha = 0.12 + rr() * 0.3;
      g.fillRect(40 * k + rr() * (W - 80 * k), y + (4 + rr() * 18) * k, (1 + rr() * 2.2) * k, (1 + rr() * 1.5) * k);
    }
    g.globalAlpha = 1;
    const baton = (x: number, L: number, c: string) => {
      g.save();
      g.shadowColor = "rgba(0,0,0,0.6)";
      g.shadowBlur = 6 * k;
      g.shadowOffsetY = 3 * k;
      cylindre(g, x, y + 10 * k, L, 17 * k, c, 0.3);
      g.restore();
    };
    baton(300 * k, 132 * k, "#E9DCC8");
    baton(610 * k, 92 * k, "#D97A52");
    baton(780 * k, 34 * k, "#E9DCC8");
    bois(g, W, 0, 0, W, 30 * k, "h");
    bois(g, W, 0, 0, 24 * k, bas, "v");
    bois(g, W, W - 24 * k, 0, 24 * k, bas, "v");
    bois(g, W, 0, bas - 28 * k, W, 28 * k, "h");
    res.grainCraie = grain(W, H, 17, (rg) => {
      const x = rg();
      return x > 0.8 ? [0, 0, 0, 140 + rg() * 115] : x > 0.62 ? [0, 0, 0, 60] : [0, 0, 0, 0];
    });
    // Filet double à la craie autour du contenu, ornements d'angle terracotta.
    const P = plume(CHARTES_TABLEAU.ardoise, 4242);
    const c = toile(W, H);
    const cg = c.getContext("2d")!;
    cg.strokeStyle = "#BFA88B";
    cg.lineCap = "round";
    cg.lineJoin = "round";
    const R = geo.contenu;
    const filet = (x0: number, y0: number, x1: number, y1: number, w: number, a: number) => {
      cg.globalAlpha = a;
      cg.lineWidth = w;
      cg.beginPath();
      tremble(P, densifier([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]], 8), 0.8).forEach(([x, yy], i) => (i ? cg.lineTo(x, yy) : cg.moveTo(x, yy)));
      cg.stroke();
    };
    filet(R.x, R.y, R.x + R.largeur, R.y + R.hauteur, 3 * k, 0.75);
    filet(R.x + 12 * k, R.y + 12 * k, R.x + R.largeur - 12 * k, R.y + R.hauteur - 12 * k, 1.6 * k, 0.5);
    for (const [x, yy, sx, sy] of [[R.x, R.y, 1, 1], [R.x + R.largeur, R.y, -1, 1], [R.x, R.y + R.hauteur, 1, -1], [R.x + R.largeur, R.y + R.hauteur, -1, -1]]) {
      cg.globalAlpha = 0.8;
      cg.lineWidth = 3 * k;
      cg.beginPath();
      cg.moveTo(x + sx * 12 * k, yy + sy * 46 * k);
      cg.quadraticCurveTo(x + sx * 30 * k, yy + sy * 30 * k, x + sx * 46 * k, yy + sy * 12 * k);
      cg.stroke();
      cg.fillStyle = "#D97A52";
      cg.globalAlpha = 0.9;
      cg.beginPath();
      cg.moveTo(x + sx * 24 * k, yy + sy * 14 * k);
      cg.lineTo(x + sx * 30 * k, yy + sy * 24 * k);
      cg.lineTo(x + sx * 24 * k, yy + sy * 34 * k);
      cg.lineTo(x + sx * 18 * k, yy + sy * 24 * k);
      cg.closePath();
      cg.fill();
    }
    cg.globalAlpha = 1;
    cg.globalCompositeOperation = "destination-out";
    cg.drawImage(res.grainCraie, 0, 0);
    g.save();
    g.globalAlpha = 0.3;
    g.filter = `blur(${3 * k}px)`;
    g.drawImage(c, 0, 0);
    g.restore();
    g.drawImage(c, 0, 0);
  } else {
    // Mur enduit sable, chevalet, papier épais.
    g.fillStyle = "#B49C7E";
    g.fillRect(0, 0, W, H);
    const n = bruit(W, H, 90 * k, 21, 4);
    g.globalCompositeOperation = "soft-light";
    g.globalAlpha = 0.5;
    g.drawImage(n, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    for (const [x0, x1] of [[150 * k, 112 * k], [W - 150 * k, W - 112 * k]]) {
      g.save();
      g.shadowColor = "rgba(40,25,12,0.45)";
      g.shadowBlur = 14 * k;
      g.shadowOffsetX = 6 * k;
      const gr = g.createLinearGradient(Math.min(x0, x1) - 22 * k, 0, Math.max(x0, x1) + 22 * k, 0);
      gr.addColorStop(0, "#4A3020");
      gr.addColorStop(0.45, "#8A6040");
      gr.addColorStop(1, "#3A2414");
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x0 - 21 * k, bas - 60 * k);
      g.lineTo(x0 + 21 * k, bas - 60 * k);
      g.lineTo(x1 + 21 * k, H);
      g.lineTo(x1 - 21 * k, H);
      g.closePath();
      g.fill();
      g.restore();
    }
    const S = CHARTES_TABLEAU.paperboard;
    g.save();
    g.shadowColor = "rgba(40,25,12,0.45)";
    g.shadowBlur = 30 * k;
    g.shadowOffsetY = 10 * k;
    g.fillStyle = S.fond;
    g.fillRect(40 * k, 70 * k, W - 80 * k, bas - 70 * k);
    g.restore();
    g.fillStyle = "#E8DFCF";
    g.fillRect(44 * k, 70 * k, W - 88 * k, 22 * k);
    g.fillStyle = "#DED3C1";
    g.fillRect(48 * k, 70 * k, W - 96 * k, 12 * k);
    g.fillStyle = S.fond;
    g.fillRect(40 * k, 84 * k, W - 80 * k, bas - 84 * k);
    const pap = bruit(W, H, 60 * k, 23, 4);
    g.save();
    g.beginPath();
    g.rect(40 * k, 84 * k, W - 80 * k, bas - 84 * k);
    g.clip();
    g.globalCompositeOperation = "multiply";
    g.globalAlpha = 0.16;
    g.drawImage(pap, 0, 0);
    g.globalAlpha = 1;
    g.drawImage(grain(W, H, 25, (r) => {
      const v = r();
      return v > 0.97 ? [150, 125, 95, 30] : v > 0.8 ? [170, 150, 120, 10] : [0, 0, 0, 0];
    }), 0, 0);
    const fibres = alea(27);
    g.globalAlpha = 0.07;
    g.strokeStyle = "#7A6248";
    g.lineWidth = 1;
    for (let i = 0; i < 900; i++) {
      const x = 40 * k + fibres() * (W - 80 * k);
      const y = 84 * k + fibres() * (bas - 84 * k);
      const a = fibres() * 6.3;
      const l = (4 + fibres() * 14) * k;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    const lum = g.createLinearGradient(40 * k, 0, W - 40 * k, 0);
    lum.addColorStop(0, "rgba(90,60,30,0.10)");
    lum.addColorStop(0.3, "rgba(255,250,240,0.05)");
    lum.addColorStop(1, "rgba(90,60,30,0.12)");
    g.fillStyle = lum;
    g.fillRect(40 * k, 84 * k, W - 80 * k, bas - 84 * k);
    const ob = g.createLinearGradient(0, bas - 160 * k, 0, bas);
    ob.addColorStop(0, "rgba(90,60,30,0)");
    ob.addColorStop(1, "rgba(90,60,30,0.10)");
    g.fillStyle = ob;
    g.fillRect(40 * k, bas - 160 * k, W - 80 * k, 160 * k);
    g.restore();
    // L'auget du chevalet et ses marqueurs.
    const y = bas - 4 * k;
    g.save();
    g.shadowColor = "rgba(40,25,12,0.5)";
    g.shadowBlur = 18 * k;
    g.shadowOffsetY = 10 * k;
    const d = g.createLinearGradient(0, y, 0, y + 22 * k);
    d.addColorStop(0, "#6A4A30");
    d.addColorStop(1, "#A07850");
    g.fillStyle = d;
    g.fillRect(24 * k, y, W - 48 * k, 22 * k);
    g.restore();
    bois(g, W, 24 * k, y + 22 * k, W - 48 * k, 30 * k, "h");
    const marqueur = (x: number, capuchon: string) => {
      g.save();
      g.shadowColor = "rgba(40,25,12,0.5)";
      g.shadowBlur = 6 * k;
      g.shadowOffsetY = 3 * k;
      cylindre(g, x, y + 8 * k, 260 * k, 30 * k, "#1E1610");
      g.restore();
      cylindre(g, x + 70 * k, y + 8 * k, 100 * k, 31 * k, "#D9C6A6", 0.3);
      cylindre(g, x + 200 * k, y + 8 * k, 64 * k, 33 * k, capuchon);
    };
    marqueur(170 * k, "#110A05");
    marqueur(560 * k, "#B44F29");
    pince(g, W, k);
    res.grainPapier = pap;
  }
  return res;
}
