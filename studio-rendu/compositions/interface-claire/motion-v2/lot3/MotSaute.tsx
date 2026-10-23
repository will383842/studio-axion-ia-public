/**
 * ÉLÉMENT 11 — « MOT QUI SAUTE » (v2 énergie, lot 3 « La typo est le personnage », designer n° 3, 16/10/2026).
 * Standard : STANDARD-DA-V2-2026-10-16.md § D lot 3, ligne 11 ; formes F11 ; mouvements M4 (atterrissage) + trajectoire en arc.
 *
 * Quand : LE MOT FORT de la phrase (le mot que Will appuie). C'est l'élément idéal pour la micro-accroche à 0,8-2 s (D9).
 * Visage : ENTIER. Le mot ne couvre jamais le visage, ni à l'état posé, ni PENDANT sa trajectoire (éliminatoire n° 5) :
 * la zone interdite Z est recalculée depuis la prise (`zonePx`), et à chaque image le mot est repoussé hors de Z puis, s'il
 * ne tient pas, réduit jusqu'à tenir. Aucun zoom, aucun mouvement de la prise : seule la lettre bouge.
 *
 * Chorégraphie (30 i/s, i0 = image où Will dit le mot) :
 *  - i0 → i4   : le mot quitte la bande des sous-titres (E bande S, 0,64 H) : échelle de 1 à 1,8 (sortie douce) ;
 *  - i4 → i14  : ARC PARABOLIQUE de 10 images par le côté droit de Z (la gauche seulement si `cote="gauche"`). Sur le premier tiers :
 *                étirement de 6 % et 2 copies fantômes à 30 % puis 15 %. Le mot se resserre quand il passe dans le couloir ;
 *  - i14       : ATTERRISSAGE M4 en E5 haut-droit (centre 0,66-0,70 L, collé sous le haut du cadre, mot de 0,55-0,65 L de large incliné de −8°) : échelle de ×1,1 à ×1 avec `CLAQUER`,
 *                4 traits d'impact encre à i17, secousse DE L'ÉLÉMENT (A = 0,012 L) de i17 à i25 ;
 *  - ensuite   : micro-vie = oscillation de ±1,2° sur 1,6 s (jamais immobile) ;
 *  - sortie    : ENVOL (anticipation de 2 images à −3 %, puis départ hors du cadre vers le haut) sur les 7 dernières images.
 * Forme F11 : le mot EST la forme — Montserrat ExtraBold orange, contour encre 0,004 L, ombre dure encre vers le bas-droit.
 * Bruitage : `select_001` au départ (i0), `drop_003` à l'arrivée (i14).
 *
 * Le mot est TOUJOURS un mot que Will vient de dire (le réalisateur le passe en `mot`) : l'élément n'invente rien.
 * Le sous-titre du même mot doit être masqué par la couche des sous-titres pendant l'élément (le mot « quitte » la ligne).
 */
import React from "react";
import { Cadre, MotSvg, N3, PRISE_DEFAUT_LOT, ressort, secousse, TAILLE_MIN, TraitsImpact, boiteTournee, borne, courbe, dimensionsMot, entrant, FPS, intersecte, lin, usePoliceLot3, zonePx } from "./outils3";
import type { FicheLot3, PriseLot, RectPx } from "./outils3";

export const ID_MOT_SAUTE = "mot-saute";
/** Échelle d'arrivée du claquement (×1,18 → ×1) : assez bas pour que le mot de 0,6 L ne mange pas le crâne à l'impact. */
const LAND = 1.1;
export const DUREE_MOT_SAUTE = Object.freeze({ min: 1.0, max: 2.0 });

export const FICHE_MOT_SAUTE: FicheLot3 = Object.freeze({
  id: ID_MOT_SAUTE,
  numero: 11,
  nom: "Mot qui saute",
  emplacement: "E5 halo : part de la bande S, atterrit en haut (côté du plus grand couloir, haut-droit par défaut)",
  forme: "F11 typographie seule, orange, contour encre",
  mouvement: "arc parabolique de 10 images + M4 à l'atterrissage",
  sortie: "envol",
  visage: "entier" as const,
  ouvertureAutorisee: true,
  dureeMin: DUREE_MOT_SAUTE.min,
  dureeMax: DUREE_MOT_SAUTE.max,
  quandUtiliser: "Le mot fort de la phrase, à 0,8-2 s (micro-accroche) ou n'importe où ensuite. Au plus 2 par vidéo.",
  sons: [
    { k: 0, fichier: "select_001" },
    { k: 14, fichier: "drop_003" },
  ],
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
  /** Position du mot dans la bande des sous-titres (fractions de L et H). Par défaut : centre, 0,64 H. */
  depart?: { x: number; y: number };
  /** Côté du couloir (par défaut « auto » : le plus large ; la droite sur une prise symétrique). */
  cote?: "droite" | "gauche" | "auto";
  /** Taille du mot dans le sous-titre (fraction de L). */
  tailleSousTitre?: number;
};

type Etat = { cx: number; cy: number; taille: number; rot: number; etire: number };

/** Tout ce qui ne dépend que de la prise et du mot (pur, sans état). */
export function planMotSaute(p: Pick<MotSauteProps, "largeurImage" | "hauteurImage" | "mot" | "prise" | "depart" | "cote" | "tailleSousTitre">) {
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const mot = p.mot.toUpperCase();
  const Z = zonePx(p.prise ?? PRISE_DEFAUT_LOT, W, H);
  const couloirD = W - Z.x1 - 0.03 * W;
  const couloirG = Z.x0 - 0.03 * W;
  const sens = p.cote === "gauche" ? -1 : 1; // atterrissage à DROITE par défaut (critique du 16/10)
  const couloir = Math.max(0.05 * W, sens > 0 ? couloirD : couloirG);
  const t0 = (p.tailleSousTitre ?? 0.058) * W;
  const depart = { x: (p.depart?.x ?? 0.5) * W, y: (p.depart?.y ?? 0.64) * H };
  const rotFin = -8;

  // Atterrissage : on cherche la plus grande taille (≤ 0,13 L) dont la boîte À ×1,4 reste hors de Z et dans le cadre.
  let tailleF = TAILLE_MIN(W);
  let cible = { x: (sens > 0 ? 0.7 : 0.3) * W, y: 0.16 * H };
  const Zh = zonePx(p.prise ?? PRISE_DEFAUT_LOT, W, H, 0);
  for (let tf = 0.2 * W; tf >= TAILLE_MIN(W); tf *= 0.97) {
    const d = dimensionsMot(mot, tf * LAND);
    const b0 = boiteTournee(0, 0, d.w, d.h, rotFin);
    const demiL = (b0.x1 - b0.x0) / 2;
    const demiH = (b0.y1 - b0.y0) / 2;
    let cx = borne((sens > 0 ? 0.7 : 0.3) * W, 0.03 * W + demiL, 0.97 * W - demiL);
    let cy = 0.16 * H;
    if (intersecte(boiteTournee(cx, cy, d.w, d.h, rotFin), Zh)) cy = Zh.y0 - 4 - demiH;
    if (cy - demiH < 0) continue;
    if (intersecte(boiteTournee(cx, cy, d.w, d.h, rotFin), Zh)) continue;
    tailleF = tf;
    cible = { x: cx, y: cy };
    break;
  }

  const xcc = sens > 0 ? Z.x1 + couloir / 2 : Z.x0 - couloir / 2;
  const c1 = { x: xcc, y: depart.y - 0.1 * H };
  const c2 = { x: xcc, y: cible.y + 0.18 * H };
  // Pendant la traversée du couloir le mot se met debout (−90° : il « grimpe ») : seule sa hauteur compte pour passer.
  const h18 = dimensionsMot(mot, t0 * 1.8).h + 0.02 * W;
  const qmin = borne((couloir * 0.9) / h18, 0.25, 1);

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

  /** Repousse hors de Z puis réduit jusqu'à ce que la boîte tienne : garantie « jamais dans Z » pendant le vol. */
  const garantir = (e: Etat, ecarte: boolean): Etat => {
    let { cx, cy, taille } = e;
    for (let i = 0; i < 14; i++) {
      const d = dimensionsMot(mot, taille);
      const b = boiteTournee(cx, cy, d.w, d.h, e.rot);
      if (ecarte && intersecte(b, Z)) {
        const demi = (b.x1 - b.x0) / 2;
        cx = sens > 0 ? Z.x1 + 4 + demi : Z.x0 - 4 - demi;
      }
      const b2 = boiteTournee(cx, cy, d.w, d.h, e.rot);
      const dansZ = ecarte && intersecte(b2, Z);
      const horsCadre = b2.x0 < 0 || b2.x1 > W;
      if (!dansZ && !horsCadre) break;
      if (taille <= TAILLE_MIN(W)) break;
      taille = Math.max(TAILLE_MIN(W), taille * 0.92);
    }
    return { ...e, cx, cy, taille };
  };

  /** État du mot à l'image k (≥ 0), sans l'atterrissage ni la sortie. */
  const vol = (k: number): Etat => {
    if (k < 4) {
      const g = 1 - (1 - lin(k, 0, 4)) ** 3;
      return { cx: depart.x, cy: depart.y, taille: t0 * (1 + 0.8 * g), rot: 0, etire: 1 };
    }
    const u = courbe(k, 4, 14, [0.45, 0, 0.35, 1]);
    const pos = bez(u);
    const s = 1.8 + (LAND * tailleF / t0 - 1.8) * (1 - (1 - u) ** 2);
    const bosse = lisse(u, 0.12, 0.3) - lisse(u, 0.7, 0.88);
    const taille = Math.max(TAILLE_MIN(W), t0 * s * (1 - (1 - qmin) * bosse));
    const debout = lisse(u, 0.12, 0.3) - lisse(u, 0.72, 0.92);
    const rot = rotFin * u - 90 * debout;
    const etire = k < 7 ? 1.06 : 1;
    return garantir({ cx: pos.x, cy: pos.y, taille, rot, etire }, true);
  };

  return { W, H, mot, Z, sens, couloir, t0, tailleF, cible, rotFin, vol };
}

export function MotSaute(p: MotSauteProps) {
  usePoliceLot3();
  const { t, debut, fin } = p;
  if (t < debut || t >= fin) return null;
  const k = (t - debut) * FPS;
  const { W, H, mot, sens, tailleF, cible, rotFin, vol } = planMotSaute(p);
  const KL = 14;
  const kSortie = (fin - debut) * FPS - 7;

  let e: Etat;
  let dx = 0;
  let dy = 0;
  let echelle = 1;
  if (k < KL) {
    e = vol(k);
  } else {
    // Atterrissage M4 : de ×1,4 à ×1 avec CLAQUER (le vol finit à ×1,4 : aucune rupture).
    const m = LAND - (LAND - 1) * ressort(k - KL, "CLAQUER");
    const vie = k > KL + 11 ? 1.2 * Math.sin((2 * Math.PI * (k - KL - 11)) / 48) : 0;
    e = { cx: cible.x, cy: cible.y, taille: tailleF * m, rot: rotFin + vie, etire: 1 };
    dx = secousse(k - (KL + 3), 0.012 * W);
  }

  // Sortie : ENVOL (anticipation −3 % sur 2 images, puis départ hors du cadre vers le haut, côté du couloir).
  if (k >= kSortie) {
    const kk = k - kSortie;
    echelle = 1 - 0.03 * lin(kk, 0, 2);
    const d = entrant(kk, 2, 7);
    dx = dx * (1 - lin(kk, 0, 2)) + sens * 0.18 * W * d;
    dy -= 0.5 * H * d;
    e = { ...e, rot: e.rot + sens * 14 * d };
  }

  const contourPx = Math.max(3, 0.004 * W);
  const ombrePx = Math.max(4, 0.006 * W);
  const fantomes = k >= 4 && k < 7 ? [1, 2] : [];
  const boiteImpact: RectPx = (() => {
    const d = dimensionsMot(mot, tailleF);
    return boiteTournee(cible.x, cible.y, d.w, d.h, rotFin);
  })();

  return (
    <Cadre W={W} H={H}>
      {fantomes.map((g) => {
        const f = vol(k - g);
        return <MotSvg key={g} texte={mot} cx={f.cx} cy={f.cy} taille={f.taille} rot={f.rot} etireX={f.etire} remplissage={N3.orange} contour={N3.orange} contourPx={0} opacite={g === 1 ? 0.3 : 0.15} />;
      })}
      <MotSvg texte={mot} cx={e.cx + dx} cy={e.cy + dy} taille={e.taille} rot={e.rot} echelle={echelle} etireX={e.etire} remplissage={N3.orange} contour={N3.encre} contourPx={contourPx} ombrePx={ombrePx} />
      {k >= KL + 3 && k < kSortie ? <TraitsImpact boite={boiteImpact} kLocal={k - (KL + 3)} W={W} /> : null}
    </Cadre>
  );
}
