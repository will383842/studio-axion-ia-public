import React from "react";
/**
 * SOCLE « PREMIUM » du designer n° 5 (15/10/2026) — petites aides partagées par SablierCout, BadgeRole,
 * PileNotifications et QuestionSondage. Applique le standard `CARTES-20-PREMIUM-2026-10-15.md` SANS toucher aux briques
 * communes (charte.ts, elements.tsx, mouvement.ts, Carte.tsx restent intacts) : tout ce qui est ici est un AJOUT local,
 * à remonter dans le socle commun quand Will aura validé le style.
 *
 *  - 12 jetons de couleur (les 4 couleurs Buffer et des mélanges calculés entre elles), aucune autre teinte ;
 *  - 3 niveaux typographiques (héros / titre / corps, rapport ≥ 1,5, rien sous 0,024 L) ;
 *  - relief hiérarchisé : coque (contour 0,0045 L + ombre dure 0,0075 L), UN héros (0,003 L + 0,005 L), intérieur plat ;
 *  - courbes « pose », « claque », « glisse », « sortie anticipée » ; suivi (écrasement du conteneur) ;
 *  - grain fixe, reflet ivoire, micro-ombre, tampon EXEMPLE discret, chiffres en tambour.
 */
import type { CSSProperties, ReactNode } from "react";
import { Easing, interpolate } from "remotion";
import { GEOMETRIE, POLICES } from "../charte";
import { animationCarte } from "../cadrage";
import { descente, pousseeSousCarte, PRISE_MAQUETTE, ScenePrise } from "./commun";

/* ------------------------------------------------------------------ Couleurs : 12 jetons ------------------------------------------------------------------ */

export const N = Object.freeze({
  ivoire: "#E9DCC8",
  ivoireCreux: "#DECFB9",
  sableClair: "#D4C2AA",
  /** « En attente » / désactivé, et rien d'autre. */
  sable: "#BFA88B",
  sableProfond: "#94806A",
  filet: "#CBBFAD",
  orangeVoile: "#DEC0A8",
  /** « Actif / fort », et rien d'autre. */
  orange: "#B44F29",
  orangeChaud: "#BC6441",
  orangeProfond: "#934122",
  encreDouce: "#45392D",
  encre: "#110A05",
} as const);

/** Encre (#110A05) à une opacité donnée (ombres, micro-ombres). */
export const encreA = (a: number) => `rgba(17, 10, 5, ${a})`;
/** Ivoire (#E9DCC8) à une opacité donnée (reflets, verre). */
export const ivoireA = (a: number) => `rgba(233, 220, 200, ${a})`;

/** Dégradés verticaux entre deux jetons voisins seulement. */
export const DEGRADE = Object.freeze({
  orange: `linear-gradient(180deg, ${N.orangeChaud} 0%, ${N.orange} 55%, ${N.orangeProfond} 100%)`,
  encre: `linear-gradient(180deg, ${N.encreDouce} 0%, ${N.encre} 100%)`,
  ivoire: `linear-gradient(180deg, ${N.ivoire} 0%, ${N.ivoire} 62%, ${N.ivoireCreux} 100%)`,
  creux: `linear-gradient(180deg, ${N.ivoireCreux} 0%, ${N.sableClair} 100%)`,
});

/* ------------------------------------------------------------------ Typographie : 3 niveaux ------------------------------------------------------------------ */

/** Tailles (px) pour une image de largeur W. Corps 0,028 L → titre 0,043 L (× 1,54) → héros ≥ 0,09 L. */
export function typo(W: number) {
  return {
    corps: Math.round(0.028 * W),
    titre: Math.round(0.043 * W),
    /** Titre d'en-tête de carte (0,026 L, interlettrage +0,08 em). */
    entete: Math.round(0.026 * W),
    minimum: Math.round(0.024 * W),
    heros: (f: number) => Math.round(Math.max(0.09, Math.min(0.16, f)) * W),
  };
}

export const STYLE_TITRE: CSSProperties = { fontFamily: POLICES.titre, textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1.05, whiteSpace: "nowrap" };
export const STYLE_CORPS: CSSProperties = { fontFamily: POLICES.texte, lineHeight: 1.22 };
export const STYLE_HEROS: CSSProperties = { fontFamily: POLICES.titre, fontVariantNumeric: "tabular-nums", lineHeight: 0.92, whiteSpace: "nowrap", letterSpacing: "-0.01em" };

/** Grille : unité 8 px (à 1 080), marges intérieures 0,04 L, gouttières 0,02 L. */
export const grille = (W: number) => ({ u: 0.0074 * W, marge: Math.round(0.04 * W), gouttiere: Math.round(0.02 * W) });

/* ------------------------------------------------------------------ Relief ------------------------------------------------------------------ */

export const reliefs = (W: number) => ({
  contourCoque: Math.max(3, Math.round(0.0045 * W)),
  ombreCoque: Math.max(4, Math.round(0.0075 * W)),
  contourHeros: Math.max(2, Math.round(0.003 * W)),
  ombreHeros: Math.max(3, Math.round(0.005 * W)),
  filet: Math.max(1.5, 0.0018 * W),
  rayonCoque: Math.round(0.02 * W),
  rayon: Math.round(0.012 * W),
});

/** Micro-ombre des éléments posés (tuiles, bulles) : encre 12 %, flou 0,006 L, décalage 0,003 L. */
export const microOmbre = (W: number, force = 0.12) => `0 ${0.003 * W}px ${0.006 * W}px ${encreA(force)}`;
/** Ombre intérieure des champs « en creux ». */
export const ombreInterieure = (W: number) => `inset 0 ${0.002 * W}px ${0.004 * W}px ${encreA(0.1)}`;

/** Style de l'UNIQUE élément héros d'une carte : contour 0,003 L + ombre dure 0,005 L. */
export function styleHeros(W: number, fond: string, rayon?: number): CSSProperties {
  const r = reliefs(W);
  return { background: fond, border: `${r.contourHeros}px solid ${N.encre}`, boxShadow: `${r.ombreHeros}px ${r.ombreHeros}px 0 ${N.encre}`, borderRadius: rayon ?? r.rayon, boxSizing: "border-box" };
}

/** Reflet ivoire de 2 px en haut d'une surface orange ou encre (le parent est `position: relative`). */
export function Reflet({ rayon = 0, opacite = 0.22, retrait = 0 }: { rayon?: number; opacite?: number; retrait?: number }) {
  return <div style={{ position: "absolute", left: Math.max(retrait, rayon * 0.6), right: Math.max(retrait, rayon * 0.6), top: 1.5, height: 2, borderRadius: 1, background: ivoireA(opacite), pointerEvents: "none" }} />;
}

/** Grain fixe (bruit SVG encre, ≈ 3,5 % en moyenne). `id` unique par carte. */
export function Grain({ id, opacite = 0.1, frequence = 0.85 }: { id: string; opacite?: number; frequence?: number }) {
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      <filter id={id} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency={frequence} numOctaves={2} seed={7} stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.067  0 0 0 0 0.039  0 0 0 0 0.02  1.6 0 0 0 -0.55" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} opacity={opacite} />
    </svg>
  );
}

/* ------------------------------------------------------------------ Mouvement ------------------------------------------------------------------ */

const BORNE = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** « pose » : ressort amorti, ≈ 6 % de dépassement, 0,18-0,25 s. */
export const pose = (t: number, debut: number, duree = 0.22) => interpolate(t, [debut, debut + duree], [0, 1], { ...BORNE, easing: Easing.out(Easing.back(1.15)) });
/** « claque » : 10-12 % de dépassement en 0,1 s (mot fort). */
export const claque = (t: number, debut: number, duree = 0.1) => interpolate(t, [debut, debut + duree], [0, 1], { ...BORNE, easing: Easing.out(Easing.back(1.9)) });
/** « glisse » : départ vif, arrivée très douce (expo out), 0,15-0,22 s. */
export const glisse = (t: number, debut: number, duree = 0.18) => interpolate(t, [debut, debut + duree], [0, 1], { ...BORNE, easing: Easing.out(Easing.exp) });
/** Sortie : anticipation de 3 % en sens inverse (0,04 s), puis départ en accélération (cubic in, 0,12 s). */
export function sortieAnticipee(t: number, debut: number, duree = 0.12): number {
  if (t < debut) return 0;
  if (t < debut + 0.04) return -0.03 * Math.sin((Math.PI / 2) * ((t - debut) / 0.04));
  return -0.03 + 1.03 * interpolate(t, [debut + 0.04, debut + 0.04 + duree], [0, 1], { ...BORNE, easing: Easing.in(Easing.cubic) });
}
/** Fondu d'arrivée sur les deux premières images (25 i/s). */
export const fonduEntree = (t: number, a: number) => interpolate(t, [a, a + 0.08], [0, 1], BORNE);
/** Bosse 0 → 1 → 0. */
export const bosse = (t: number, debut: number, duree: number) => (t < debut || t > debut + duree ? 0 : Math.sin((Math.PI * (t - debut)) / duree));
/** Suivi : le conteneur s'écrase de `amplitude` (fraction) pendant `duree` à chacun des instants. */
export const ecrasement = (t: number, instants: number[], amplitude = 0.02, duree = 0.1) => instants.reduce((s, a) => s + amplitude * bosse(t, a, duree), 0);
/** Secousse amortie (px) : `amplitude` qui s'éteint en `duree`. */
export function secousse(t: number, debut: number, duree: number, amplitude: number, frequence = 24): number {
  if (t < debut || t > debut + duree) return 0;
  const p = (t - debut) / duree;
  return amplitude * Math.sin(2 * Math.PI * frequence * (t - debut)) * (1 - p) ** 2;
}

/* ------------------------------------------------------------------ Coque de carte ------------------------------------------------------------------ */

export type CoqueProps = {
  t: number;
  debut: number;
  fin: number;
  W: number;
  H: number;
  /** Bas de la carte (fraction de H), 0,47-0,50. */
  bas: number;
  id: string;
  /** Écrasement de suivi (fraction, 0,015-0,025 au plus). */
  ecrase?: number;
  /** Décalage horizontal (px) : secousse. */
  decaleX?: number;
  enfants: ReactNode;
};

/**
 * Coque d'une carte posée sur la bande : contour encre 0,0045 L + ombre dure 0,0075 L (signature de la référence),
 * fond ivoire avec un dégradé très discret vers l'ivoire-creux et un grain fixe. Entre et sort EXACTEMENT comme
 * `Carte.tsx` (animationCarte de cadrage.ts : les contrôles de cadrage restent justes). Aucun en-tête imposé.
 */
export function Coque({ t, debut, fin, W, H, bas, id, ecrase = 0, decaleX = 0, enfants }: CoqueProps) {
  if (t < debut || t >= fin) return null;
  const rect = { x0: GEOMETRIE.carteX, x1: GEOMETRIE.carteX + GEOMETRIE.carteL, y0: GEOMETRIE.carteY, y1: bas };
  const a = animationCarte(t, debut, fin, rect, "chute");
  const r = reliefs(W);
  return (
    <div
      style={{
        position: "absolute",
        left: GEOMETRIE.carteX * W,
        top: GEOMETRIE.carteY * H,
        width: GEOMETRIE.carteL * W,
        height: (bas - GEOMETRIE.carteY) * H,
        transform: `translate(${a.dx * W + decaleX}px, ${a.dy * H}px) rotate(${a.rotation}deg) scale(${a.echelle}) scaleY(${1 - ecrase})`,
        transformOrigin: "50% 0%",
        background: DEGRADE.ivoire,
        border: `${r.contourCoque}px solid ${N.encre}`,
        borderRadius: r.rayonCoque,
        boxShadow: `${r.ombreCoque}px ${r.ombreCoque}px 0 ${N.encre}`,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <Grain id={`grain-${id}`} />
      {enfants}
    </div>
  );
}

/** Place intérieure d'une coque (px) : largeur et hauteur sans le contour. */
export function interieurCoque(W: number, H: number, bas: number) {
  const r = reliefs(W);
  return { l: GEOMETRIE.carteL * W - 2 * r.contourCoque, h: (bas - GEOMETRIE.carteY) * H - 2 * r.contourCoque };
}

/**
 * Scène de démonstration : prise de Will en image fixe qui DESCEND sous l'objet (aucun zoom), visage entier
 * (yeux à `bas + 0,17 H`).
 */
export function ScenePremium({ t, debut, fin, W, H, bas, prise, yeux = PRISE_MAQUETTE.yeux, children }: { t: number; debut: number; fin: number; W: number; H: number; bas: number; prise?: string; yeux?: number; children: ReactNode }) {
  const cible = pousseeSousCarte(yeux, bas + 0.05);
  return (
    <ScenePrise W={W} H={H} fond={prise} pousse={descente(t, debut, fin, cible)}>
      {children}
    </ScenePrise>
  );
}

/* ------------------------------------------------------------------ Tampon EXEMPLE ------------------------------------------------------------------ */

/** Tampon « EXEMPLE » discret : encre, incliné de -6°, 0,024 L, arrive en claque. Ne masque rien (à poser dans un coin). */
export function TamponExemple({ t, a, W, rotation = -6, style, couleur = N.encre, espacement = 0.12 }: { t: number; a: number; W: number; rotation?: number; style?: CSSProperties; couleur?: string; /** Interlettrage (em). */ espacement?: number }) {
  if (t < a) return null;
  const c = claque(t, a, 0.12);
  const taille = typo(W).minimum;
  return (
    <div
      style={{
        position: "absolute",
        ...style,
        border: `${Math.max(2, 0.0022 * W)}px solid ${couleur}`,
        borderRadius: 0.006 * W,
        color: couleur,
        fontFamily: POLICES.titre,
        fontSize: taille,
        lineHeight: 1,
        letterSpacing: `${espacement}em`,
        padding: `${taille * 0.22}px ${taille * 0.36}px ${taille * 0.18}px ${taille * 0.46}px`,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        opacity: fonduEntree(t, a) * 0.92,
        transform: `rotate(${rotation}deg) scale(${1.35 - 0.35 * c})`,
      }}
    >
      Exemple
    </div>
  );
}

/* ------------------------------------------------------------------ Chiffres en tambour ------------------------------------------------------------------ */

export type EtatRoulant = { valeur: string; a: number };

/**
 * Texte en TAMBOUR : à chaque état, les caractères qui changent roulent verticalement (l'ancien monte, le nouveau
 * arrive par le bas) en « pose ». Chiffres tabulaires : le compteur ne danse pas. Aligné à droite.
 */
export function Roulant({ t, etats, taille, couleur, duree = 0.2, police = POLICES.titre, style, entier = false }: { t: number; etats: EtatRoulant[]; taille: number; couleur: string; duree?: number; police?: string; style?: CSSProperties; /** Vrai : le texte roule d'un bloc (mots), faux : caractère par caractère (chiffres). */ entier?: boolean }) {
  if (!etats.length) return null;
  let i = 0;
  for (let k = 0; k < etats.length; k++) if (t >= etats[k].a) i = k;
  const actuel = etats[i].valeur;
  const avant = i > 0 ? etats[i - 1].valeur : actuel;
  const p = i > 0 ? pose(t, etats[i].a, duree) : 1;
  if (entier) {
    const h = taille * 1.08;
    return (
      <span style={{ display: "inline-grid", height: h, overflow: "hidden", fontFamily: police, fontSize: taille, color: couleur, lineHeight: 1.08, whiteSpace: "pre", ...style }}>
        {avant !== actuel && p < 1.0001 ? <span style={{ gridArea: "1 / 1", transform: `translateY(${-p * 100}%)` }}>{avant}</span> : null}
        <span style={{ gridArea: "1 / 1", transform: `translateY(${avant !== actuel ? (1 - p) * 100 : 0}%)` }}>{actuel}</span>
      </span>
    );
  }
  const n = Math.max(actuel.length, avant.length);
  const A = avant.padStart(n, " ");
  const B = actuel.padStart(n, " ");
  const h = taille * 1.0;
  return (
    <span style={{ display: "inline-flex", fontFamily: police, fontSize: taille, color: couleur, fontVariantNumeric: "tabular-nums", lineHeight: 1, ...style }}>
      {Array.from({ length: n }, (_, j) => {
        const a = A[j];
        const b = B[j];
        if (a === b || p >= 1.0001)
          return (
            <span key={j} style={{ display: "inline-block", height: h, whiteSpace: "pre" }}>
              {b}
            </span>
          );
        return (
          <span key={j} style={{ display: "inline-grid", height: h, overflow: "hidden", whiteSpace: "pre" }}>
            <span style={{ gridArea: "1 / 1", transform: `translateY(${-p * 100}%)` }}>{a}</span>
            <span style={{ gridArea: "1 / 1", transform: `translateY(${(1 - p) * 100}%)` }}>{b}</span>
          </span>
        );
      })}
    </span>
  );
}

/** Masque d'encre irrégulière (tampon) : petits manques dans l'encre, fixes. Utilisable en `WebkitMaskImage`. */
export function masqueEncre(graine: number, frequence = 0.9): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${frequence}' numOctaves='2' seed='${graine}'/><feColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -7 0 0 0 4.9'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`;
  return `url("data:image/svg+xml;utf8,${svg.replace(/</g, "%3C").replace(/>/g, "%3E").replace(/"/g, "'")}")`;
}
