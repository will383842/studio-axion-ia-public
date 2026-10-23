/**
 * GÉOMÉTRIE À MAIN LEVÉE des trois styles du tableau (portée du gabarit des maquettes validées, PR #280,
 * `maquettes/tableau-v2/gabarit.html`). PUR et DÉTERMINISTE : chaque tremblé tire sa graine d'un générateur posé par la
 * mise en page (aucun hasard, aucune horloge). Sans alias « @/ » : importable par Remotion.
 *
 * Un TRAIT est une polyligne (points à plat, x, y, x, y…), son épaisseur, sa couleur, son opacité, son genre (ligne,
 * remplissage au feutre en zigzag, surligneur) et sa vitesse relative (un remplissage va 2,6 fois plus vite qu'un
 * contour) ; `d` : sa durée de tracé (s), posée par la mise en page.
 */
import type { CharteTableau } from "./styles";

export type Point = [number, number];

export interface TraitTableau {
  /** Points à plat (x0, y0, x1, y1…), px de l'image, au dixième. */
  p: number[];
  /** Épaisseur (px). */
  w: number;
  /** Couleur « #RRGGBB ». */
  c: string;
  /** Opacité (1 si absente). */
  a?: number;
  /** « r » : remplissage au feutre ; « s » : surligneur (bouts carrés, multiplié) ; absent : un trait. */
  g?: "r" | "s";
  /** Vitesse relative (1 si absente). */
  v?: number;
  /** Durée du tracé (s). */
  d?: number;
}

/** Générateur pseudo-aléatoire à graine (mulberry32, comme les maquettes). */
export function alea(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Graine stable d'un texte (identifiant d'élément). */
export function graineDe(texte: string): number {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) h = Math.imul(h ^ texte.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const borne = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const lisse = (u: number) => u * u * (3 - 2 * u);
export const sortie3 = (u: number) => 1 - Math.pow(1 - u, 3);

/** Le crayon de la page : graines successives et charte du style. */
export interface Plume {
  charte: CharteTableau;
  graine: () => number;
}

export function plume(charte: CharteTableau, graine: number): Plume {
  let g = graine >>> 0;
  return { charte, graine: () => (g = (g + 7919) >>> 0) };
}

export function tremble(P: Plume, pts: Point[], amp = 1.4): Point[] {
  const r = alea(P.graine());
  const ph = r() * 10;
  const ph2 = r() * 10;
  let s = 0;
  return pts.map((p, i) => {
    if (i > 0) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(b[1] - a[1]);
    let ny = b[0] - a[0];
    const n = Math.hypot(nx, ny) || 1;
    nx /= n;
    ny /= n;
    const d = amp * (Math.sin(s * 0.021 + ph) * 0.7 + Math.sin(s * 0.057 + ph2) * 0.3);
    return [p[0] + nx * d, p[1] + ny * d];
  });
}

export function ligne(P: Plume, x1: number, y1: number, x2: number, y2: number, amp = 1.2): Point[] {
  const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 6));
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) pts.push([lerp(x1, x2, i / n), lerp(y1, y2, i / n)]);
  return tremble(P, pts, amp);
}

export function bez(p0: Point, p1: Point, p2: Point, p3: Point, n = 40): Point[] {
  const o: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const v = 1 - u;
    o.push([v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]]);
  }
  return o;
}

export function ellipse(P: Plume, cx: number, cy: number, rx: number, ry: number, a0 = -Math.PI * 0.6, tour = 1.06, amp = 1.3): Point[] {
  const n = Math.ceil(Math.max(rx, ry) * tour * 0.9) + 24;
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * Math.PI * 2 * tour;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return tremble(P, pts, amp);
}

export function polyPts(cx: number, cy: number, rx: number, ry: number, n = 64): Point[] {
  const o: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return o;
}

export function densifier(pts: Point[], pas = 6): Point[] {
  const o: Point[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / pas));
    for (let k = 1; k <= n; k++) o.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]);
  }
  return o;
}

/** Rectangle arrondi (contour fermé, départ en haut à gauche). */
export function rectArr(x: number, y: number, w: number, h: number, r = 14): Point[] {
  const o: Point[] = [];
  const rr = Math.min(r, w / 2, h / 2);
  const arc = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (i / 6) * (Math.PI / 2);
      o.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
  };
  arc(x + w - rr, y + rr, -Math.PI / 2);
  arc(x + w - rr, y + h - rr, 0);
  arc(x + rr, y + h - rr, Math.PI / 2);
  arc(x + rr, y + rr, Math.PI);
  o.push([o[0][0], o[0][1]]);
  return densifier(o);
}

export function tourner(pts: Point[], cx: number, cy: number, deg: number): Point[] {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
}

export function decaler(pts: Point[], dx: number, dy: number): Point[] {
  return pts.map(([x, y]) => [x + dx, y + dy]);
}

/** Hachures (ou remplissage au feutre) de contours fermés (règle pair-impair), en zigzag. */
export function hachures(contours: Point[][], angleDeg: number, ecart: number, marge = 0): [Point, Point][] {
  const a = (angleDeg * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const nx = -uy;
  const ny = ux;
  let mn = Infinity;
  let mx = -Infinity;
  for (const c of contours)
    for (const [x, y] of c) {
      const d = x * nx + y * ny;
      mn = Math.min(mn, d);
      mx = Math.max(mx, d);
    }
  const res: [Point, Point][] = [];
  let sens = 1;
  for (let d = mn + ecart * 0.5; d < mx; d += ecart) {
    const ts: number[] = [];
    for (const c of contours)
      for (let i = 0; i < c.length; i++) {
        const p = c[i];
        const q = c[(i + 1) % c.length];
        const dp = p[0] * nx + p[1] * ny - d;
        const dq = q[0] * nx + q[1] * ny - d;
        if (dp < 0 !== dq < 0) {
          const u = dp / (dp - dq);
          ts.push(lerp(p[0], q[0], u) * ux + lerp(p[1], q[1], u) * uy);
        }
      }
    ts.sort((m, n) => m - n);
    const segs: [number, number][] = [];
    for (let i = 0; i + 1 < ts.length; i += 2) {
      const t0 = ts[i] + marge;
      const t1 = ts[i + 1] - marge;
      if (t1 - t0 > 3) segs.push([t0, t1]);
    }
    if (sens < 0) segs.reverse();
    for (const [t0, t1] of segs) {
      const A: Point = [ux * t0 + nx * d, uy * t0 + ny * d];
      const B: Point = [ux * t1 + nx * d, uy * t1 + ny * d];
      res.push(sens > 0 ? [A, B] : [B, A]);
    }
    sens = -sens;
  }
  return res;
}

const plat = (pts: Point[]) => pts.flatMap(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);

/** Un trait. */
export function trait(pts: Point[], w: number, c: string, o: { a?: number; g?: "r" | "s"; v?: number } = {}): TraitTableau {
  return { p: plat(pts), w: Math.round(w * 10) / 10, c, ...(o.a !== undefined && o.a !== 1 ? { a: o.a } : {}), ...(o.g ? { g: o.g } : {}), ...(o.v && o.v !== 1 ? { v: o.v } : {}) };
}

/** Remplissage au feutre (« clair », « moyen » ou une couleur) d'un ou plusieurs contours. */
export function remplir(P: Plume, contours: Point[][], ton: string, o: { angle?: number; w?: number; ecart?: number; a?: number } = {}): TraitTableau[] {
  const S = P.charte;
  const craie = S.matiere === "craie";
  const w = o.w ?? (craie ? 7 : 22);
  const ecart = o.ecart ?? (craie ? 12 : 16);
  const c = ton === "clair" ? S.clair : ton === "moyen" ? S.moyen : ton;
  const a = o.a ?? (craie ? (ton === "clair" ? 0.5 : 0.62) : 0.9);
  return hachures(contours, o.angle ?? -35, ecart, w * 0.45).map((s) => trait(densifier(s, 8), w, c, { a, g: "r", v: 2.6 }));
}

/** Ombre hachurée. */
export function ombrer(P: Plume, contours: Point[][], o: { angle?: number; ecart?: number; w?: number; c?: string; a?: number } = {}): TraitTableau[] {
  const S = P.charte;
  const w = o.w ?? 3.2;
  const c = o.c ?? S.ombre;
  const a = o.a ?? (S.matiere === "craie" ? 0.7 : 0.75);
  return hachures(contours, o.angle ?? 55, o.ecart ?? 13, 1).map((s) => trait(tremble(P, densifier(s, 6), 0.8), w, c, { a, v: 2.4 }));
}

/** Points d'un trait (repliés en paires). */
export function pointsDe(t: TraitTableau): Point[] {
  const o: Point[] = [];
  for (let i = 0; i + 1 < t.p.length; i += 2) o.push([t.p[i], t.p[i + 1]]);
  return o;
}

/** Longueur d'un trait (px). */
export function longueur(t: TraitTableau): number {
  let L = 0;
  for (let i = 2; i + 1 < t.p.length; i += 2) L += Math.hypot(t.p[i] - t.p[i - 2], t.p[i + 1] - t.p[i - 1]);
  return L;
}

/** Boîte englobante de traits (épaisseur comprise). */
export function boiteTraits(ts: readonly TraitTableau[]): { x: number; y: number; largeur: number; hauteur: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const t of ts)
    for (let i = 0; i + 1 < t.p.length; i += 2) {
      x0 = Math.min(x0, t.p[i] - t.w / 2);
      x1 = Math.max(x1, t.p[i] + t.w / 2);
      y0 = Math.min(y0, t.p[i + 1] - t.w / 2);
      y1 = Math.max(y1, t.p[i + 1] + t.w / 2);
    }
  return Number.isFinite(x0) ? { x: x0, y: y0, largeur: x1 - x0, hauteur: y1 - y0 } : { x: 0, y: 0, largeur: 0, hauteur: 0 };
}

/** Recadre des traits : p → n + (p − o) × s ; l'épaisseur suit √s (jamais sous 2,5 px). */
export function echelle(ts: readonly TraitTableau[], ox: number, oy: number, s: number, nx: number, ny: number): TraitTableau[] {
  return ts.map((t) => ({ ...t, p: t.p.map((v, i) => Math.round((i % 2 ? ny + (v - oy) * s : nx + (v - ox) * s) * 10) / 10), w: Math.round(Math.max(2.5, t.w * Math.sqrt(s)) * 10) / 10 }));
}

/** Des traits posés dans un rectangle (centrés, au plus grand qui tient, sans dépasser `smax`). */
export function cadrer(ts: readonly TraitTableau[], r: { x: number; y: number; largeur: number; hauteur: number }, smax = 3, aligne: "centre" | "gauche" | "droite" = "centre"): TraitTableau[] {
  const b = boiteTraits(ts);
  if (!b.largeur || !b.hauteur) return [...ts];
  const s = Math.min(smax, r.largeur / b.largeur, r.hauteur / b.hauteur);
  const w = b.largeur * s;
  const nx = aligne === "gauche" ? r.x : aligne === "droite" ? r.x + r.largeur - w : r.x + (r.largeur - w) / 2;
  const ny = r.y + (r.hauteur - b.hauteur * s) / 2;
  const res = echelle(ts, b.x, b.y, s, nx, ny);
  // L'épaisseur a changé : on recale pour rester dans le rectangle.
  const b2 = boiteTraits(res);
  const dx = aligne === "gauche" ? r.x - b2.x : aligne === "droite" ? r.x + r.largeur - (b2.x + b2.largeur) : r.x + (r.largeur - b2.largeur) / 2 - b2.x;
  const dy = r.y + (r.hauteur - b2.hauteur) / 2 - b2.y;
  return res.map((t) => ({ ...t, p: t.p.map((v, i) => Math.round((v + (i % 2 ? dy : dx)) * 10) / 10) }));
}

/** Pose les durées (s) d'une suite de traits : `total` réparti au prorata de longueur ÷ vitesse. */
export function minuter(ts: readonly TraitTableau[], total: number): TraitTableau[] {
  const poids = ts.map((t) => Math.max(1, longueur(t)) / (t.v ?? 1));
  const somme = poids.reduce((s, x) => s + x, 0) || 1;
  return ts.map((t, i) => ({ ...t, d: Math.round(Math.max(0.001, (total * poids[i]) / somme) * 10000) / 10000 }));
}
