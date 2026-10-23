import React from "react";
/**
 * PETITES AIDES « PREMIUM » du designer n° 3 (15/10/2026) — cartes Pile d'outils, Fil de commentaires, Chiffre à
 * palettes et Duel. Fichier NOUVEAU : n'altère rien du socle (`charte.ts`, `elements.tsx`, `mouvement.ts` restent
 * intacts). Quand le socle commun recevra ses ajouts (NUANCES, pose/claque/glisse, Grain…), ces aides pourront être
 * remplacées par celles du socle sans changer le rendu.
 *
 * Standard suivi : `<dossier-de-plan-prive>/CARTES-20-PREMIUM-2026-10-15.md` (§ 2).
 */
import type { CSSProperties, ReactNode } from "react";
import { Easing, interpolate } from "remotion";
import { GEOMETRIE, POLICES } from "../charte";
import { animationCarte } from "../cadrage";
import { Icone } from "../elements";

/* ------------------------------------------------------------------ Couleurs : les 12 jetons ------------------------------------------------------------------ */

/** Les 4 couleurs de la charte et leurs mélanges calculés (§ 2.4). Aucune autre teinte. */
export const N3 = Object.freeze({
  ivoire: "#E9DCC8",
  ivoireCreux: "#DECFB9",
  sableClair: "#D4C2AA",
  sable: "#BFA88B",
  sableProfond: "#94806A",
  filet: "#CBBFAD",
  orangeVoile: "#DEC0A8",
  orange: "#B44F29",
  orangeChaud: "#BC6441",
  orangeProfond: "#934122",
  encreDouce: "#45392D",
  encre: "#110A05",
} as const);

/** Encre (17, 10, 5) ou ivoire (233, 220, 200) avec transparence : ombres, reflets, voiles. */
export const encreA = (a: number) => `rgba(17, 10, 5, ${a})`;
export const ivoireA = (a: number) => `rgba(233, 220, 200, ${a})`;

/** Dégradés verticaux entre jetons voisins. */
export const DEGRADE = Object.freeze({
  orange: `linear-gradient(180deg, ${N3.orangeChaud} 0%, ${N3.orangeProfond} 100%)`,
  encre: `linear-gradient(180deg, ${N3.encreDouce} 0%, ${N3.encre} 100%)`,
  ivoire: `linear-gradient(180deg, ${N3.ivoire} 0%, ${N3.ivoireCreux} 100%)`,
});

/* ------------------------------------------------------------------ Typographie : 3 niveaux ------------------------------------------------------------------ */

/** Tailles (px) des 3 niveaux à la largeur `W` (§ 2.1). Corps 0,026 L, titre 0,04 L (rapport 1,54). */
export function typo(W: number) {
  return {
    corps: Math.round(W * 0.026),
    titre: Math.round(W * 0.04),
    entete: Math.round(W * 0.026),
    min: Math.round(W * 0.024),
  };
}

export const styleTitre = (taille: number, couleur: string): CSSProperties => ({ fontFamily: POLICES.titre, fontSize: taille, color: couleur, textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1.05, fontVariantNumeric: "tabular-nums" });
export const styleCorps = (taille: number, couleur: string): CSSProperties => ({ fontFamily: POLICES.texte, fontSize: taille, color: couleur, lineHeight: 1.25, fontVariantNumeric: "tabular-nums" });

/* ------------------------------------------------------------------ Relief ------------------------------------------------------------------ */

/** Micro-ombre sous un élément posé : encre 12 %, flou 0,006 L, décalage 0,003 L. */
export const microOmbre = (W: number, force = 0.12) => `0 ${Math.round(W * 0.003)}px ${Math.round(W * 0.006)}px ${encreA(force)}`;
/** Filet intérieur (0,0018 L). */
export const filet = (W: number, couleur: string = N3.filet) => `${Math.max(2, Math.round(W * 0.0018))}px solid ${couleur}`;
/** Le SEUL élément héros d'une carte : contour 0,003 L + ombre dure 0,005 L. */
export function styleHeros(W: number, fond: string, rayon: number, enfonce = 0): CSSProperties {
  const o = Math.round(W * 0.005) * (1 - enfonce);
  return { background: fond, border: `${Math.max(3, Math.round(W * 0.003))}px solid ${N3.encre}`, borderRadius: rayon, boxShadow: `${o}px ${o}px 0 ${N3.encre}`, boxSizing: "border-box" };
}

/** Reflet : filet ivoire de 2 px à 22 % en haut d'une surface orange ou encre (le parent doit être `position: relative`). */
export function Reflet({ rayon = 0, retrait = 0 }: { rayon?: number; retrait?: number }) {
  return <div style={{ position: "absolute", left: retrait, right: retrait, top: 1, height: 2, background: ivoireA(0.22), borderRadius: rayon, pointerEvents: "none" }} />;
}

/** Grain fixe (bruit SVG encre, 3,5 %) sur toute la surface du parent. */
export function Grain({ opacite = 0.035, graine = 7 }: { opacite?: number; graine?: number }) {
  const id = `grain-p3-${graine}`;
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: opacite }}>
      <filter id={id} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={graine} stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.067  0 0 0 0 0.039  0 0 0 0 0.02  0 0 0 2.2 -0.6" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}

/* ------------------------------------------------------------------ Mouvement (§ 2.5) ------------------------------------------------------------------ */

const BORNE = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const lin = (t: number, d: number, duree: number) => interpolate(t, [d, d + duree], [0, 1], BORNE);

/** « pose » : ressort amorti, ≈ 6 % de dépassement. */
export const pose = (t: number, d: number, duree = 0.22) => interpolate(t, [d, d + duree], [0, 1], { ...BORNE, easing: Easing.out(Easing.back(1.2)) });
/** « claque » : dépassement de 10-12 % en 0,1 s. */
export const claque = (t: number, d: number, duree = 0.1) => interpolate(t, [d, d + duree], [0, 1], { ...BORNE, easing: Easing.out(Easing.back(1.85)) });
/** « glisse » : expo out. */
export const glisse = (t: number, d: number, duree = 0.18) => interpolate(t, [d, d + duree], [0, 1], { ...BORNE, easing: Easing.out(Easing.exp) });
/** « sortie » : anticipation de 3 % pendant 0,04 s, puis cubic in en 0,12 s. Rend −0,03 → 1. */
export function sortieAnticipee(t: number, d: number): number {
  if (t < d) return 0;
  if (t < d + 0.04) return -0.03 * ((t - d) / 0.04);
  return -0.03 + 1.03 * Easing.in(Easing.cubic)(lin(t, d + 0.04, 0.12));
}
/** Fondu d'entrée sur les 2 premières images. */
export const fondu = (t: number, a: number) => lin(t, a, 0.08);
/** Bosse 0 → 1 → 0. */
export const bosse = (t: number, d: number, duree: number) => Math.sin(Math.PI * lin(t, d, duree));
/** Secousse amortie (px). */
export function secousse(t: number, d: number, duree: number, amp: number, freq = 18): number {
  if (t < d || t > d + duree) return 0;
  const p = (t - d) / duree;
  return amp * Math.sin(2 * Math.PI * freq * (t - d)) * (1 - p) ** 2;
}
/** Respiration continue (N3) : sinus de période `periode`, 0 → 1. */
export const respire = (t: number, periode = 1.2, phase = 0) => 0.5 - 0.5 * Math.cos((2 * Math.PI * (t + phase)) / periode);

/* ------------------------------------------------------------------ Chiffre roulant ------------------------------------------------------------------ */

/**
 * Compteur à tambour, chiffres tabulaires : chaque position roule seulement quand la position de droite passe de 9 à 0.
 * `valeur` peut être fractionnaire (pendant le roulement). Les zéros de tête restent cachés.
 */
export function ChiffreRoulant({ valeur, taille, couleur, chiffres }: { valeur: number; taille: number; couleur: string; chiffres: number }) {
  const h = Math.round(taille * 1.02);
  const lc = taille * 0.66;
  const cases: ReactNode[] = [];
  for (let i = chiffres - 1; i >= 0; i--) {
    const p = Math.pow(10, i);
    const base = Math.floor(valeur / p + 1e-9);
    const reste = valeur - base * p;
    const frac = i === 0 ? reste : Math.max(0, reste - (p - 1));
    const pos = (base % 10) + frac;
    const visible = i === 0 ? 1 : Math.max(0, Math.min(1, valeur - (p - 1)));
    cases.push(
      <div key={i} style={{ width: lc * visible, height: h, overflow: "hidden", position: "relative", opacity: visible }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: lc, transform: `translateY(${-pos * h}px)` }}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((c, k) => (
            <div key={k} style={{ height: h, lineHeight: `${h}px`, textAlign: "center", fontFamily: POLICES.titre, fontSize: taille, color: couleur, fontVariantNumeric: "tabular-nums" }}>
              {c}
            </div>
          ))}
        </div>
      </div>,
    );
  }
  return <div style={{ display: "flex", WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 16%, #000 84%, transparent 100%)", maskImage: "linear-gradient(180deg, transparent 0%, #000 16%, #000 84%, transparent 100%)" }}>{cases}</div>;
}

export const nbChiffres = (n: number) => Math.max(1, String(Math.max(0, Math.floor(n))).length);

/* ------------------------------------------------------------------ Tampon EXEMPLE ------------------------------------------------------------------ */

/** Tampon « EXEMPLE » : petit, encre, incliné de −6°, dans un coin ; il claque (8 % d'échelle) et ne masque rien. */
export function TamponExemple3({ t, a, W, style }: { t: number; a: number; W: number; style?: CSSProperties }) {
  if (t < a) return null;
  const e = claque(t, a, 0.12);
  const taille = typo(W).min;
  return (
    <div
      style={{
        position: "absolute",
        ...style,
        border: `${Math.max(3, Math.round(W * 0.0026))}px solid ${N3.encre}`,
        borderRadius: Math.round(W * 0.007),
        background: ivoireA(0.9),
        padding: `${Math.round(taille * 0.12)}px ${Math.round(taille * 0.42)}px`,
        fontFamily: POLICES.titre,
        fontSize: taille,
        lineHeight: 1.1,
        letterSpacing: "0.14em",
        color: N3.encre,
        whiteSpace: "nowrap",
        opacity: fondu(t, a),
        transform: `rotate(-6deg) scale(${1 + 0.08 * (1 - e)})`,
      }}
    >
      EXEMPLE
    </div>
  );
}

/* ------------------------------------------------------------------ Coque des nouvelles cartes ------------------------------------------------------------------ */

export type EnteteCoque = {
  /** « fenetre » : barre d'application à 3 points ; « etiquette » : icône nue + titre sur filet ; « onglet » : onglet orange. */
  mode: "fenetre" | "etiquette" | "onglet";
  titre: string;
  icone?: string;
  /** Progression discrète (points) : `actif` sur `n`. */
  points?: { n: number; actif: number };
};

/** « 2/5 » → points ; autre chose → rien. */
export function pointsDepuisNumero(numero?: string): EnteteCoque["points"] {
  const m = numero?.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return undefined;
  const n = Math.min(8, Number(m[2]));
  return n > 1 ? { n, actif: Math.min(n, Number(m[1])) - 1 } : undefined;
}

/** Hauteur de l'en-tête de la coque (px). */
export const hauteurEnteteCoque = (H: number) => Math.round(H * 0.034);
/** Marge intérieure (0,04 L). */
export const margeCoque = (W: number) => Math.round(W * 0.04);

/**
 * Coque premium : contour encre 0,0045 L + ombre dure 0,0075 L (signature gardée), fond ivoire → ivoire-creux à peine
 * marqué, grain fixe, en-tête VARIABLE (plus de bandeau orange « 1/10 » identique partout). Entrée et sortie : la même
 * animation que les cartes du moteur (`animationCarte`), pour rester calée sur la descente de la prise.
 * `enfants(l, h)` reçoit la place intérieure (marges de 0,04 L déduites).
 */
export function CoquePremium(p: {
  t: number;
  debut: number;
  fin: number;
  W: number;
  H: number;
  /** Haut et bas de la carte (fractions de H). */
  y0: number;
  y1: number;
  entete: EnteteCoque;
  /** Décalage (px) : secousses de la carte. */
  dx?: number;
  dy?: number;
  /** Écrasement (0,015-0,025) quand le héros se pose. */
  ecrase?: number;
  enfants: (l: number, h: number) => ReactNode;
}) {
  const { t, W, H } = p;
  if (t < p.debut || t >= p.fin) return null;
  const rect = { x0: GEOMETRIE.carteX, x1: GEOMETRIE.carteX + GEOMETRIE.carteL, y0: p.y0, y1: p.y1 };
  const a = animationCarte(t, p.debut, p.fin, rect, "chute");
  const contour = Math.max(3, Math.round(W * GEOMETRIE.contourL));
  const ombre = Math.max(4, Math.round(W * GEOMETRIE.ombreL));
  const l = GEOMETRIE.carteL * W;
  const h = (p.y1 - p.y0) * H;
  const hE = hauteurEnteteCoque(H);
  const marge = margeCoque(W);
  const ty = typo(W);
  const ecrase = p.ecrase ?? 0;
  const li = l - 2 * contour - 2 * marge;
  const hi = h - 2 * contour - hE - 2 * marge;
  const e = p.entete;
  const points = e.points ? (
    <div style={{ display: "flex", alignItems: "center", gap: Math.round(W * 0.007) }}>
      {Array.from({ length: e.points.n }, (_, i) => (
        <div key={i} style={{ width: i === e.points!.actif ? Math.round(W * 0.028) : Math.round(W * 0.009), height: Math.round(W * 0.009), borderRadius: 99, background: i === e.points!.actif ? N3.orange : N3.sableClair }} />
      ))}
    </div>
  ) : null;
  const titre = <span style={{ fontFamily: POLICES.titre, fontSize: ty.entete, color: e.mode === "onglet" ? N3.ivoire : N3.encreDouce, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap", lineHeight: 1 }}>{e.titre}</span>;
  let entete: ReactNode;
  if (e.mode === "fenetre") {
    const d = Math.round(W * 0.012);
    entete = (
      <div style={{ height: hE, flexShrink: 0, background: N3.ivoireCreux, borderBottom: filet(W), display: "flex", alignItems: "center", gap: Math.round(W * 0.022), padding: `0 ${marge}px`, position: "relative" }}>
        <div style={{ display: "flex", gap: Math.round(d * 0.6) }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: d, height: d, borderRadius: "50%", background: i === 0 ? N3.orange : N3.sableClair, boxShadow: `inset 0 0 0 1.5px ${encreA(0.12)}` }} />
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: Math.round(W * 0.01) }}>
          {e.icone ? <Icone nom={e.icone} taille={Math.round(W * 0.03)} couleur={N3.encreDouce} epaisseur={2.4} /> : null}
          {titre}
        </div>
        <div style={{ minWidth: d * 4.2, display: "flex", justifyContent: "flex-end" }}>{points}</div>
      </div>
    );
  } else if (e.mode === "onglet") {
    entete = (
      <div style={{ height: hE, flexShrink: 0, display: "flex", alignItems: "flex-end", padding: `0 ${marge}px`, borderBottom: filet(W), gap: Math.round(W * 0.02) }}>
        <div style={{ position: "relative", height: hE * 0.78, display: "flex", alignItems: "center", gap: Math.round(W * 0.01), padding: `0 ${Math.round(W * 0.02)}px`, background: DEGRADE.orange, borderRadius: `${Math.round(W * 0.012)}px ${Math.round(W * 0.012)}px 0 0` }}>
          <Reflet rayon={4} retrait={6} />
          {e.icone ? <Icone nom={e.icone} taille={Math.round(W * 0.03)} couleur={N3.ivoire} epaisseur={2.4} /> : null}
          {titre}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ height: hE, display: "flex", alignItems: "center" }}>{points}</div>
      </div>
    );
  } else {
    entete = (
      <div style={{ height: hE, flexShrink: 0, display: "flex", alignItems: "center", margin: `0 ${marge}px`, borderBottom: filet(W), gap: Math.round(W * 0.012), paddingTop: Math.round(W * 0.008) }}>
        {e.icone ? <Icone nom={e.icone} taille={Math.round(W * 0.04)} couleur={N3.orange} epaisseur={2.4} /> : null}
        {titre}
        <div style={{ flex: 1 }} />
        {points}
      </div>
    );
  }
  return (
    <div
      style={{
        position: "absolute",
        left: GEOMETRIE.carteX * W,
        top: p.y0 * H,
        width: l,
        height: h,
        transform: `translate(${a.dx * W + (p.dx ?? 0)}px, ${a.dy * H + (p.dy ?? 0)}px) rotate(${a.rotation}deg) scale(${a.echelle * (1 + ecrase * 0.4)}, ${a.echelle * (1 - ecrase)})`,
        transformOrigin: "50% 0%",
        background: DEGRADE.ivoire,
        border: `${contour}px solid ${N3.encre}`,
        borderRadius: Math.round(W * GEOMETRIE.rayonL),
        boxShadow: `${ombre}px ${ombre}px 0 ${N3.encre}`,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Grain />
      {entete}
      <div style={{ position: "relative", flex: 1, margin: marge }}>{p.enfants(li, hi)}</div>
    </div>
  );
}

/** Cœur plein ou vide (tracé Lucide « heart », ISC) — Icone ne sait pas remplir. */
export function Coeur({ taille, plein, couleur }: { taille: number; plein: boolean; couleur: string }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill={plein ? couleur : "none"} stroke={couleur} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}
