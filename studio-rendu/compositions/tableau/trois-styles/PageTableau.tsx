/**
 * RENDU DES TROIS STYLES DU TABLEAU « on écrit sur un vrai tableau » (maquettes validées, PR #280,
 * `maquettes/tableau-v2/gabarit.html` : la source de vérité du rendu) : A tableau blanc premium (feutre, aimants,
 * post-it orange), B ardoise Axion (craie ivoire et terracotta), C paperboard d'atelier (marqueurs, surligneur, ruban).
 *
 * Une toile Canvas par image : le support (fabriqué une fois, `support.ts`), les objets posés (post-it, aimants,
 * cartes, rubans, plaque), l'ENCRE (couche à part, avec sa matière : stries du feutre, grain de la craie, grain du
 * papier), la barre des chapitres dans le style, l'OUTIL visible (feutre, craie, marqueur) dont la pointe suit l'encre
 * de chaque lettre (colonne par colonne) et chaque trait, au rythme de la voix (plan `animation-3.ts`). Changement de
 * page : la brosse efface en 4 passes (A, B) ou la feuille se soulève (C), en 0,42 s ; la nouvelle page
 * arrive, entière, à la fin du geste (jamais l'ancienne et la nouvelle mêlées). Tout se calcule depuis le numéro d'image (aucun hasard, aucune horloge).
 *
 * Positions : `mise-en-page-tableau.ts` ; instants : `animation-3.ts`. Ce composant ne décide de rien, il dessine.
 */
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame } from "remotion";
import { avancement3, planPage3, type Action3, type Plan3 } from "../../../../src/briques/tableau-scene/reference/animation-3";
import { FIN_REFERENCE } from "../../../../src/briques/tableau-scene/reference/charte";
import { CHAPITRES_TABLEAU, CHARTES_TABLEAU, chapitreDePartie, type CharteTableau, type PoliceTableau, type StyleTableau } from "../../../../src/briques/tableau-scene/trois-styles/styles";
import { alea, borne, densifier, ellipse, lerp, lisse, plume, sortie3, tremble, graineDe, type TraitTableau } from "../../../../src/briques/tableau-scene/trois-styles/trace";
import type { MiseEnPageTableauStyle, ObjetTableau } from "../../../../src/briques/tableau-scene/trois-styles/types";
import { angleOutil, dimensionsOutil } from "../../../../src/briques/tableau-scene/trois-styles/outil";
import { etatOutil, pointSortie } from "../../../../src/briques/tableau-scene/trois-styles/pose-outil";
import { FAMILLES_POLICES_TABLEAU, chargerPolicesTableau } from "../../commune/polices-tableau";
import type { ElementPlace, PagePlacee, ProprietesTableauScene } from "../types";
import { assombrir, eclaircir, pince, support, toile, type Ctx, type Support } from "./support";

/** Durée du changement de page (s) : brosse (A, B) ou feuille qui se soulève (C). */
export const TRANSITION_TABLEAU_SEC = 0.42;

interface Scene {
  W: number;
  H: number;
  k: number;
  style: StyleTableau;
  S: CharteTableau;
  geo: MiseEnPageTableauStyle & { partie: string };
  sup: Support;
  bande: { x: number; y: number; largeur: number; hauteur: number };
}

const police = (p: PoliceTableau, taille: number) => `${p === "kalam" ? "700 " : ""}${Math.round(taille * 100) / 100}px "${FAMILLES_POLICES_TABLEAU[p]}"`;

/* ------------------------------------------------------------------ */
/* Colonnes encrées d'un texte (la pointe suit l'encre réelle)          */
/* ------------------------------------------------------------------ */

interface Encre {
  /** Colonnes encrées : x (depuis le début du texte), haut et bas de l'encre (depuis la ligne de base). */
  cols: { x: number; h: number; b: number }[];
  largeur: number;
  ascendant: number;
  descendant: number;
}
const ENCRES = new Map<string, Encre>();
let MESURE: CanvasRenderingContext2D | null = null;

function encreDe(texte: string, p: PoliceTableau, taille: number): Encre {
  const cle = `${p}|${taille}|${texte}`;
  const deja = ENCRES.get(cle);
  if (deja) return deja;
  MESURE ??= toile(8, 8).getContext("2d")!;
  MESURE.font = police(p, taille);
  MESURE.fontKerning = "none";
  const m = MESURE.measureText(texte);
  const asc = Math.ceil(m.actualBoundingBoxAscent);
  const desc = Math.ceil(m.actualBoundingBoxDescent);
  const pad = Math.ceil(taille * 0.3);
  const cw = Math.ceil(m.width + pad * 2);
  const ch = asc + desc + pad * 2;
  const c = toile(cw, ch);
  const g = c.getContext("2d")!;
  g.font = police(p, taille);
  g.fontKerning = "none";
  g.fillStyle = "#fff";
  g.fillText(texte, pad, pad + asc);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const cols: Encre["cols"] = [];
  for (let x = 0; x < c.width; x += 2) {
    let h0 = -1;
    let b0 = -1;
    for (let y = 0; y < c.height; y++)
      if (d[(y * c.width + x) * 4 + 3] > 120) {
        if (h0 < 0) h0 = y;
        b0 = y;
      }
    if (h0 >= 0) cols.push({ x: x - pad, h: h0 - pad - asc, b: b0 - pad - asc });
  }
  const e = { cols, largeur: m.width, ascendant: m.fontBoundingBoxAscent, descendant: m.fontBoundingBoxDescent };
  ENCRES.set(cle, e);
  return e;
}

/** Ligne de base d'une ligne posée (centrée dans sa boîte, d'après la police). */
function ligneDeBase(e: Encre, y: number, h: number): number {
  return y + (h - (e.ascendant + e.descendant)) / 2 + e.ascendant;
}

/* ------------------------------------------------------------------ */
/* Matières                                                              */
/* ------------------------------------------------------------------ */

function chemin(g: Ctx, p: number[], L: number, cum: number[]) {
  g.beginPath();
  g.moveTo(p[0], p[1]);
  let i = 1;
  for (; i < cum.length && cum[i] <= L; i++) g.lineTo(p[i * 2], p[i * 2 + 1]);
  if (i < cum.length && L > cum[i - 1]) {
    const u = (L - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    g.lineTo(lerp(p[i * 2 - 2], p[i * 2], u), lerp(p[i * 2 - 1], p[i * 2 + 1], u));
  }
}

const CUMULS = new WeakMap<TraitTableau, number[]>();
function cumul(t: TraitTableau): number[] {
  const deja = CUMULS.get(t);
  if (deja) return deja;
  const c = [0];
  for (let i = 2; i + 1 < t.p.length; i += 2) c.push(c[c.length - 1] + Math.hypot(t.p[i] - t.p[i - 2], t.p[i + 1] - t.p[i - 1]));
  CUMULS.set(t, c);
  return c;
}

export function pointSur(t: TraitTableau, u: number): [number, number] {
  const c = cumul(t);
  const L = c[c.length - 1] * borne(u);
  let i = 1;
  while (i < c.length && c[i] < L) i++;
  if (i >= c.length) return [t.p[t.p.length - 2], t.p[t.p.length - 1]];
  const v = (L - c[i - 1]) / (c[i] - c[i - 1] || 1);
  return [lerp(t.p[i * 2 - 2], t.p[i * 2], v), lerp(t.p[i * 2 - 1], t.p[i * 2 + 1], v)];
}

/** Un trait, avancé à `u`, avec la matière du style. */
function dessinerTrait(g: Ctx, sc: Scene, t: TraitTableau, u: number) {
  if (u <= 0 || t.p.length < 4) return;
  const c = cumul(t);
  const L = c[c.length - 1] * Math.min(1, u);
  const a = t.a ?? 1;
  g.save();
  g.lineCap = t.g === "s" ? "butt" : "round";
  g.lineJoin = "round";
  g.globalAlpha = a;
  g.strokeStyle = t.c;
  g.lineWidth = t.w;
  if (sc.S.matiere === "marqueur" && t.g !== "s" && t.w >= 4) {
    // Léger buvardage du marqueur : un bord plus large, très pâle.
    g.globalAlpha = a * 0.25;
    g.lineWidth = t.w + 2.4 * sc.k;
    chemin(g, t.p, L, c);
    g.stroke();
    g.globalAlpha = a;
    g.lineWidth = t.w;
  }
  chemin(g, t.p, L, c);
  g.stroke();
  if (sc.S.matiere !== "craie" && t.g !== "r" && t.g !== "s" && t.w >= 6 * sc.k) {
    if (sc.S.matiere === "feutre") {
      // Cœur plus clair, bord plus chargé : l'encre du feutre a de la matière.
      g.globalAlpha = a * 0.22;
      g.strokeStyle = eclaircir(t.c, 0.55);
      g.lineWidth = t.w * 0.42;
      chemin(g, t.p, L, c);
      g.stroke();
    }
    // Surcharge aux arrêts.
    g.globalAlpha = a * 0.5;
    g.fillStyle = assombrir(t.c, 0.7);
    g.beginPath();
    g.arc(t.p[0], t.p[1], t.w * 0.52, 0, 7);
    g.fill();
    if (u >= 1) {
      g.beginPath();
      g.arc(t.p[t.p.length - 2], t.p[t.p.length - 1], t.w * 0.56, 0, 7);
      g.fill();
    }
  }
  g.restore();
}

/** Une ligne de texte écrite jusqu'à `u` (révélée colonne par colonne, sous la pointe). */
function dessinerLigne(g: Ctx, sc: Scene, texte: string, x: number, y: number, h: number, p: PoliceTableau, taille: number, couleur: string, u: number) {
  // Jamais de fondu sur un texte (son contraste reste ≥ 4,5:1 à chaque image) : il se révèle sous la pointe.
  if (u <= 0) return;
  const alpha = 1;
  const e = encreDe(texte, p, taille);
  const base = ligneDeBase(e, y, h);
  const n = e.cols.length;
  const xr = u >= 1 || !n ? x + e.largeur + taille : x + e.cols[Math.min(n - 1, Math.floor(u * n))].x + 3;
  g.save();
  g.globalAlpha = alpha;
  g.beginPath();
  g.rect(x - taille, base - e.ascendant - taille, xr - x + taille, e.ascendant + e.descendant + 2 * taille);
  g.clip();
  g.font = police(p, taille);
  g.fontKerning = "none";
  g.textBaseline = "alphabetic";
  g.fillStyle = couleur;
  g.fillText(texte, x, base);
  if (sc.S.matiere === "feutre") {
    g.globalAlpha = alpha * 0.55;
    g.strokeStyle = assombrir(couleur, 0.7);
    g.lineWidth = 1.6 * sc.k;
    g.strokeText(texte, x, base);
  } else if (sc.S.matiere === "craie") {
    g.globalAlpha = alpha * 0.5;
    g.strokeStyle = couleur;
    g.lineWidth = 2.4 * sc.k;
    g.strokeText(texte, x, base);
  } else {
    g.globalAlpha = alpha * 0.35;
    g.strokeStyle = couleur;
    g.lineWidth = 1.4 * sc.k;
    g.strokeText(texte, x, base);
  }
  g.restore();
}

/** La pointe de l'outil sur une ligne en train de s'écrire (elle monte et descend sur l'encre de la lettre). */
function pointeLigne(texte: string, x: number, y: number, h: number, p: PoliceTableau, taille: number, u: number): [number, number] {
  const e = encreDe(texte, p, taille);
  const base = ligneDeBase(e, y, h);
  const n = e.cols.length;
  if (!n) return [x, base];
  const i = Math.min(n - 1, Math.floor(borne(u) * n));
  const c = e.cols[i];
  const osc = 0.5 + 0.5 * Math.sin(u * n * 0.33);
  return [x + c.x, base + lerp(c.h + 4, c.b - 4, osc)];
}

/* ------------------------------------------------------------------ */
/* Objets posés                                                          */
/* ------------------------------------------------------------------ */

function aimant(g: Ctx, x: number, y: number, r: number, col: string, k: number) {
  g.save();
  g.shadowColor = "rgba(30,20,10,0.4)";
  g.shadowBlur = 8 * k;
  g.shadowOffsetX = 4 * k;
  g.shadowOffsetY = 6 * k;
  const v = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  v.addColorStop(0, eclaircir(col, 0.45));
  v.addColorStop(0.45, col);
  v.addColorStop(1, assombrir(col, 0.55));
  g.fillStyle = v;
  g.beginPath();
  g.arc(x, y, r, 0, 7);
  g.fill();
  g.restore();
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.beginPath();
  g.ellipse(x - r * 0.35, y - r * 0.42, r * 0.28, r * 0.16, -0.5, 0, 7);
  g.fill();
}

function ruban(g: Ctx, x: number, y: number, w: number, h: number, rot: number, col: string, k: number) {
  g.save();
  g.translate(x, y);
  g.rotate((rot * Math.PI) / 180);
  g.shadowColor = "rgba(60,40,20,0.22)";
  g.shadowBlur = 4 * k;
  g.shadowOffsetY = 2 * k;
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(-w / 2, -h / 2);
  for (let i = 0; i <= 6; i++) g.lineTo(-w / 2 + (i / 6) * w, -h / 2 + (i % 2 ? 2.5 : -1.5) * k);
  g.lineTo(w / 2 + 3 * k, 0);
  g.lineTo(w / 2, h / 2);
  for (let i = 6; i >= 0; i--) g.lineTo(-w / 2 + (i / 6) * w, h / 2 + (i % 2 ? -2 : 1.5) * k);
  g.lineTo(-w / 2 - 3 * k, 0);
  g.closePath();
  g.fill();
  g.shadowColor = "transparent";
  g.globalAlpha = 0.18;
  g.fillStyle = "#fff";
  g.fillRect(-w / 2, -h / 2 + 2 * k, w, 3 * k);
  g.restore();
}

/** Un objet posé, apparu à `u` (0 → 1 : il se pose, son ombre se resserre). */
function dessinerObjet(g: Ctx, o: ObjetTableau, u: number, k: number) {
  if (u <= 0) return;
  const lev = 1 - sortie3(borne(u));
  g.save();
  // Opaque dès son arrivée (le texte qu'il porte garde son contraste) : il se pose, son ombre se resserre.
  if (o.sorte === "aimant") {
    if (u > 0.6) aimant(g, o.x + o.l / 2, o.y + o.h / 2, o.l / 2, o.c, k);
    g.restore();
    return;
  }
  if (o.sorte === "ruban") {
    ruban(g, o.x, o.y - 10 * k * lev, o.l, o.h, o.rot ?? 0, o.c, k);
    g.restore();
    return;
  }
  g.translate(o.x + o.l / 2, o.y + o.h / 2);
  g.rotate(((o.rot ?? 0) * Math.PI) / 180);
  g.translate(-14 * k * lev, -22 * k * lev);
  const w = o.l;
  const h = o.h;
  g.shadowColor = `rgba(40,20,8,${0.28 + 0.15 * lev})`;
  g.shadowBlur = (14 + 16 * lev) * k;
  g.shadowOffsetX = (6 + 10 * lev) * k;
  g.shadowOffsetY = (10 + 14 * lev) * k;
  g.fillStyle = o.c;
  g.beginPath();
  if (o.sorte === "postit") {
    g.moveTo(-w / 2, -h / 2);
    g.lineTo(w / 2, -h / 2);
    g.lineTo(w / 2, h / 2 - 20 * k);
    g.quadraticCurveTo(w / 2 - 6 * k, h / 2 - 4 * k, w / 2 - 26 * k, h / 2);
    g.lineTo(-w / 2, h / 2);
    g.closePath();
  } else if (o.sorte === "plaque") g.roundRect(-w / 2, -h / 2, w, h, 46 * k);
  else g.rect(-w / 2, -h / 2, w, h);
  g.fill();
  g.shadowColor = "transparent";
  const gr = g.createLinearGradient(0, -h / 2, 0, h / 2);
  gr.addColorStop(0, "rgba(255,230,200,0.12)");
  gr.addColorStop(0.22, "rgba(0,0,0,0)");
  gr.addColorStop(1, "rgba(60,20,0,0.12)");
  g.fillStyle = gr;
  g.fill();
  if (o.sorte === "postit") {
    g.fillStyle = "rgba(70,25,5,0.18)";
    g.fillRect(-w / 2, -h / 2, w, 16 * k);
  }
  g.restore();
}

/* ------------------------------------------------------------------ */
/* Barre des chapitres                                                   */
/* ------------------------------------------------------------------ */

function chapitres(g: Ctx, sc: Scene, actif: number, u: number) {
  const { S, geo, k } = sc;
  const p: PoliceTableau = sc.style === "paperboard" ? "caveat" : "kalam";
  const taille = geo.tailleChapitre;
  geo.chapitres.forEach((r, i) => {
    const nom = CHAPITRES_TABLEAU[i];
    const e = encreDe(nom, p, taille);
    const base = ligneDeBase(e, r.y, r.hauteur);
    const col = (sc.geo.chapitres[1]?.x ?? r.x + 200 * k) - geo.chapitres[0].x;
    if (sc.style === "paperboard") {
      const c = S.rubans!;
      ruban(g, r.x + r.largeur / 2, r.y + r.hauteur / 2, Math.max(r.largeur + 50 * k, col - 14 * k), r.hauteur + 14 * k, [-1.5, 1, -0.8, 1.6][i], i === actif ? c.actif : i < actif ? c.passe : c.avenir, k);
    }
    g.save();
    g.font = police(p, taille);
    g.fontKerning = "none";
    g.fillStyle = sc.style === "paperboard" || i <= actif ? S.encre : S.doux;
    g.fillText(nom, r.x, base);
    g.restore();
    if (sc.style !== "paperboard") {
      const yl = base + taille * 0.42;
      const lt = col - 26 * k;
      g.save();
      g.lineCap = "round";
      g.strokeStyle = i === actif ? S.accent : i < actif ? S.encre : sc.style === "ardoise" ? "#5A4636" : "#B9AC9C";
      g.lineWidth = (i === actif ? 9 : 6) * k;
      g.globalAlpha = 0.95;
      g.beginPath();
      const l = i === actif && sc.style === "ardoise" ? lt * u : lt;
      g.moveTo(r.x, yl);
      g.quadraticCurveTo(r.x + l / 2, yl + (i % 2 ? 3 : -2) * k, r.x + l, yl);
      g.stroke();
      g.restore();
      if (i === actif && sc.style === "tableau-blanc") aimant(g, r.x + lt - (1 - u) * (col + 2 * k), yl, 13 * k, "#B44F29", k);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Outil                                                                 */
/* ------------------------------------------------------------------ */

function outil(g: Ctx, sc: Scene, x: number, y: number, lev: number, col: string) {
  const { k, style } = sc;
  // Il se redresse quand il écrit bas : jamais il n'entre dans la bande des sous-titres.
  const ang = angleOutil(y, sc.bande.y, k);
  const { L, D } = dimensionsOutil(style, k);
  const ox = (10 + 18 * lev) * k;
  const oy = (8 + 14 * lev) * k;
  g.save();
  g.translate(x + ox, y + oy);
  g.rotate(ang);
  g.fillStyle = style === "ardoise" ? "rgba(0,0,0,0.42)" : "rgba(50,30,15,0.2)";
  g.beginPath();
  g.roundRect(4 * k, -D / 2 - 2 * k, L, D + 4 * k, D / 2);
  g.fill();
  g.fillStyle = style === "ardoise" ? "rgba(0,0,0,0.25)" : "rgba(50,30,15,0.1)";
  g.beginPath();
  g.roundRect(0, -D / 2 - 6 * k, L + 6 * k, D + 12 * k, D / 2 + 6 * k);
  g.fill();
  g.restore();
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  const cyl = (x0: number, x1: number, d: number, stops: [number, string][]) => {
    const gr = g.createLinearGradient(0, -d / 2, 0, d / 2);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    g.fillStyle = gr;
    g.fillRect(x0, -d / 2, x1 - x0, d);
  };
  if (style === "tableau-blanc") {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, -3 * k);
    g.quadraticCurveTo(2 * k, -7 * k, 16 * k, -8 * k);
    g.lineTo(16 * k, 8 * k);
    g.quadraticCurveTo(2 * k, 7 * k, 0, 3 * k);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(16 * k, -9 * k);
    g.lineTo(44 * k, -D / 2 + 2 * k);
    g.lineTo(44 * k, D / 2 - 2 * k);
    g.lineTo(16 * k, 9 * k);
    g.closePath();
    const gc = g.createLinearGradient(0, -D / 2, 0, D / 2);
    gc.addColorStop(0, "#5B5149");
    gc.addColorStop(0.35, "#B9B0A7");
    gc.addColorStop(1, "#2E2621");
    g.fillStyle = gc;
    g.fill();
    cyl(44 * k, L - 34 * k, D, [[0, "#8C847C"], [0.18, "#EDE9E4"], [0.38, "#FFFFFF"], [0.62, "#E2DDD7"], [0.86, "#B0A79E"], [1, "#7C736B"]]);
    cyl(110 * k, 190 * k, D + 0.5, [[0, "#110A05"], [0.35, "#3A2E26"], [1, "#0A0603"]]);
    g.fillStyle = "#E9DCC8";
    g.font = `700 ${15 * k}px "${FAMILLES_POLICES_TABLEAU.kalam}"`;
    g.fillText("AXION", 124 * k, 5 * k);
    cyl(L - 34 * k, L, D + 4 * k, [[0, assombrir(col, 0.6)], [0.3, col], [0.5, eclaircir(col, 0.3)], [1, assombrir(col, 0.5)]]);
    g.fillStyle = "rgba(255,255,255,0.5)";
    g.fillRect(50 * k, -D / 2 + 7 * k, L - 90 * k, 3 * k);
  } else if (style === "ardoise") {
    g.save();
    g.beginPath();
    g.moveTo(0, -6 * k);
    g.quadraticCurveTo(4 * k, -D / 2, 22 * k, -D / 2);
    g.lineTo(L, -D / 2);
    g.lineTo(L, D / 2);
    g.lineTo(22 * k, D / 2);
    g.quadraticCurveTo(4 * k, D / 2, 0, 6 * k);
    g.closePath();
    g.clip();
    cyl(0, L, D, [[0, assombrir(col, 0.55)], [0.25, col], [0.45, eclaircir(col, 0.35)], [0.75, assombrir(col, 0.85)], [1, assombrir(col, 0.5)]]);
    if (sc.sup.grainCraie) {
      g.globalAlpha = 0.35;
      g.drawImage(sc.sup.grainCraie, 300, 300, 200, 60, 0, -D / 2, L, D);
    }
    g.restore();
    g.fillStyle = assombrir(col, 0.8);
    g.beginPath();
    g.ellipse(L, 0, 5 * k, D / 2, 0, 0, 7);
    g.fill();
  } else {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, -11 * k);
    g.lineTo(22 * k, -12 * k);
    g.lineTo(22 * k, 12 * k);
    g.lineTo(6 * k, 10 * k);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(22 * k, -13 * k);
    g.lineTo(52 * k, -D / 2 + 2 * k);
    g.lineTo(52 * k, D / 2 - 2 * k);
    g.lineTo(22 * k, 13 * k);
    g.closePath();
    const gc = g.createLinearGradient(0, -D / 2, 0, D / 2);
    gc.addColorStop(0, "#3A2E26");
    gc.addColorStop(0.3, "#7A6A5C");
    gc.addColorStop(1, "#140D08");
    g.fillStyle = gc;
    g.fill();
    cyl(52 * k, L - 50 * k, D, [[0, "#0C0805"], [0.2, "#3E3229"], [0.34, "#6A5A4D"], [0.55, "#221912"], [1, "#080503"]]);
    cyl(110 * k, 230 * k, D + 0.5, [[0, "#8E7859"], [0.3, "#D9C6A6"], [0.55, "#E9DCC8"], [1, "#7E6A4E"]]);
    g.fillStyle = "#110A05";
    g.font = `${20 * k}px "${FAMILLES_POLICES_TABLEAU.marker}"`;
    g.fillText("ATELIER", 128 * k, 7 * k);
    cyl(L - 50 * k, L - 26 * k, D + 3 * k, [[0, assombrir(col, 0.5)], [0.35, col], [1, assombrir(col, 0.45)]]);
    cyl(L - 26 * k, L, D, [[0, "#0C0805"], [0.3, "#3E3229"], [1, "#080503"]]);
  }
  g.restore();
}

/** La brosse (A : tableau blanc ; B : craie). */
function brosse(g: Ctx, sc: Scene, x: number, y: number) {
  const k = sc.k;
  g.save();
  g.translate(x, y);
  g.rotate(-0.06);
  g.shadowColor = "rgba(30,20,10,0.35)";
  g.shadowBlur = 16 * k;
  g.shadowOffsetX = 10 * k;
  g.shadowOffsetY = 14 * k;
  const w = 130 * k;
  const h = 290 * k;
  const gr = g.createLinearGradient(-w / 2, 0, w / 2, 0);
  if (sc.style === "tableau-blanc") {
    gr.addColorStop(0, "#1C140F");
    gr.addColorStop(0.4, "#4A3C31");
    gr.addColorStop(1, "#140D08");
  } else {
    gr.addColorStop(0, "#4A2E1B");
    gr.addColorStop(0.45, "#8A5E3C");
    gr.addColorStop(1, "#3A2414");
  }
  g.fillStyle = gr;
  g.beginPath();
  g.roundRect(-w / 2, -h / 2, w, h, 24 * k);
  g.fill();
  g.shadowColor = "transparent";
  g.fillStyle = sc.style === "tableau-blanc" ? "#BFA88B" : "#D8CBB8";
  g.fillRect(-w / 2 + 4 * k, -h / 2 + 10 * k, 20 * k, h - 20 * k);
  g.fillStyle = "rgba(255,255,255,0.18)";
  g.fillRect(-w / 2 + 34 * k, -h / 2 + 18 * k, 8 * k, h - 36 * k);
  g.restore();
}

/** Masque des zones déjà effacées par la brosse (4 passes en zigzag) et la position de la brosse. */
function masqueEffacement(sc: Scene, u: number): { m: HTMLCanvasElement; p: [number, number] } {
  const { W, H, k, geo } = sc;
  const R = geo.contenu;
  const passes = [0.12, 0.38, 0.64, 0.9].map((f, i) => [R.y + R.hauteur * f, i % 2 ? -1 : 1] as const);
  const pts: [number, number][] = [];
  passes.forEach(([y, s]) => {
    for (let j = 0; j <= 24; j++) {
      const v = j / 24;
      pts.push([s > 0 ? lerp(-80 * k, W + 80 * k, v) : lerp(W + 80 * k, -80 * k, v), y + (s > 0 ? v : 1 - v) * 20 * k]);
    }
  });
  const m = MASQUE ?? toile(W, H);
  MASQUE = m.width === W && m.height === H ? m : toile(W, H);
  const g = MASQUE.getContext("2d")!;
  g.clearRect(0, 0, W, H);
  const n = Math.floor(borne(u) * (pts.length - 1));
  const ry = Math.max(175 * k, R.hauteur / 7);
  g.fillStyle = "#000";
  for (let i = 0; i <= n; i++) {
    g.beginPath();
    g.ellipse(pts[i][0], pts[i][1], 150 * k, ry, 0, 0, 7);
    g.fill();
  }
  if (u >= 1) g.fillRect(0, 0, W, H);
  return { m: MASQUE, p: pts[n] };
}
let MASQUE: HTMLCanvasElement | null = null;

/* ------------------------------------------------------------------ */
/* Une page à l'instant t                                                */
/* ------------------------------------------------------------------ */

interface Etat {
  page: PagePlacee;
  plan: Plan3;
  t: number;
}

/** Instant (s) où un élément apparaît : posé avec la page, sinon sa première action, sinon son apparition. */
function debutElement(et: Etat, e: ElementPlace): number | undefined {
  const { plan } = et;
  if (plan.fini) return -1e6;
  if (plan.poses.has(e.elementId) || plan.poses.has(`${e.elementId}#attente`)) return plan.debutPage;
  const acts = plan.actions.filter((a) => a.id === e.elementId);
  const ap = plan.apparitions[e.elementId];
  const d = Math.min(...acts.map((a) => a.debut), ap ?? Infinity);
  return Number.isFinite(d) ? d : undefined;
}

/** Avancement d'une partie d'un élément (ligne ou trait) ; sans action, il suit l'élément. */
function progression(et: Etat, e: ElementPlace, partie: string): number {
  const { plan, t } = et;
  if (plan.fini) return 1;
  const a = plan.actions.find((x) => x.id === e.elementId && x.partie === partie);
  // Un bloc posé (« fondu » du plan) se révèle très vite de gauche à droite, sans transparence.
  if (a?.fondu) return borne((t - a.debut) / Math.max(0.05, a.duree));
  if (a) return avancement3(plan, e.elementId, partie, t);
  const d = debutElement(et, e);
  if (d === undefined) return 0;
  if (partie.startsWith("ligne:") && plan.apparitions[e.elementId] !== undefined && !plan.poses.has(e.elementId)) return borne((t - d) / 0.35);
  return t >= d ? 1 : 0;
}

/** Couleur et épaisseur d'un geste du plan (souligné, entouré, coche, barre, flèche) dans le style. */
function styleGeste(sc: Scene, a: Action3): { c: string; w: number } | null {
  const { S, k } = sc;
  switch (a.trace) {
    case "entoure":
      return { c: S.accent, w: (sc.style === "ardoise" ? 11 : 13) * k };
    case "souligne":
      return { c: a.partie.startsWith("souligne-appel") ? (sc.style === "ardoise" ? S.doux : S.encre) : S.encre, w: 9 * k };
    case "coche":
      return { c: S.accent, w: (sc.style === "ardoise" ? 15 : 17) * k };
    case "barre":
      return { c: S.accentTexte, w: 8 * k };
    case "fleche":
      return { c: S.encre, w: 8 * k };
    default:
      return null;
  }
}

const GESTES = new Map<string, TraitTableau>();
/** Le trait à main levée d'un geste du plan (l'entouré de l'accroche devient un souligné sur A et B). */
function traitGeste(sc: Scene, a: Action3): TraitTableau | null {
  const st = styleGeste(sc, a);
  if (!st) return null;
  const cle = `${sc.style}|${a.id}|${a.partie}|${a.points.length}|${a.points[0]?.x}`;
  const deja = GESTES.get(cle);
  if (deja) return deja;
  const P = plume(sc.S, graineDe(cle));
  let pts: [number, number][] = a.points.map((q) => [q.x, q.y]);
  if (a.trace === "entoure" && sc.style !== "paperboard") {
    const r = a.cible;
    const yb = r.y + r.hauteur * 0.98;
    pts = [[r.x, yb + 4 * sc.k], [r.x + r.largeur * 0.5, yb - 6 * sc.k], [r.x + r.largeur, yb + 2 * sc.k]];
  } else if (a.trace === "entoure") pts = ellipse(P, a.cible.x + a.cible.largeur / 2, a.cible.y + a.cible.hauteur / 2, a.cible.largeur / 2 + 22 * sc.k, a.cible.hauteur / 2 + 8 * sc.k, -2.6, 1.1, 2.4);
  const t: TraitTableau = { p: tremble(P, densifier(pts, 6), a.trace === "coche" ? 1.2 : 1).flat(), w: st.w, c: st.c };
  GESTES.set(cle, t);
  return t;
}

/** Les objets posés de la page (dessous ou dessus de l'encre). */
function objets(g: Ctx, sc: Scene, et: Etat, dessus: boolean) {
  for (const e of et.page.elements) {
    const os = e.tableau?.objets?.filter((o) => !!o.dessus === dessus);
    if (!os?.length) continue;
    const d = debutElement(et, e);
    if (d === undefined) continue;
    const u = et.plan.fini ? 1 : borne((et.t - d + 0.05) / 0.28);
    for (const o of os) dessinerObjet(g, o, u, sc.k);
  }
}

/** L'encre de la page : traits d'avant, texte, traits d'après, décors du gabarit, gestes du plan. */
function encre(g: Ctx, sc: Scene, et: Etat) {
  const { S, k } = sc;
  const { plan, t } = et;
  for (const e of et.page.elements) {
    const tb = e.tableau;
    tb?.avant?.forEach((tr, i) => dessinerTrait(g, sc, tr, progression(et, e, `croquis:avant:${i}`)));
    const gab = e.gabarit;
    if (gab?.sorte === "pastille") {
      // Le chiffre de l'étape (sur le post-it, dans le cercle ou le disque) et « Étape 1 sur 3 ».
      const d = debutElement(et, e);
      if (d !== undefined && (plan.fini || t >= d)) {
        const u = plan.fini ? 1 : borne((t - d) / 0.3);
        const l = e.lignes[0];
        const m = tb?.lignes[0];
        if (l && m) dessinerLigne(g, sc, l.texte, l.px.x, l.px.y, l.px.hauteur, m.police, m.taille, S.encre, u);
        if (gab.etape) {
          const pe: PoliceTableau = "caveat";
          dessinerLigne(g, sc, gab.etape.texte, gab.etape.x, gab.etape.y, gab.etape.hauteur, pe, gab.etape.taille, S.doux, plan.fini ? 1 : borne((t - d - 0.12) / 0.4));
        }
      }
    } else if (gab?.sorte === "idee") {
      const d = debutElement(et, e);
      if (d !== undefined) dessinerLigne(g, sc, gab.texte.texte, gab.texte.x, gab.texte.y, gab.texte.hauteur, S.corps, gab.texte.taille, gab.couleur, plan.fini ? 1 : borne((t - d) / 0.35));
    }
    if (gab?.sorte !== "pastille")
      e.lignes.forEach((l, i) => {
        const m = tb?.lignes[i];
        if (!m) return;
        const partie = `ligne:${i}`;
        const u = progression(et, e, partie);
        dessinerLigne(g, sc, l.texte, l.px.x, l.px.y, l.px.hauteur, m.police, m.taille, m.couleur, u);
      });
    tb?.apres?.forEach((tr, i) => dessinerTrait(g, sc, tr, progression(et, e, `croquis:apres:${i}`)));
  }
  // Gestes du plan : mots de l'accroche marqués, coches, barres, flèches, site souligné.
  for (const a of plan.actions) {
    if (a.partie.startsWith("ligne:") || a.partie.startsWith("croquis:")) continue;
    const tr = traitGeste(sc, a);
    if (!tr) continue;
    const u = plan.fini ? 1 : avancement3(plan, a.id, a.partie, t);
    dessinerTrait(g, sc, tr, u);
    if (a.trace === "fleche" && u >= 1) {
      const n = tr.p.length;
      const [x2, y2, x1, y1] = [tr.p[n - 2], tr.p[n - 1], tr.p[n - 4], tr.p[n - 3]];
      const an = Math.atan2(y2 - y1, x2 - x1);
      const L = 26 * k;
      dessinerTrait(g, sc, { p: [x2 - Math.cos(an - 0.5) * L, y2 - Math.sin(an - 0.5) * L, x2, y2, x2 - Math.cos(an + 0.5) * L, y2 - Math.sin(an + 0.5) * L], w: tr.w, c: tr.c }, 1);
    }
  }
}

const COUCHES = new Map<string, HTMLCanvasElement>();
function couche(nom: string, W: number, H: number): HTMLCanvasElement {
  const c = COUCHES.get(nom);
  if (c && c.width === W && c.height === H) return c;
  const n = toile(W, H);
  COUCHES.set(nom, n);
  return n;
}

/** L'encre d'une page → sa couche, avec la matière du style ; posée sur `g`. */
function poserEncre(g: Ctx, sc: Scene, et: Etat, nom: string) {
  const c = couche(nom, sc.W, sc.H);
  const cg = c.getContext("2d")!;
  cg.clearRect(0, 0, sc.W, sc.H);
  encre(cg, sc, et);
  if (sc.S.matiere === "craie" && sc.sup.grainCraie) {
    cg.globalCompositeOperation = "destination-out";
    cg.drawImage(sc.sup.grainCraie, 0, 0);
  } else if (sc.S.matiere === "feutre" && sc.sup.stries) {
    cg.globalCompositeOperation = "source-atop";
    cg.globalAlpha = 0.5;
    cg.drawImage(sc.sup.stries, 0, 0);
  } else if (sc.sup.grainPapier) {
    cg.globalCompositeOperation = "source-atop";
    cg.globalAlpha = 0.22;
    cg.drawImage(sc.sup.grainPapier, 0, 0);
  }
  cg.globalAlpha = 1;
  cg.globalCompositeOperation = "source-over";
  if (sc.S.matiere === "craie") {
    // Halo de poussière de craie : une copie réduite, agrandie (aucun filtre de flou par image).
    const p = couche(`${nom}-halo`, Math.ceil(sc.W / 6), Math.ceil(sc.H / 6));
    const pg = p.getContext("2d")!;
    pg.clearRect(0, 0, p.width, p.height);
    pg.imageSmoothingEnabled = true;
    pg.drawImage(c, 0, 0, p.width, p.height);
    g.save();
    g.globalAlpha = 0.3;
    g.imageSmoothingEnabled = true;
    g.drawImage(p, 0, 0, sc.W, sc.H);
    g.restore();
  }
  g.drawImage(c, 0, 0);
}

/**
 * Pose de l'outil (`pose-outil.ts`) : sur l'encre en train de s'écrire, en l'air d'un tracé au suivant (0,6 s au plus),
 * ou il sort de l'image par la droite et y revient ; jamais il ne flotte au-dessus du contenu sans écrire (critique
 * #291, B1). Sa couleur ne change que hors de l'image (D5).
 */
export function poseOutil(sc: Scene, et: Etat): { x: number; y: number; lev: number; col: string } | null {
  const { plan, t, page } = et;
  const e = etatOutil(plan, t);
  if (!e) return null;
  const col = e.accent ? sc.S.accent : sc.S.encre;
  const ou = (a: Action3, u: number): [number, number] => {
    if (a.trace === "ecrire") {
      const el = page.elements.find((x) => x.elementId === a.id);
      const i = Number(a.partie.split(":")[1]);
      const l = el?.lignes[i];
      const m = el?.tableau?.lignes[i];
      if (l && m) return pointeLigne(l.texte, l.px.x, l.px.y, l.px.hauteur, m.police, m.taille, u);
    }
    if (a.partie.startsWith("croquis:")) {
      const el = page.elements.find((x) => x.elementId === a.id);
      const [, quand, i] = a.partie.split(":");
      const tr = (quand === "avant" ? el?.tableau?.avant : el?.tableau?.apres)?.[Number(i)];
      if (tr) return pointSur(tr, u);
    }
    const tr = traitGeste(sc, a);
    if (tr) return pointSur(tr, u);
    const p = a.points[Math.min(a.points.length - 1, Math.floor(u * a.points.length))] ?? a.points[0];
    return [p.x, p.y];
  };
  const vers = (a: [number, number], b: [number, number], u: number, lev: number) => {
    const v = lisse(borne(u));
    return { x: lerp(a[0], b[0], v), y: lerp(a[1], b[1], v), lev, col };
  };
  switch (e.mode) {
    case "trace": {
      const [x, y] = ou(e.a, avancement3(plan, e.a.id, e.a.partie, t));
      return { x, y, lev: 0, col };
    }
    case "vol":
      return vers(ou(e.de, 1), ou(e.vers, 0), e.u, Math.sin(Math.PI * borne(e.u)));
    case "sort": {
      const a = ou(e.de, 1);
      return vers(a, pointSortie(sc.W, a[1], sc.k), e.u, Math.min(1, borne(e.u) * 2.5));
    }
    case "entre": {
      const b = ou(e.vers, 0);
      return vers(pointSortie(sc.W, b[1], sc.k), b, e.u, Math.min(1, (1 - borne(e.u)) * 2.5));
    }
  }
}

/** Vie de la surface : reflet qui glisse (A). */
function reflet(g: Ctx, sc: Scene, t: number) {
  const { W, k } = sc;
  const x = -300 * k + t * 14 * k;
  g.save();
  g.globalCompositeOperation = "screen";
  const gr = g.createLinearGradient(x, 0, x + 900 * k, 700 * k);
  gr.addColorStop(0, "rgba(255,253,250,0)");
  gr.addColorStop(0.42, "rgba(255,253,250,0)");
  gr.addColorStop(0.5, "rgba(255,253,250,0.22)");
  gr.addColorStop(0.56, "rgba(255,253,250,0.06)");
  gr.addColorStop(0.62, "rgba(255,253,250,0.16)");
  gr.addColorStop(0.7, "rgba(255,253,250,0)");
  gr.addColorStop(1, "rgba(255,253,250,0)");
  g.fillStyle = gr;
  g.fillRect(26 * k, 34 * k, W - 52 * k, sc.bande.y - 60 * k);
  g.restore();
}

/** Poussière de craie (B) : de petits grains tombent de la pointe, jamais dans la bande des sous-titres. */
function poussiere(g: Ctx, sc: Scene, et: Etat) {
  const r = alea(99 + Math.round(et.plan.debutPage * 10));
  g.save();
  g.fillStyle = "#E9DCC8";
  const duree = Math.max(1, et.plan.finPage - et.plan.debutPage);
  for (let i = 0; i < 40; i++) {
    const naissance = et.plan.debutPage + r() * duree;
    const vie = 1.2 + r() * 1.4;
    const age = et.t - naissance;
    const dx0 = (r() - 0.5) * 50 * sc.k;
    const vy = (26 + r() * 30) * sc.k;
    if (age < 0 || age > vie) continue;
    const pp = poseOutil(sc, { ...et, t: naissance });
    if (!pp) continue;
    const y = pp.y + age * vy;
    if (y > sc.bande.y - 30 * sc.k) continue;
    g.globalAlpha = 0.35 * (1 - age / vie);
    g.beginPath();
    g.arc(pp.x + dx0 + Math.sin(age * 2 + i) * 8 * sc.k, y, (1 + (i % 3) * 0.6) * sc.k, 0, 7);
    g.fill();
  }
  g.restore();
}

/** L'image entière à l'instant t. */
function dessiner(g: Ctx, sc: Scene, p: ProprietesTableauScene, plan: Plan3, avant: Plan3 | null, t: number) {
  const { W, H, k } = sc;
  g.clearRect(0, 0, W, H);
  g.drawImage(sc.sup.fond, 0, 0);
  const et: Etat = { page: p.page, plan, t };
  const d0 = plan.debutPage;
  const enTransition = !!avant && !!p.pagePrecedente && d0 > 0.01 && t < d0 + TRANSITION_TABLEAU_SEC;
  // Avant l'arrivée de la page (la voix dit déjà « Deux. ») : la page d'avant, finie, sans brosse ni outil.
  const attente = enTransition && t < d0;
  const u = enTransition ? borne((t - d0) / TRANSITION_TABLEAU_SEC) : 1;
  // La partie de la page d'avant (sa barre des chapitres reste jusqu'à l'arrivée de cette page).
  const partieAvant = p.styleReference?.tableau?.partieAvant || sc.geo.partie;
  // Pendant l'attente, la barre garde le chapitre de la page d'avant (elle change avec la page).
  const actif = chapitreDePartie(attente ? partieAvant : sc.geo.partie);
  const etAvant: Etat | null = enTransition && avant && p.pagePrecedente ? { page: p.pagePrecedente, plan: avant, t: 1e6 } : null;
  if (sc.style === "paperboard") {
    // La nouvelle feuille est dessous ; l'ancienne se soulève et part par le haut.
    g.save();
    g.beginPath();
    g.rect(40 * k, 84 * k, W - 80 * k, sc.geo.basSupport - 84 * k);
    g.clip();
    chapitres(g, sc, actif, 1);
    objets(g, sc, et, false);
    poserEncre(g, sc, et, "encre");
    objets(g, sc, et, true);
    if (etAvant) {
      const pg = couche("page-c", W, H).getContext("2d")!;
      pg.clearRect(0, 0, W, H);
      pg.drawImage(sc.sup.fond, 0, 0);
      chapitres(pg, sc, chapitreDePartie(partieAvant), 1);
      objets(pg, sc, etAvant, false);
      poserEncre(pg, sc, etAvant, "encre-avant");
      objets(pg, sc, etAvant, true);
      const v = attente ? 0 : sortie3(u);
      const bas = lerp(sc.geo.basSupport, 84 * k, v);
      const courbe = 120 * k * Math.sin(Math.PI * v);
      g.save();
      g.beginPath();
      g.rect(40 * k, 84 * k, W - 80 * k, Math.max(0, bas - 84 * k));
      g.clip();
      g.drawImage(couche("page-c", W, H), 0, -(H - bas) * 0.25);
      g.restore();
      const sh = g.createLinearGradient(0, bas - courbe, 0, bas + 60 * k);
      sh.addColorStop(0, "rgba(243,235,221,0)");
      sh.addColorStop(0.55, "rgba(214,200,178,0.95)");
      sh.addColorStop(0.8, "rgba(243,235,221,1)");
      sh.addColorStop(1, "rgba(60,40,20,0)");
      g.fillStyle = sh;
      g.fillRect(40 * k, bas - courbe, W - 80 * k, courbe + 60 * k);
      const om = g.createLinearGradient(0, bas + 10 * k, 0, bas + 90 * k);
      om.addColorStop(0, "rgba(60,40,20,0.25)");
      om.addColorStop(1, "rgba(60,40,20,0)");
      g.fillStyle = om;
      g.fillRect(40 * k, bas + 10 * k, W - 80 * k, 80 * k);
    }
    g.restore();
    pince(g, W, k);
    const pl = attente ? null : poseOutil(sc, et);
    if (pl) outil(g, sc, pl.x, pl.y, pl.lev, pl.col);
  } else {
    let brosseP: [number, number] | null = null;
    if (etAvant) {
      // L'effacement est franc : la brosse efface l'ancienne page en 4 passes.
      const { m, p: bp } = masqueEffacement(sc, attente ? -1 : u);
      brosseP = attente ? null : bp;
      const ancien = couche("ancienne", W, H).getContext("2d")!;
      ancien.clearRect(0, 0, W, H);
      objets(ancien, sc, etAvant, false);
      poserEncre(ancien, sc, etAvant, "encre-avant");
      objets(ancien, sc, etAvant, true);
      ancien.globalCompositeOperation = "destination-out";
      ancien.drawImage(m, 0, 0);
      ancien.globalCompositeOperation = "source-over";
      g.drawImage(couche("ancienne", W, H), 0, 0);
      // La nouvelle page n'apparaît qu'à la fin du geste (0,42 s) : jamais l'ancienne et la nouvelle mêlées.

    } else {
      objets(g, sc, et, false);
      poserEncre(g, sc, et, "encre");
      objets(g, sc, et, true);
    }
    chapitres(g, sc, actif, attente ? 1 : enTransition ? lisse(u) : plan.fini ? 1 : lisse(borne((t - d0) / 0.5)));
    if (sc.style === "tableau-blanc") reflet(g, sc, t);
    if (sc.style === "ardoise") poussiere(g, sc, et);
    if (brosseP) brosse(g, sc, Math.min(W - 60 * k, Math.max(60 * k, brosseP[0])), brosseP[1]);
    else if (!attente) {
      const pl = poseOutil(sc, et);
      if (pl) outil(g, sc, pl.x, pl.y, pl.lev, pl.col);
    }
  }
  // Fin de la vidéo : l'image s'efface en noir.
  const r = p.styleReference!;
  if (r.derniere) {
    const f = borne((t * 1000 - (r.finVideoMs - FIN_REFERENCE.fonduImageMs)) / FIN_REFERENCE.fonduImageMs);
    if (f > 0) {
      g.fillStyle = `rgba(0,0,0,${f})`;
      g.fillRect(0, 0, W, H);
    }
  }
}

export function PageTableau({ p }: { p: ProprietesTableauScene }) {
  const image = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const r = p.styleReference!;
  const geo = r.tableau!;
  const plan = useMemo(() => planPage3(p.page, r, { largeur: p.largeur, hauteur: p.hauteur }), [p.page, r, p.largeur, p.hauteur]);
  const avant = useMemo(() => (p.pagePrecedente ? planPage3(p.pagePrecedente, r, { largeur: p.largeur, hauteur: p.hauteur }, true) : null), [p.pagePrecedente, r, p.largeur, p.hauteur]);
  const t = p.scene.debutMs / 1000 + image / p.fps;
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const peindre = () => {
      const sc: Scene = { W: p.largeur, H: p.hauteur, k: r.k, style: geo.style, S: CHARTES_TABLEAU[geo.style], geo, sup: support(geo.style, p.largeur, p.hauteur, r.k, geo), bande: p.bandeSousTitres.px };
      dessiner(c.getContext("2d")!, sc, p, plan, avant, t);
    };
    const attente = delayRender("Tableau : polices et support");
    chargerPolicesTableau().then(() => {
      peindre();
      continueRender(attente);
    });
  }, [p, r, geo, plan, avant, t]);
  return (
    <AbsoluteFill style={{ backgroundColor: CHARTES_TABLEAU[geo.style].fond }}>
      <canvas ref={ref} width={p.largeur} height={p.hauteur} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
}
