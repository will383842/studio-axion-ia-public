/**
 * ÉLÉMENT 16 — « MOT QUI SAUTE » (v3, lot D, rhabillé de la v2 ; standard § G ligne 16, § E.2 et § E.3).
 *
 * Quand : LE MOT FORT de la phrase (celui que Will appuie). Il quitte la ligne des sous-titres et devient un élément.
 * Visage : ENTIER, à toute image. À chaque image la boîte du mot est repoussée hors de Z (zone interdite recalculée depuis la prise),
 * puis réduite si besoin. Aucun zoom, aucun mouvement de la prise : seule la puce bouge.
 *
 * Matière : la PUCE v3 (`degradeOrange`, coins 0,22 em, reflet en haut, ombre douce, sans contour).
 * Chorégraphie (30 i/s, i0 = mot dit) :
 *  - i0 → i4   : la puce naît dans la ligne des sous-titres : échelle de 0,45 à 1 (`JAILLIR`) avec mise au point (flou de 0,006 L → 0 en 3 i) ;
 *  - i4 → i10  : MONTÉE en arc par le couloir à droite de Z (Bézier de la v2), la puce debout (−90°) pour tenir dans le couloir, 2 copies
 *                fantômes (30 % puis 15 %) et FLOU DIRECTIONNEL ; elle sort par le haut du cadre ;
 *  - i10 → i14 : elle RETOMBE par le haut, couchée (une puce couchée est plus large que le couloir : le saut par-dessus la tête est le seul
 *                chemin qui ne touche jamais Z) ;
 *  - i14       : atterrissage `CLAQUER` en haut à droite (centre ≈ 0,78 L ; 0,083 H ; 0,42 L de large ; −8°), échelle ×1,1 → ×1, secousse de la
 *                puce seule (0,012 L), reflet de lumière qui la traverse (10 i) ;
 *  - ensuite   : micro-vie (±1,2° sur 1,6 s, flottement de ±0,4 % H, second reflet 1 s plus tard) ;
 *  - sortie    : ASPIRATION vers le coin haut-droit (7 images, la puce rétrécit et part en tournant, flou directionnel).
 * Profondeur (V6) : ombre douce 3 couches + mise au point + flou de mouvement + fantômes. Ressorts : `JAILLIR`, `CLAQUER`, `GLISSER`.
 * Bruitages : `select_001` à i0, `drop_003` à i14. Le mot est TOUJOURS un mot que Will vient de dire.
 */
import React from "react";
import { borne, boiteTournee, courbe, entrant, FPS, intersecte, lin, Puce, hauteurPuce, largeurPuce, PRISE_COMMUNE_LOT, rs, secousseD, usePolicesD, zonePx, FlouDir } from "./communD";
import type { FicheLot3, PriseLot, RectPx, SonD } from "./communD";

export const ID_MOT_SAUTE = "mot-saute";
export const DUREE_MOT_SAUTE = Object.freeze({ min: 1.0, max: 2.0 });
export const SONS_MOT_SAUTE: readonly SonD[] = [
  { k: 0, fichier: "select_001" },
  { k: 14, fichier: "drop_003" },
];

export const FICHE_MOT_SAUTE: FicheLot3 = Object.freeze({
  id: ID_MOT_SAUTE,
  numero: 16,
  nom: "Mot qui saute",
  emplacement: "Part du sous-titre, atterrit en haut à droite (0,78 L ; 0,083 H), 0,42 L de large, −8°",
  forme: "Puce v3 (degradeOrange, reflet, ombre douce)",
  mouvement: "arc parabolique de 10 i par la droite de Z + flou directionnel + CLAQUER",
  sortie: "aspiration vers le coin",
  visage: "entier" as const,
  ouvertureAutorisee: true,
  dureeMin: DUREE_MOT_SAUTE.min,
  dureeMax: DUREE_MOT_SAUTE.max,
  quandUtiliser: "Le mot fort de la phrase, à 0,8-2 s (micro-accroche) ou n'importe où ensuite. Au plus 2 par vidéo.",
  sons: SONS_MOT_SAUTE,
});

export type MotSauteProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Le mot DIT par Will (capitales automatiques). */
  mot: string;
  prise?: PriseLot;
  /** Position de départ (fractions de L et H) : dans la ligne des sous-titres. Défaut : centre, 0,64 H. */
  depart?: { x: number; y: number };
  /** Largeur (px) de la plaque du sous-titre d'où la puce part : elle naît à cette taille (+12 %), exactement sur le mot du sous-titre. */
  largeurDepart?: number;
};

type Etat = { cx: number; cy: number; s: number; rot: number };
const LAND = 1.1;

/** Tout ce qui ne dépend que de la prise et du mot (pur). */
export function planMotSaute(p: Pick<MotSauteProps, "largeurImage" | "hauteurImage" | "mot" | "prise" | "depart" | "largeurDepart">) {
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const mot = p.mot.toUpperCase();
  const prise = p.prise ?? PRISE_COMMUNE_LOT;
  const Z = zonePx(prise, W, H);
  const Z0 = zonePx(prise, W, H, 0);
  const fs = (0.42 * W) / (largeurPuce(mot, 100) / 100);
  const wP = largeurPuce(mot, fs);
  const hP = hauteurPuce(fs);
  const rotFin = -8;
  const depart = { x: (p.depart?.x ?? 0.5) * W, y: (p.depart?.y ?? 0.64) * H };
  const s0 = ((p.largeurDepart ?? 0.2 * W) * 1.12) / wP;

  // Atterrissage : tout le rectangle tourné reste hors de Z (sans marge) ; le plus bas possible, à 0,03 H du haut au moins.
  // (la boîte est calculée à l'échelle de l'atterrissage ×1,1 : le claquement ne doit jamais mordre sur Z)
  const bL = boiteTournee(0, 0, wP * LAND, hP * LAND, rotFin);
  const cx = Math.min(0.78 * W, W - 0.015 * W - bL.x1);
  const demiH = (bL.y1 - bL.y0) / 2;
  let cy = Z0.y0 - demiH - 2;
  cy = Math.max(cy, 0.03 * H + demiH);
  const cible = { x: cx, y: cy };

  const couloir = W - Z.x1;
  const xcc = Z.x1 + couloir / 2;
  const c1 = { x: xcc, y: depart.y - 0.02 * H };
  const c2 = { x: xcc + 0.05 * W, y: cible.y + 0.1 * H };
  const bez = (u: number) => {
    const a = (1 - u) ** 3;
    const b = 3 * (1 - u) ** 2 * u;
    const c = 3 * (1 - u) * u ** 2;
    const d = u ** 3;
    return { x: a * depart.x + b * c1.x + c * c2.x + d * cible.x, y: a * depart.y + b * c1.y + c * c2.y + d * cible.y };
  };
  const lisse = (u: number, a: number, b: number) => {
    const v = borne((u - a) / (b - a), 0, 1);
    return v * v * (3 - 2 * v);
  };
  /** Boîte (px) de la puce à l'état e. */
  const boite = (e: Etat): RectPx => boiteTournee(e.cx, e.cy, wP * e.s, hP * e.s, e.rot);
  /** Garantie « jamais dans Z » : repousse à droite de Z, puis réduit. */
  const garantir = (e: Etat): Etat => {
    let { cx: x, s } = e;
    for (let i = 0; i < 14; i++) {
      const b = boite({ ...e, cx: x, s });
      if (intersecte(b, Z0)) x = Z0.x1 + 4 + (b.x1 - b.x0) / 2;
      const b2 = boite({ ...e, cx: x, s });
      if (!intersecte(b2, Z0) && b2.x1 <= W) break;
      s *= 0.93;
    }
    return { ...e, cx: x, s };
  };
  /**
   * État de la puce à l'image k (0 ≤ k ≤ 14), avant l'atterrissage. Trois temps :
   *  - i0 → i4   : elle naît dans la ligne des sous-titres ;
   *  - i4 → i10  : elle MONTE debout dans le couloir à droite de Z (jamais dans Z), et sort par le haut du cadre ;
   *  - i10 → i14 : elle RETOMBE par le haut à l'emplacement d'atterrissage, couchée (la boîte reste au-dessus de Z : la puce couchée
   *                est plus large que le couloir, elle ne peut donc pas y passer ; le saut par-dessus la tête est le seul chemin légal).
   */
  const sortieHaut = { x: xcc, y: -0.2 * H };
  const c2h = { x: xcc, y: 0.4 * H };
  const bezA = (u: number) => {
    const a = (1 - u) ** 3;
    const b = 3 * (1 - u) ** 2 * u;
    const c = 3 * (1 - u) * u ** 2;
    const d = u ** 3;
    return { x: a * depart.x + b * c1.x + c * c2h.x + d * sortieHaut.x, y: a * depart.y + b * c1.y + c * c2h.y + d * sortieHaut.y };
  };
  void bez;
  const vol = (k: number): Etat => {
    if (k < 4) {
      const g = rs(k, "JAILLIR");
      return { cx: depart.x, cy: depart.y, s: s0 * (0.88 + 0.12 * Math.min(1.12, g)), rot: 0 };
    }
    if (k < 10) {
      const u = courbe(k, 4, 10, [0.45, 0, 0.35, 1]);
      const pos = bezA(u);
      const s = s0 + (1.0 - s0) * (1 - (1 - u) ** 2);
      const rot = -90 * lisse(u, 0.1, 0.3);
      return garantir({ cx: pos.x, cy: pos.y, s, rot });
    }
    const v = lin(k, 10, 14);
    const e = v * v;
    return { cx: cible.x + 0.1 * W * (1 - e), cy: -0.16 * H + (cible.y + 0.16 * H) * e, s: LAND, rot: rotFin + (-28 - rotFin) * (1 - e) };
  };
  return { W, H, mot, Z, fs, wP, hP, cible, rotFin, vol, s0, depart };
}

export function MotSaute(p: MotSauteProps) {
  usePolicesD();
  const { t, debut, fin } = p;
  if (t < debut || t >= fin) return null;
  const k = (t - debut) * FPS;
  const { W, H, mot, fs, wP, hP, cible, rotFin, vol, s0 } = planMotSaute(p);
  const KL = 14;
  const kSortie = (fin - debut) * FPS - 7;
  const cote = Math.max(wP, hP) * 2.2;

  let e: Etat;
  let dx = 0;
  let dy = 0;
  let angleFlou = 0;
  let pxFlou = 0;
  if (k < KL) {
    e = vol(k);
    const e0 = vol(Math.max(0, k - 1));
    const vx = e.cx - e0.cx;
    const vy = e.cy - e0.cy;
    angleFlou = (Math.atan2(vy, vx) * 180) / Math.PI;
    pxFlou = k >= 4 ? Math.min(0.02 * W, Math.hypot(vx, vy) * 0.32) : 0;
  } else {
    const m = LAND - (LAND - 1) * rs(k - KL, "CLAQUER");
    const vie = k > KL + 11 ? 1.2 * Math.sin((2 * Math.PI * (k - KL - 11)) / 48) : 0;
    e = { cx: cible.x, cy: cible.y, s: m, rot: rotFin + vie };
    dx = secousseD(k - (KL + 3), 0.012 * W);
    // Vie après la pose : flottement vertical de ±0,4 % H (période 1,8 s) ; jamais figée.
    if (k > KL + 6) dy = 0.004 * H * Math.sin((2 * Math.PI * (k - KL - 6)) / 54);
  }
  if (k >= kSortie) {
    const kk = k - kSortie;
    const d = entrant(kk, 0, 7);
    // Aspiration vers le coin haut-droit.
    const cx1 = 1.12 * W;
    const cy1 = -0.06 * H;
    const antic = 1 - 0.04 * lin(kk, 0, 2);
    e = { cx: e.cx + (cx1 - e.cx) * d, cy: e.cy + (cy1 - e.cy) * d, s: e.s * antic * (1 - 0.8 * d), rot: e.rot + 40 * d };
    angleFlou = (Math.atan2(cy1 - e.cy, cx1 - e.cx) * 180) / Math.PI;
    pxFlou = 0.022 * W * lin(kk, 1, 5);
  }

  const focus = k < 4 ? 0.006 * W * (1 - lin(k, 0, 3)) : 0;
  const fantomes = k >= 4 && k < 8 ? [1, 2] : [];
  // Reflet à la pose, puis un second 1 s plus tard.
  const reflet = k >= KL && k <= KL + 12 ? courbe(k, KL + 1, KL + 11, [0.65, 0, 0.35, 1]) : k >= KL + 32 && k <= KL + 44 ? courbe(k, KL + 33, KL + 43, [0.65, 0, 0.35, 1]) : -1;

  const rendre = (et: Etat, flou: number, ang: number, op: number, ombre: boolean, key?: string | number) => (
    <FlouDir key={key} cx={et.cx + dx} cy={et.cy + dy} cote={cote} angle={ang} px={flou}>
      <div style={{ transform: `rotate(${et.rot}deg) scale(${et.s * 1})`, opacity: op, filter: focus > 0.3 && key === undefined ? `blur(${focus}px)` : undefined }}>
        <Puce mot={mot} fs={fs} W={W} reflet={key === undefined ? reflet : -1} ombre={ombre} />
      </div>
    </FlouDir>
  );

  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, overflow: "hidden", pointerEvents: "none" }}>
      {fantomes.map((g) => rendre(vol(k - g), pxFlou, angleFlou, g === 1 ? 0.3 : 0.15, false, g))}
      {rendre(e, pxFlou, angleFlou, 1, true)}
    </div>
  );
}
