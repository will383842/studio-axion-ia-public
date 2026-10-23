/**
 * DESSINS ILLUSTRÉS des trois styles du tableau (portés des maquettes validées, PR #280, `gabarit.html`) : contour épais,
 * remplissage au feutre en zigzag, ombres hachurées, ombre portée. Chaque dessin rend ses traits DANS L'ORDRE où l'outil
 * les trace (contour → remplissage → ombre). PUR, déterministe (graines de la `Plume`). Coordonnées : px de la grille
 * de la maquette (1080 × 1920) ; la mise en page les recadre (`cadrer`).
 */
import { alea, bez, decaler, densifier, ellipse, ligne, ombrer, polyPts, rectArr, remplir, tourner, trait, tremble, type Plume, type Point, type TraitTableau } from "./trace";

const craie = (P: Plume) => P.charte.matiere === "craie";
const marqueur = (P: Plume) => P.charte.matiere === "marqueur";

export function etoile(P: Plume, cx: number, cy: number, r: number): TraitTableau[] {
  const E = P.charte.encre;
  return [trait(ligne(P, cx, cy - r, cx, cy + r, 0.3), 5, E), trait(ligne(P, cx - r, cy, cx + r, cy, 0.3), 5, E), trait(ligne(P, cx - r * 0.5, cy - r * 0.5, cx + r * 0.5, cy + r * 0.5, 0.2), 3.5, E)];
}

export function sablier(P: Plume, cx: number, y0: number, y1: number): TraitTableau[] {
  const E = P.charte.encre;
  const el: TraitTableau[] = [];
  const h = y1 - y0;
  const hp = 38;
  const lp = 330;
  const plaqueH = rectArr(cx - lp / 2, y0, lp, hp, 12);
  const plaqueB = rectArr(cx - lp / 2, y1 - hp, lp, hp, 12);
  const g1 = y0 + hp + 4;
  const g2 = y1 - hp - 4;
  const m = (g1 + g2) / 2;
  const lx = cx - 112;
  const gauche: Point[] = [...bez([lx, g1], [lx - 22, g1 + h * 0.26], [cx - 14, m - h * 0.1], [cx - 11, m], 30), ...bez([cx - 11, m], [cx - 14, m + h * 0.1], [lx - 22, g2 - h * 0.26], [lx, g2], 30).slice(1)];
  const droite: Point[] = gauche.map(([x, y]) => [2 * cx - x, y]);
  const tasB: Point[] = [[cx - 98, g2 - 2], ...bez([cx - 98, g2 - 2], [cx - 60, g2 - 70], [cx + 50, g2 - 80], [cx + 98, g2 - 2], 20)];
  const tasH: Point[] = [[cx - 92, g1 + 40], [cx + 92, g1 + 40], ...bez([cx + 92, g1 + 40], [cx + 60, g1 + 110], [cx + 18, m - 40], [cx, m - 26], 14), ...bez([cx, m - 26], [cx - 18, m - 40], [cx - 60, g1 + 110], [cx - 92, g1 + 40], 14)];
  el.push(trait(tremble(P, plaqueH, 1), 8, E), trait(tremble(P, plaqueB, 1), 8, E));
  for (const x of [cx - lp / 2 + 26, cx + lp / 2 - 26]) el.push(trait(ligne(P, x, y0 + hp, x, y1 - hp, 0.8), 14, E));
  el.push(trait(tremble(P, gauche, 0.8), 7, E), trait(tremble(P, droite, 0.8), 7, E));
  el.push(...remplir(P, [tasH], "moyen", { angle: -20 }), ...remplir(P, [tasB], "moyen", { angle: -20 }));
  el.push(trait(tremble(P, densifier(tasB.slice(1)), 0.6), 5, E), trait(tremble(P, densifier(tasH.slice(2)), 0.6), 5, E));
  for (const [x, y, r] of [[cx - 4, m + 30, 12], [cx + 6, m + 82, -14]] as const) {
    const e = tourner(rectArr(x - 20, y - 13, 40, 26, 4), x, y, r);
    el.push(trait(e, 4.5, E), trait(tourner(densifier([[x - 18, y - 11], [x, y + 2], [x + 18, y - 11]]), x, y, r), 4, E));
  }
  for (const [x, y, r] of [[cx - 40, g2 - 44, -8], [cx + 34, g2 - 50, 10]] as const) {
    const e = tourner(rectArr(x - 26, y - 16, 52, 32, 4), x, y, r);
    el.push(trait(e, 4.5, E), trait(tourner(densifier([[x - 24, y - 14], [x, y + 3], [x + 24, y - 14]]), x, y, r), 4, E));
  }
  el.push(...remplir(P, [plaqueH], "clair", { angle: 0 }), ...remplir(P, [plaqueB], "clair", { angle: 0 }));
  const bord = droite.slice(4, -4);
  el.push(...ombrer(P, [bord.concat(bord.map(([x, y]) => [x - 26, y] as Point).reverse())], { angle: 70, ecart: 11 }));
  el.push(trait(tremble(P, bez([lx + 18, g1 + 20], [lx + 8, g1 + 70], [lx + 30, g1 + 110], [lx + 52, g1 + 140], 16), 0.4), 4, E, { a: 0.8 }));
  el.push(...ombrer(P, [polyPts(cx + 20, y1 + 10, lp * 0.6, 14, 40)], { angle: 20, ecart: 9, a: 0.55 }));
  return el;
}

export function enveloppe(P: Plume, x: number, y: number, w: number, h: number, rot: number): TraitTableau[] {
  const E = P.charte.encre;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const c = tourner(rectArr(x, y, w, h, 10), cx, cy, rot);
  const rabat = tourner(densifier([[x + 8, y + 8], [cx, y + h * 0.58], [x + w - 8, y + 8]]), cx, cy, rot);
  const cote = tourner([[x + w * 0.62, y + h], [x + w, y + h * 0.4], [x + w, y + h], [x + w * 0.62, y + h]], cx, cy, rot);
  return [...remplir(P, [c], "clair", { angle: -30 }), trait(tremble(P, c, 0.9), 7, E), trait(tremble(P, rabat, 0.7), 5.5, E), ...ombrer(P, [cote], { angle: 60, ecart: 10 })];
}

export function ombreL(P: Plume, x: number, y: number, w: number, h: number, d = 14): TraitTableau[] {
  return ombrer(P, [densifier([[x + w, y + d + 4], [x + w + d, y + d + 4], [x + w + d, y + h + d], [x + d + 4, y + h + d], [x + d + 4, y + h], [x + w, y + h], [x + w, y + d + 4]])], { angle: 45, ecart: 10, a: 0.55 });
}

export function feuilleDemande(P: Plume, x: number, y: number, w: number, h: number, o: { k?: number; l0?: number; pas?: number } = {}): TraitTableau[] {
  const E = P.charte.encre;
  const k = o.k ?? 1;
  const cn = 46 * k;
  const c = densifier([[x, y], [x + w - cn, y], [x + w, y + cn], [x + w, y + h], [x, y + h], [x, y]]);
  const coin = densifier([[x + w - cn, y], [x + w - cn, y + cn], [x + w, y + cn]]);
  const bord = tremble(P, c, 0.9);
  const el: TraitTableau[] = [trait(bord, 7, E)];
  el.push(...remplir(P, [c], "clair", { angle: -30, a: craie(P) ? 0.25 : 0.75 }), ...ombreL(P, x, y, w, h), trait(bord, 7, E, { v: 5 }), trait(tremble(P, coin, 0.6), 5, E));
  const barre = rectArr(x + 26 * k, y + 48 * k, 132 * k, 34 * k, 6);
  el.push(...remplir(P, [barre], E, { angle: 0, w: 14, ecart: 9, a: craie(P) ? 0.9 : 1 }), trait(tremble(P, barre, 0.5), 4, E));
  for (let i = 0; i < 5; i++) {
    const yy = y + (o.l0 ?? 122) + i * (o.pas ?? 34);
    const l = [w - 70, w - 100, w - 60, w - 120, w - 150][i];
    if (yy > y + h - 16) break;
    el.push(trait(tremble(P, densifier([[x + 28, yy], [x + 28 + l, yy]]), 2.2), 5, E, { a: 0.85 }));
  }
  return el;
}

export function feuilleBrouillon(P: Plume, x: number, y: number, w: number, h: number, o: { k?: number; l0?: number; pas?: number } = {}): TraitTableau[] {
  const E = P.charte.encre;
  const c = rectArr(x, y, w, h, 8);
  const bord = tremble(P, c, 0.9);
  const el: TraitTableau[] = [trait(bord, 7, E)];
  el.push(...remplir(P, [c], "clair", { angle: -30, a: craie(P) ? 0.25 : 0.75 }), ...ombreL(P, x, y, w, h), trait(bord, 7, E, { v: 5 }));
  for (let i = 0; i < 5; i++) {
    const yy = y + (o.l0 ?? 70) + i * (o.pas ?? 46);
    const k = o.k ?? 1;
    if (yy > y + h - 16) break;
    el.push(trait(ellipse(P, x + 34, yy, 5 * k, 5 * k, 0, 1.1, 0.2), 6 * k, E));
    el.push(trait(tremble(P, densifier([[x + 56, yy], [x + w - 30 - (i % 2) * 34, yy]]), 2), 5, E, { a: 0.85 }));
  }
  return el;
}

export function loupe(P: Plume, cx: number, cy: number, r: number, angDeg = 45): TraitTableau[] {
  const E = P.charte.encre;
  const k = r / 104;
  const ri = r - 20 * k;
  const ext = polyPts(cx, cy, r, r, 72);
  const int = polyPts(cx, cy, ri, ri, 72);
  const el: TraitTableau[] = [];
  const a = (angDeg * Math.PI) / 180;
  const hx = cx + Math.cos(a) * (r + 4);
  const hy = cy + Math.sin(a) * (r + 4);
  const ml = 120 * k;
  const mw = 40 * k;
  const manche = tourner(rectArr(hx, hy - mw / 2, ml, mw, 18 * k), hx, hy, angDeg);
  el.push(...remplir(P, [manche], "moyen", { angle: angDeg - 45 }), trait(tremble(P, manche, 0.8), 7, E));
  el.push(...ombrer(P, [tourner(rectArr(hx, hy + 2 * k, ml, 16 * k, 8 * k), hx, hy, angDeg)], { angle: angDeg - 90, ecart: 7, a: 0.8 }));
  el.push(...remplir(P, [ext, int], "moyen", { angle: -30, w: 14, ecart: 10 }));
  el.push(trait(ellipse(P, cx, cy, r, r, -2, 1.05, 0.9), 8, E), trait(ellipse(P, cx, cy, ri, ri, -2, 1.04, 0.7), 5, E));
  el.push(trait(tremble(P, densifier([[cx - 42 * k, cy + 2 * k], [cx - 12 * k, cy + 34 * k], [cx + 44 * k, cy - 34 * k]]), 1), 14 * Math.sqrt(k), E));
  el.push(trait(tremble(P, bez([cx - 48 * k, cy - 40 * k], [cx - 40 * k, cy - 52 * k], [cx - 24 * k, cy - 60 * k], [cx - 10 * k, cy - 62 * k], 12), 0.3), 5, E, { a: 0.75 }));
  return el;
}

/** Grosse flèche pleine (corps hachuré, contour). */
export function fleche(P: Plume, x1: number, y1: number, x2: number, y2: number, epais = 26): TraitTableau[] {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const L = Math.hypot(x2 - x1, y2 - y1);
  const t = epais / 2;
  const tete = epais * 1.2;
  const loc: Point[] = [[0, -t], [L - tete, -t], [L - tete, -t * 2.1], [L, 0], [L - tete, t * 2.1], [L - tete, t], [0, t], [0, -t]];
  const pts = densifier(loc.map(([u, v]) => [x1 + u * Math.cos(a) - v * Math.sin(a), y1 + u * Math.sin(a) + v * Math.cos(a)] as Point));
  return [...remplir(P, [pts], "moyen", { angle: 70, w: 12, ecart: 9 }), trait(tremble(P, pts, 0.7), 6, P.charte.encre)];
}

export function reveil(P: Plume, cx: number, cy: number, r: number): TraitTableau[] {
  const E = P.charte.encre;
  const el: TraitTableau[] = [];
  const cloches = [-1, 1].map((s) => {
    const bx = cx + s * r * 0.64;
    const by = cy - r * 0.84;
    const pts: Point[] = [];
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI + (i / 20) * Math.PI;
      pts.push([bx + Math.cos(a) * r * 0.36, by + Math.sin(a) * r * 0.32]);
    }
    pts.push(pts[0]);
    return tourner(densifier(pts), bx, by, s * 28);
  });
  for (const c of cloches) el.push(...remplir(P, [c], "moyen", { angle: 0, w: 12, ecart: 9 }), trait(tremble(P, c, 0.6), 6, E));
  el.push(trait(ligne(P, cx - r * 0.42, cy + r * 0.82, cx - r * 0.62, cy + r * 1.08, 0.5), 9, E), trait(ligne(P, cx + r * 0.42, cy + r * 0.82, cx + r * 0.62, cy + r * 1.08, 0.5), 9, E));
  const ext = polyPts(cx, cy, r, r, 72);
  const int = polyPts(cx, cy, r * 0.8, r * 0.8, 72);
  el.push(...remplir(P, [ext, int], "moyen", { angle: -30, w: 13, ecart: 10 }));
  el.push(trait(ellipse(P, cx, cy, r, r, -2, 1.05, 0.9), 8, E), trait(ellipse(P, cx, cy, r * 0.8, r * 0.8, -2, 1.03, 0.6), 4.5, E));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r1 = r * 0.68;
    const r2 = r * (i % 3 ? 0.73 : 0.62);
    el.push(trait([[cx + Math.cos(a) * r1, cy + Math.sin(a) * r1], [cx + Math.cos(a) * r2, cy + Math.sin(a) * r2]], i % 3 ? 3.5 : 5, E));
  }
  const coin: Point[] = [[cx, cy]];
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + (i / 12) * (Math.PI / 3);
    coin.push([cx + Math.cos(a) * r * 0.58, cy + Math.sin(a) * r * 0.58]);
  }
  el.push(...ombrer(P, [coin], { angle: 30, ecart: 7, a: 0.85 }));
  el.push(trait(ligne(P, cx, cy, cx, cy - r * 0.56, 0.3), 7, E), trait(ligne(P, cx, cy, cx + r * 0.5, cy - r * 0.29, 0.3), 7, E));
  el.push(...ombrer(P, [polyPts(cx + 10, cy + r * 1.14, r * 0.95, 10, 30)], { angle: 20, ecart: 8, a: 0.5 }));
  return el;
}

export function chrono(P: Plume, cx: number, cy: number, r: number): TraitTableau[] {
  const E = P.charte.encre;
  const el: TraitTableau[] = [];
  const bouton = rectArr(cx - 18, cy - r - 34, 36, 26, 6);
  const anse = rectArr(cx - 9, cy - r - 10, 18, 14, 3);
  el.push(...remplir(P, [bouton], "moyen", { angle: 0, w: 10, ecart: 7 }), trait(tremble(P, bouton, 0.5), 6, E), trait(tremble(P, anse, 0.4), 5, E));
  const lat = tourner(rectArr(cx + r * 0.62, cy - r * 0.92, 26, 18, 5), cx + r * 0.7, cy - r * 0.84, 40);
  el.push(trait(tremble(P, lat, 0.4), 5, E));
  const ext = polyPts(cx, cy, r, r, 72);
  const int = polyPts(cx, cy, r * 0.82, r * 0.82, 72);
  el.push(...remplir(P, [ext, int], "moyen", { angle: -30, w: 13, ecart: 10 }));
  el.push(trait(ellipse(P, cx, cy, r, r, -2, 1.05, 0.9), 8, E), trait(ellipse(P, cx, cy, r * 0.82, r * 0.82, -2, 1.03, 0.6), 4.5, E));
  const coin: Point[] = [[cx, cy]];
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * ((Math.PI * 2 * 3) / 60);
    coin.push([cx + Math.cos(a) * r * 0.74, cy + Math.sin(a) * r * 0.74]);
  }
  el.push(...remplir(P, [coin], "clair", { angle: 10, w: 12, ecart: 8 }), trait(tremble(P, densifier([...coin, [cx, cy]]), 0.4), 4.5, E));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r1 = r * 0.7;
    const r2 = r * (i % 3 ? 0.76 : 0.64);
    el.push(trait([[cx + Math.cos(a) * r1, cy + Math.sin(a) * r1], [cx + Math.cos(a) * r2, cy + Math.sin(a) * r2]], i % 3 ? 3.5 : 5, E));
  }
  el.push(trait(ligne(P, cx, cy, cx + Math.cos(-Math.PI / 2 + 0.31) * r * 0.66, cy + Math.sin(-Math.PI / 2 + 0.31) * r * 0.66, 0.3), 7, E));
  el.push(...ombrer(P, [polyPts(cx + 10, cy + r + 18, r * 0.9, 10, 30)], { angle: 20, ecart: 8, a: 0.5 }));
  return el;
}

export function horloge(P: Plume, cx: number, cy: number, r: number): TraitTableau[] {
  const E = P.charte.encre;
  const el: TraitTableau[] = [];
  const ext = polyPts(cx, cy, r, r, 96);
  const int = polyPts(cx, cy, r * 0.84, r * 0.84, 96);
  el.push(...remplir(P, [ext, int], "moyen", { angle: -30 }));
  el.push(trait(ellipse(P, cx, cy, r, r, -2, 1.05, 1.2), 9, E), trait(ellipse(P, cx, cy, r * 0.84, r * 0.84, -2, 1.03, 0.8), 5, E));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r1 = r * 0.74;
    const r2 = r * (i % 3 ? 0.68 : 0.6);
    el.push(trait([[cx + Math.cos(a) * r1, cy + Math.sin(a) * r1], [cx + Math.cos(a) * r2, cy + Math.sin(a) * r2]], i % 3 ? 4 : 7, E));
  }
  el.push(trait(ligne(P, cx, cy, cx - r * 0.36, cy - r * 0.2, 0.3), 10, E), trait(ligne(P, cx, cy, cx + r * 0.3, cy - r * 0.5, 0.3), 8, E));
  el.push(trait(ellipse(P, cx, cy, 9, 9, 0, 1.1, 0.2), 8, E));
  const coin: Point[] = [[cx, cy]];
  for (let i = 0; i <= 14; i++) {
    const a = -Math.PI / 2 + (i / 14) * (Math.PI / 3);
    coin.push([cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55]);
  }
  el.push(...ombrer(P, [coin], { angle: 30, ecart: 9 }));
  el.push(trait(tremble(P, bez([cx - r * 0.62, cy - r * 0.42], [cx - r * 0.55, cy - r * 0.55], [cx - r * 0.45, cy - r * 0.62], [cx - r * 0.3, cy - r * 0.68], 14), 0.3), 5, E, { a: 0.8 }));
  return el;
}

/** Banderole (paperboard) : corps et deux queues. */
export function banderole(P: Plume, x0: number, x1: number, y: number, h: number): TraitTableau[] {
  const E = P.charte.encre;
  const p = 34;
  const q = 22;
  const corps = densifier([[x0 + p, y], [x1 - p, y - 6], [x1 - p, y + h - 6], [x0 + p, y + h], [x0 + p, y]]);
  const qg = densifier([[x0 + p, y + q], [x0 - 10, y + q + 4], [x0 + 16, y + q + h / 2], [x0 - 10, y + q + h + 2], [x0 + p, y + h + q - 2], [x0 + p, y + q]]);
  const qd = densifier([[x1 - p, y + q - 6], [x1 + 10, y + q - 4], [x1 - 16, y + q + h / 2 - 6], [x1 + 10, y + q + h - 6], [x1 - p, y + h + q - 8], [x1 - p, y + q - 6]]);
  return [...remplir(P, [qg], "moyen", { angle: 60, w: 14, ecart: 10 }), ...remplir(P, [qd], "moyen", { angle: 60, w: 14, ecart: 10 }), trait(tremble(P, qg, 0.6), 6, E), trait(tremble(P, qd, 0.6), 6, E), ...remplir(P, [corps], "clair", { angle: -25 }), trait(tremble(P, corps, 0.8), 7, E)];
}

/** Éclat (paperboard, derrière un chiffre qui frappe). */
export function eclat(P: Plume, cx: number, cy: number, r1: number, r2: number, n = 14): TraitTableau[] {
  const pts: Point[] = [];
  const r = alea(77);
  for (let i = 0; i <= n * 2; i++) {
    const a = -Math.PI / 2 + (i / (n * 2)) * Math.PI * 2;
    const rr = i % 2 ? r2 : r1 * (0.92 + r() * 0.12);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  const c = densifier(pts);
  return [...ombrer(P, [decaler(c, 16, 16)], { angle: 50, ecart: 12, a: 0.5 }), ...remplir(P, [c], "clair", { angle: -30, a: 0.6 }), trait(tremble(P, c, 0.8), 7, P.charte.encre)];
}

/** Carte dessinée (paperboard, l'exemple) : contour, fond clair, ombre en L. */
export function carteCroquis(P: Plume, x: number, y: number, w: number, h: number): TraitTableau[] {
  const E = P.charte.encre;
  const c = rectArr(x, y, w, h, 16);
  const bord = tremble(P, c, 0.9);
  return [trait(bord, 6, E), ...remplir(P, [c], "#FBF6EC", { angle: -30, a: 1, w: 26, ecart: 18 }), ...ombrer(P, [densifier([[x + w, y + 18], [x + w + 14, y + 18], [x + w + 14, y + h + 14], [x + 18, y + h + 14], [x + 18, y + h], [x + w, y + h], [x + w, y + 18]])], { angle: 45, ecart: 10, a: 0.6 }), trait(bord, 6, E, { v: 5 })];
}

/** Médaillon (ardoise) : rond à la craie, fond hachuré léger. */
export function medaillon(P: Plume, cx: number, cy: number, r: number): TraitTableau[] {
  return [trait(ellipse(P, cx, cy, r, r, -1.9, 1.07, 1.3), 6, P.charte.encre), ...remplir(P, [polyPts(cx, cy, r - 8, r - 8)], "clair", { angle: -35, w: 8, ecart: 14, a: 0.22 })];
}

/** Case à cocher dessinée. */
export function caseACocher(P: Plume, x: number, y: number, s: number): TraitTableau[] {
  const c = rectArr(x, y, s, s, 12);
  return [...remplir(P, [c], "clair", { angle: -30, a: craie(P) ? 0.2 : 0.55 }), trait(tremble(P, c, 0.9), marqueur(P) ? 9 : 7, P.charte.encre)];
}

/** La coche (accent) tracée dans une case. */
export function coche(P: Plume, x: number, y: number, s: number, c?: string): TraitTableau[] {
  return [trait(tremble(P, densifier([[x + s * 0.16, y + s * 0.5], [x + s * 0.42, y + s * 0.8], [x + s * 1.02, y - s * 0.16]]), 1.2), craie(P) ? 15 : 17, c ?? P.charte.accent)];
}

/** Calendrier mural sans aucun chiffre (une case entourée = le rendez-vous). */
export function calendrier(P: Plume, x: number, y: number, w: number, h: number): TraitTableau[] {
  const E = P.charte.encre;
  const el: TraitTableau[] = [];
  const page = rectArr(x, y, w, h, 18);
  const tete = rectArr(x, y, w, h * 0.26, 18);
  el.push(...remplir(P, [page], "clair", { angle: -30, a: craie(P) ? 0.22 : 0.7 }), trait(tremble(P, page, 0.9), 8, E));
  el.push(...remplir(P, [tete], "moyen", { angle: 0 }), trait(tremble(P, densifier([[x, y + h * 0.26], [x + w, y + h * 0.26]]), 0.8), 6, E));
  for (const ax of [x + w * 0.28, x + w * 0.72]) {
    const an = rectArr(ax - 11, y - 30, 22, 58, 10);
    el.push(...remplir(P, [an], E, { angle: 90, w: 10, ecart: 8, a: 1 }), trait(tremble(P, an, 0.4), 5, E));
  }
  const g0 = y + h * 0.34;
  const gx = x + w * 0.08;
  const cw = (w * 0.84) / 4;
  const ch = (h * 0.6) / 3;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) el.push(trait(tremble(P, rectArr(gx + c * cw + 8, g0 + r * ch + 8, cw - 16, ch - 16, 6), 0.5), 4, E, { a: 0.85 }));
  el.push(...ombreL(P, x, y, w, h, 16));
  el.push(trait(ellipse(P, gx + 2.5 * cw, g0 + 1.5 * ch, cw * 0.62, ch * 0.62, -2.2, 1.1, 1.6), 10, E));
  return el;
}

/** Combiné de téléphone avec trois traits de sonnerie. */
export function telephone(P: Plume, cx: number, cy: number, s: number, rot = -18): TraitTableau[] {
  const E = P.charte.encre;
  const el: TraitTableau[] = [];
  const R0 = 112 * s;
  const R1 = 160 * s;
  const Rm = (R0 + R1) / 2;
  const a0 = Math.PI * 1.2;
  const a1 = Math.PI * 1.8;
  const Pt = (a: number, R: number): Point => [cx + Math.cos(a) * R, cy + Math.sin(a) * R];
  const arc = (R: number, u0: number, u1: number, n = 30) => {
    const p: Point[] = [];
    for (let i = 0; i <= n; i++) p.push(Pt(u0 + (i / n) * (u1 - u0), R));
    return p;
  };
  const anse = tourner(densifier([...arc(R1, a0, a1), ...arc(R0, a1, a0), Pt(a0, R1)]), cx, cy, rot);
  const cups = ([[a0, -1], [a1, 1]] as const).map(([a, sg]) => {
    const E2 = Pt(a, Rm);
    const c: Point = [E2[0] + sg * 34 * s, E2[1] + 30 * s];
    return tourner(tourner(rectArr(c[0] - 78 * s, c[1] - 36 * s, 156 * s, 72 * s, 30 * s), c[0], c[1], sg * 12), cx, cy, rot);
  });
  el.push(...remplir(P, [anse], "moyen", { angle: -30, w: 14, ecart: 10 }), trait(tremble(P, anse, 0.7), 8, E));
  for (const c of cups) el.push(...remplir(P, [c], "moyen", { angle: 30, w: 14, ecart: 10 }), trait(tremble(P, c, 0.6), 8, E));
  el.push(...ombrer(P, [polyPts(cx - 10 * s, cy + 150 * s, 200 * s, 12 * s, 30)], { angle: 20, ecart: 9, a: 0.45 }));
  const ox = cx + 150 * s;
  const oy = cy - 150 * s;
  for (let i = 0; i < 3; i++) {
    const p: Point[] = [];
    for (let k = 0; k <= 12; k++) {
      const a = -1.25 + (k / 12) * 0.9;
      p.push([ox + Math.cos(a) * (36 + i * 28) * s, oy + Math.sin(a) * (36 + i * 28) * s]);
    }
    el.push(trait(tremble(P, p, 0.4), 7, E));
  }
  return el;
}

/** Pointeur de souris (la pointe en haut à gauche). */
export function pointeur(P: Plume, x: number, y: number, s: number): TraitTableau[] {
  const loc: Point[] = [[0, 0], [0, 96], [24, 74], [42, 114], [60, 106], [42, 68], [74, 68], [0, 0]];
  const p = densifier(loc.map(([u, v]) => [x + u * s, y + v * s] as Point));
  return [...remplir(P, [p], craie(P) ? P.charte.encre : "#FBF6EC", { angle: -30, w: 12, ecart: 9, a: craie(P) ? 0.5 : 1 }), trait(tremble(P, p, 0.5), 7, P.charte.encre)];
}

/** Flèche courbe à main levée (corps et tête). */
export function flecheCourbe(P: Plume, p0: Point, p1: Point, p2: Point, p3: Point, w = 10): TraitTableau[] {
  const c = tremble(P, bez(p0, p1, p2, p3, 30), 0.8);
  const [ax, ay] = c[c.length - 1];
  const [bx, by] = c[c.length - 5];
  const a = Math.atan2(ay - by, ax - bx);
  const L = 34;
  return [trait(c, w, P.charte.encre), trait(tremble(P, densifier([[ax - Math.cos(a - 0.5) * L, ay - Math.sin(a - 0.5) * L], [ax, ay], [ax - Math.cos(a + 0.5) * L, ay - Math.sin(a + 0.5) * L]]), 0.4), w, P.charte.encre)];
}

/** Souligné à main levée (sous un texte), dans la couleur donnée. */
export function souligne(P: Plume, x0: number, x1: number, y: number, w: number, c: string): TraitTableau {
  const L = x1 - x0;
  return trait(tremble(P, bez([x0 - 6, y + 8], [x0 + L * 0.35, y - 10], [x0 + L * 0.7, y + 14], [x1 + 10, y - 6], 50), 1.2), w, c);
}

/** Boucle à main levée autour d'une zone. */
export function boucle(P: Plume, x: number, y: number, l: number, h: number, w: number, c: string): TraitTableau {
  return trait(ellipse(P, x + l / 2, y + h / 2, l / 2 + 26, h / 2 + 10, -2.6, 1.1, 2.4), w, c);
}

/** Surligneur (paperboard) : une bande sable posée sous un mot. */
export function surligneur(P: Plume, x0: number, x1: number, yc: number, h: number): TraitTableau {
  return trait(densifier([[x0 - 8, yc + 2], [x1 + 10, yc - 2]]), h, P.charte.surligneur ?? P.charte.moyen, { a: 0.5, g: "s" });
}

/** Barre « × » sur un chiffre dépassé (« 10 min » barré). */
export function barre(P: Plume, x: number, y: number, l: number, h: number): TraitTableau[] {
  const E = P.charte.encre;
  return [trait(tremble(P, densifier([[x, y + h * 0.62], [x + l, y + h * 0.38]]), 1.5), 10, E), trait(tremble(P, densifier([[x + 6, y + h * 0.36], [x + l - 4, y + h * 0.66]]), 1.5), 8, E, { a: 0.9 })];
}

/** Rayons orange autour d'un chiffre qui éclate. */
export function rayons(P: Plume, cx: number, cy: number, r: number, c: string, n = 11): TraitTableau[] {
  const res: TraitTableau[] = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * 0.95 + (i / (n - 1)) * Math.PI * 1.25;
    if (a > -0.2) continue;
    const r1 = r * 0.62;
    const r2 = r * (i % 2 ? 0.72 : 0.79);
    res.push(trait(ligne(P, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 1.05, cx + Math.cos(a) * r2, cy + Math.sin(a) * r2 * 1.05, 0.5), 13, c));
  }
  return res;
}

/** Filet double à la craie avec ornements (décor fixe de l'ardoise) : traits d'un cadre (x0, y0) → (x1, y1). */
export function filetArdoise(P: Plume, x0: number, y0: number, x1: number, y1: number): TraitTableau[] {
  const S = P.charte;
  return [trait(tremble(P, densifier([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]], 8), 0.8), 3, S.doux, { a: 0.75 }), trait(tremble(P, densifier([[x0 + 12, y0 + 12], [x1 - 12, y0 + 12], [x1 - 12, y1 - 12], [x0 + 12, y1 - 12], [x0 + 12, y0 + 12]], 8), 0.8), 1.6, S.doux, { a: 0.5 })];
}
