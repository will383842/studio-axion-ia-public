/**
 * OUTILS COMMUNS DU LOT 3 « La typo est le personnage » (v2 énergie, 16/10/2026) — standard : STANDARD-DA-V2-2026-10-16.md.
 *
 * Ce fichier n'est PAS un élément : il regroupe ce que partagent les 5 éléments du lot (ressorts nommés du § B.4, zone
 * interdite Z du § B.1, secousse de l'élément, traits d'impact, grain, texte SVG avec contour et ombre dure, mesure des
 * lettres). Rien n'est ajouté à `mouvement.ts` : les ressorts vivent ici, `rebond`, `progression` et `sortie` restent intacts.
 *
 * Unités : le temps d'un élément est exprimé en IMAGES à 30 i/s (`k`, fractionnaire accepté) comptées depuis `i0`, l'image
 * où Will prononce le mot ; les positions sont en pixels de l'image (W × H), calculées depuis des fractions de L et de H.
 */
import React from "react";
import { continueRender, delayRender, Easing, interpolate, spring } from "remotion";
import { COULEURS, POLICES, largeurTexte } from "../../charte";

export const FPS = 30;

/** Nuances de la charte (copie de `NUANCES` de premium-1/2 : aucune teinte nouvelle). */
export const N3 = Object.freeze({
  ivoire: COULEURS.ivoire,
  ivoireCreux: "#DECFB9",
  sableClair: "#D4C2AA",
  sable: COULEURS.sable,
  sableProfond: "#94806A",
  orange: COULEURS.orange,
  orangeChaud: "#BC6441",
  orangeProfond: "#934122",
  encreDouce: "#45392D",
  encre: COULEURS.encre,
} as const);

/** Ressorts nommés du standard (§ B.4). Dépassements et temps de pose THÉORIQUES, à confirmer avec `measureSpring`. */
export const RESSORTS = Object.freeze({
  JAILLIR: { damping: 12, stiffness: 200, mass: 0.7 },
  CLAQUER: { damping: 18, stiffness: 420, mass: 0.5 },
  POSER: { damping: 20, stiffness: 170, mass: 1 },
  GLISSER: { damping: 26, stiffness: 260, mass: 0.8 },
  TOUPIE: { damping: 9, stiffness: 140, mass: 0.8 },
  BALANCER: { damping: 5, stiffness: 90, mass: 1 },
} as const);
export type NomRessort = keyof typeof RESSORTS;

/** Valeur 0 → 1 (avec dépassement) du ressort `nom` `k` images après son départ. */
export function ressort(k: number, nom: NomRessort): number {
  if (k <= 0) return 0;
  return spring({ frame: k, fps: FPS, config: RESSORTS[nom] });
}

const BORNE = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** Progression 0 → 1 de `k0` à `k1` (images), courbe `Easing.bezier(a, b, c, d)`. */
export function courbe(k: number, k0: number, k1: number, bez: readonly [number, number, number, number] = [0.33, 0, 0.2, 1]): number {
  return interpolate(k, [k0, k1], [0, 1], { ...BORNE, easing: Easing.bezier(...bez) });
}
export const lin = (k: number, k0: number, k1: number) => interpolate(k, [k0, k1], [0, 1], BORNE);
export const entrant = (k: number, k0: number, k1: number) => interpolate(k, [k0, k1], [0, 1], { ...BORNE, easing: Easing.in(Easing.cubic) });
export const borne = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const rad = (d: number) => (d * Math.PI) / 180;

/** Secousse de l'ÉLÉMENT SEUL (jamais de la prise) : dx(k) = A · e^(−k/3) · sin(2πk/3), sur 8 images (M4). */
export function secousse(kLocal: number, amplitudePx: number): number {
  if (kLocal < 0 || kLocal > 8) return 0;
  return amplitudePx * Math.exp(-kLocal / 3) * Math.sin((2 * Math.PI * kLocal) / 3);
}

/* ------------------------------------------------------------------ Géométrie : zone interdite Z ------------------------------------------------------------------ */

/** Rectangle en pixels. */
export type RectPx = { x0: number; y0: number; x1: number; y1: number };

/** Réglages de la prise (mêmes champs que `PRISE_PAR_DEFAUT` de cadrage.ts). */
export type PriseLot = { yeux: number; centreX: number; largeurVisage: number };
export const PRISE_DEFAUT_LOT: PriseLot = Object.freeze({ yeux: 0.34, centreX: 0.5, largeurVisage: 0.38 });
/** PRISE COMMUNE des planches v2 (prise-commune-1080x1920.png : yeux à y 625, visage de x 290 à 820, mesuré sur l'image). */
export const PRISE_COMMUNE_LOT: PriseLot = Object.freeze({ yeux: 0.325, centreX: 0.513, largeurVisage: 0.49 });

/**
 * Zone interdite Z (§ B.1) : boîte du visage (des cheveux au menton : yeux − 0,20 H → yeux + 0,22 H ; largeur de visage × 1,2)
 * + marge de 0,02. Recalculée depuis la prise : les emplacements se DÉDUISENT de Z, aucune valeur figée.
 */
export function zonePx(prise: PriseLot, W: number, H: number, marge = 0.02): RectPx {
  const demi = (prise.largeurVisage * 1.2) / 2;
  return { x0: (prise.centreX - demi - marge) * W, x1: (prise.centreX + demi + marge) * W, y0: (prise.yeux - 0.2 - marge) * H, y1: (prise.yeux + 0.22 + marge) * H };
}

export const intersecte = (a: RectPx, b: RectPx) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/** Boîte englobante (px) d'un rectangle `w × h` centré en (cx, cy), tourné de `deg` degrés. */
export function boiteTournee(cx: number, cy: number, w: number, h: number, deg: number): RectPx {
  const c = Math.abs(Math.cos(rad(deg)));
  const s = Math.abs(Math.sin(rad(deg)));
  const ex = (w * c + h * s) / 2;
  const ey = (w * s + h * c) / 2;
  return { x0: cx - ex, x1: cx + ex, y0: cy - ey, y1: cy + ey };
}

/** Taille minimale d'un texte lisible : 36 px à 1 080 de large (règle du 16/10 : jamais de texte sous 36 px). */
export const TAILLE_MIN = (W: number) => Math.round((36 * W) / 1080) + 2;

/** Dimensions estimées (px) d'un mot de `taille` px : largeur large (capitales), hauteur de ligne 0,8 em. */
export function dimensionsMot(texte: string, taille: number): { w: number; h: number } {
  return { w: avancesLettres(texte, taille).reduce((a, b) => a + b, 0) * 1.03, h: taille * 0.8 };
}

/* ------------------------------------------------------------------ Mesure des lettres ------------------------------------------------------------------ */

let toile: CanvasRenderingContext2D | null = null;

/** Avance (px) de chaque lettre en Montserrat ExtraBold à `taille` px ; estimation de la charte tant que la police n'est pas là. */
export function avancesLettres(texte: string, taille: number): number[] {
  const lettres = [...texte.toUpperCase()];
  if (typeof document !== "undefined") {
    toile ??= document.createElement("canvas").getContext("2d");
    if (toile) {
      toile.font = `800 ${taille}px "${POLICES.titre}"`;
      const m = lettres.map((c) => toile!.measureText(c).width);
      if (m.every((v) => v > 0)) return m;
    }
  }
  return lettres.map((c) => largeurTexte(c, taille) * 0.92);
}

/**
 * Force un second rendu une fois la police chargée (le premier peut avoir mesuré avec la police de secours). Le rendu
 * Remotion attend la fin du chargement : jamais une image avec une police de secours.
 */
export function usePoliceLot3(): boolean {
  const [prete, setPrete] = React.useState<boolean>(() => typeof document !== "undefined" && document.fonts.check(`800 40px "${POLICES.titre}"`) && (document.fonts as unknown as { size: number }).size > 0);
  React.useEffect(() => {
    if (prete || typeof document === "undefined") return;
    const attente = delayRender("Police du lot 3");
    document.fonts
      .load(`800 40px "${POLICES.titre}"`)
      .catch(() => undefined)
      .then(() => {
        setPrete(true);
        continueRender(attente);
      });
  }, [prete]);
  return prete;
}

/* ------------------------------------------------------------------ Éléments graphiques partagés ------------------------------------------------------------------ */

/** Texte SVG centré, contour encre + ombre dure vers le bas-droit (une seule direction de lumière). */
export function MotSvg(p: {
  texte: string;
  cx: number;
  cy: number;
  taille: number;
  rot?: number;
  echelle?: number;
  etireX?: number;
  etireY?: number;
  remplissage?: string;
  contour?: string;
  contourPx: number;
  ombrePx?: number;
  ombreCouleur?: string;
  opacite?: number;
  filtre?: string;
  espacement?: number;
}) {
  const { texte, cx, cy, taille, rot = 0, echelle = 1, etireX = 1, etireY = 1, remplissage = N3.orange, contour = N3.encre, contourPx, ombrePx = 0, ombreCouleur = N3.encre, opacite = 1, filtre, espacement = 0 } = p;
  const commun = { fontFamily: POLICES.titre, fontWeight: 800, fontSize: taille, textAnchor: "middle" as const, letterSpacing: espacement, strokeLinejoin: "round" as const };
  const y = taille * 0.36;
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rot}) scale(${echelle * etireX} ${echelle * etireY})`} opacity={opacite}>
      {ombrePx > 0 ? (
        <text x={ombrePx} y={y + ombrePx} {...commun} fill={ombreCouleur} stroke={ombreCouleur} strokeWidth={contourPx}>
          {texte}
        </text>
      ) : null}
      <g filter={filtre}>
        <text x={0} y={y} {...commun} fill={remplissage} stroke={contour} strokeWidth={contourPx} paintOrder="stroke fill">
          {texte}
        </text>
      </g>
    </g>
  );
}

/** Filtre « encre » : retire quelques taches du remplissage (texture fait main, § B.3 F9 / F11). `reste` : part d'encre gardée. */
export function FiltreEncre({ id, seed = 3, trou = 0.1, grain = 0.04 }: { id: string; seed?: number; trou?: number; grain?: number }) {
  // alpha = −14 · bruit + b : le bruit moyen vaut 0,5 ; `trou` règle la part de taches retirées.
  const b = 14 * (0.74 - trou);
  return (
    <filter id={id} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.11 0.13" numOctaves={3} seed={seed} result="bruit" />
      <feColorMatrix in="bruit" type="matrix" values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -14 ${b.toFixed(2)}`} result="masque" />
      <feComposite in="SourceGraphic" in2="masque" operator="in" result="coupe" />
      {/* Grain fin (≈ `grain` de la surface) : petits points d'encre sur le remplissage, jamais animé. */}
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={seed + 20} result="g" />
      <feColorMatrix in="g" type="matrix" values={`0 0 0 0 0.07  0 0 0 0 0.04  0 0 0 0 0.02  0 0 0 ${(40 * grain).toFixed(2)} ${(-40 * grain * 0.66).toFixed(2)}`} result="gs" />
      <feComposite in="gs" in2="coupe" operator="atop" />
    </filter>
  );
}

/** Grain fin (4 à 6 % : `force`) posé sur un aplat — `feTurbulence` fixe, jamais animé. */
export function GrainAplat({ id, W, H, force = 0.06 }: { id: string; W: number; H: number; force?: number }) {
  return (
    <g>
      <filter id={id} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={11} />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect x={0} y={0} width={W} height={H} filter={`url(#${id})`} opacity={force * 2.2} style={{ mixBlendMode: "multiply" }} />
    </g>
  );
}

/** 4 traits d'impact (encre) aux coins d'une boîte, qui jaillissent en 2 images puis disparaissent à 4 (`kLocal` = k − (kAtterrissage + 3)). */
export function TraitsImpact({ boite, kLocal, W, couleur = N3.encre }: { boite: RectPx; kLocal: number; W: number; couleur?: string }) {
  if (kLocal < 0 || kLocal > 4) return null;
  const long = 0.05 * W * (0.35 + 0.65 * lin(kLocal, 0, 2));
  const op = kLocal <= 2 ? 1 : 1 - (kLocal - 2) / 2;
  const ecart = 0.012 * W;
  const coins: [number, number, number, number][] = [
    [boite.x0, boite.y0, -1, -1],
    [boite.x1, boite.y0, 1, -1],
    [boite.x0, boite.y1, -1, 1],
    [boite.x1, boite.y1, 1, 1],
  ];
  return (
    <g opacity={op} stroke={couleur} strokeWidth={Math.max(4, 0.007 * W)} strokeLinecap="round">
      {coins.map(([x, y, sx, sy], i) => {
        // Trait radial incliné de 18° par rapport à la diagonale, un seul de chaque côté du coin.
        const a = Math.atan2(sy, sx) + (i % 2 === 0 ? 0.3 : -0.3);
        const x0 = x + Math.cos(a) * ecart;
        const y0 = y + Math.sin(a) * ecart;
        return <line key={i} x1={x0} y1={y0} x2={x0 + Math.cos(a) * long} y2={y0 + Math.sin(a) * long} />;
      })}
    </g>
  );
}

/** Calque plein cadre pour les SVG des éléments (rien ne capte la souris, tout reste dans l'image). */
export function Cadre({ W, H, children }: { W: number; H: number; children: React.ReactNode }) {
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", overflow: "hidden" }}>
      {children}
    </svg>
  );
}

/** Polygone (px) de la part du cadre située du côté `s > seuil` d'une droite de normale `d` (Sutherland–Hodgman sur le rectangle). */
export function demiPlan(W: number, H: number, d: { x: number; y: number }, seuil: number): string {
  const pts: [number, number][] = [
    [0, 0],
    [W, 0],
    [W, H],
    [0, H],
  ];
  const f = (p: [number, number]) => p[0] * d.x + p[1] * d.y - seuil;
  const sortie: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const fa = f(a);
    const fb = f(b);
    if (fa >= 0) sortie.push(a);
    if (fa >= 0 !== fb >= 0) {
      const u = fa / (fa - fb);
      sortie.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
    }
  }
  return sortie.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

/** Sons du lot (fichiers de `sons/`, tous CC0) : `k` = image de déclenchement depuis i0. */
export type SonLot = { k: number; fichier: string; volume?: number };

/** Fiche commune (mêmes champs que les `FICHE_*` des familles existantes + les 4 étiquettes de la grammaire v2). */
export type FicheLot3 = {
  id: string;
  numero: number;
  nom: string;
  emplacement: string;
  forme: string;
  mouvement: string;
  sortie: string;
  visage: "entier" | "couvert";
  ouvertureAutorisee: boolean;
  dureeMin: number;
  dureeMax: number;
  quandUtiliser: string;
  sons: readonly SonLot[];
};
