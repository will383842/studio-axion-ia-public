import React from "react";
/**
 * PETITES AIDES « PREMIUM » du designer n° 4 (15/10/2026) pour ses 4 cartes : Volet avant / après, Cadran de journée,
 * Objection barrée, Message vocal. Fichier NOUVEAU et autonome : il n'ajoute rien à `charte.ts`, `elements.tsx` ni
 * `mouvement.ts` (le socle commun sera posé par le directeur artistique ; ces aides pourront y migrer telles quelles).
 *
 * Standard suivi : `<dossier-de-plan-prive>/CARTES-20-PREMIUM-2026-10-15.md` (§ 2) — 12 jetons de couleur,
 * 3 niveaux typographiques (rien sous 26 px), coque = seule boîte à contour épais, un seul héros en relief, micro-ombre,
 * reflet, grain fixe, courbes « pose / claque / glisse / sortie anticipée ».
 */
import type { CSSProperties } from "react";
import { Easing, interpolate } from "remotion";
import { COULEURS, POLICES } from "../charte";

/* ------------------------------------------------------------------ Couleurs : les 12 jetons ------------------------------------------------------------------ */

/** Les 4 couleurs de la charte et 8 mélanges calculés entre elles. Aucune autre teinte. */
export const N4 = Object.freeze({
  ivoire: COULEURS.ivoire,
  ivoireCreux: "#DECFB9",
  sableClair: "#D4C2AA",
  /** « En attente / désactivé » uniquement. */
  sable: COULEURS.sable,
  sableProfond: "#94806A",
  filet: "#CBBFAD",
  orangeVoile: "#DEC0A8",
  /** « Actif / fort » uniquement. */
  orange: COULEURS.orange,
  orangeChaud: "#BC6441",
  orangeProfond: "#934122",
  encreDouce: "#45392D",
  encre: COULEURS.encre,
} as const);

/** Encre (#110A05) ou ivoire (#E9DCC8) avec une opacité : ombres, reflets, grain. */
export const encreA = (a: number) => `rgba(17, 10, 5, ${a})`;
export const ivoireA = (a: number) => `rgba(233, 220, 200, ${a})`;

/** Dégradé vertical orange-chaud → orange-profond (surfaces héros orange). */
export const DEGRADE_ORANGE = `linear-gradient(180deg, ${N4.orangeChaud} 0%, ${N4.orangeProfond} 100%)`;
/** Dégradé vertical ivoire → ivoire-creux (tuiles, cadrans). */
export const DEGRADE_IVOIRE = `linear-gradient(180deg, ${N4.ivoire} 0%, ${N4.ivoireCreux} 100%)`;

/* ------------------------------------------------------------------ Typographie : 3 niveaux ------------------------------------------------------------------ */

/** Taille minimale absolue d'un texte : 0,024 L (26 px à 1 080). */
export const MIN_TEXTE_L = 0.024;

/**
 * Les 3 niveaux (fractions de L) communs aux 4 cartes : corps 0,027 L (29 px), titre 0,041 L (44 px, rapport 1,52),
 * héros ≥ 0,075 L (rapport ≥ 1,8). Une carte peut monter le héros jusqu'à 0,16 L.
 */
export const TYPO4 = Object.freeze({ corps: 0.027, titre: 0.041, herosMin: 0.075 });

export const styleCorps = (W: number, taille = TYPO4.corps, couleur: string = N4.encre): CSSProperties => ({
  fontFamily: POLICES.texte,
  fontSize: Math.max(MIN_TEXTE_L * W, taille * W),
  color: couleur,
  lineHeight: 1.22,
  whiteSpace: "nowrap",
});

export const styleTitre = (W: number, taille = TYPO4.titre, couleur: string = N4.encre): CSSProperties => ({
  fontFamily: POLICES.titre,
  fontSize: taille * W,
  color: couleur,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  lineHeight: 1.05,
  whiteSpace: "nowrap",
});

/** Chiffres tabulaires (un compteur ne « danse » pas). */
export const TABULAIRE: CSSProperties = { fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum" 1' };

/** Largeur ESTIMÉE (px) d'un texte en Inter Bold, casse naturelle (volontairement un peu large). */
export function largeurInter(texte: string, taille: number): number {
  let s = 0;
  for (const c of texte) {
    if (/\s/.test(c)) s += 0.27;
    else if (/[mwMW]/.test(c)) s += 0.86;
    else if (/[iljI'’.,:;!|]/.test(c)) s += 0.3;
    else if (/[ft]/.test(c)) s += 0.4;
    else if (/[A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ]/.test(c)) s += 0.7;
    else if (/\d/.test(c)) s += 0.62;
    else s += 0.53;
  }
  return s * taille;
}

/** Coupe une suite de mots en lignes de largeur ≤ `largeur` (glouton), selon une fonction de mesure. */
export function couperLignes<T extends { texte: string }>(mots: T[], largeur: number, mesure: (s: string) => number): T[][] {
  const lignes: T[][] = [];
  let cur: T[] = [];
  for (const m of mots) {
    const essai = [...cur, m].map((x) => x.texte).join(" ");
    if (cur.length && mesure(essai) > largeur) {
      lignes.push(cur);
      cur = [m];
    } else cur.push(m);
  }
  if (cur.length) lignes.push(cur);
  return lignes;
}

/* ------------------------------------------------------------------ Relief ------------------------------------------------------------------ */

/** Coque (niveau 0) : contour encre 0,0045 L + ombre dure 0,0075 L, coins 0,02 L — la signature de la référence. */
export function styleCoque(W: number, fond: string = N4.ivoire): CSSProperties {
  const c = Math.max(3, Math.round(0.0045 * W));
  const o = Math.max(4, Math.round(0.0075 * W));
  return { background: fond, border: `${c}px solid ${N4.encre}`, borderRadius: Math.round(0.02 * W), boxShadow: `${o}px ${o}px 0 ${N4.encre}`, boxSizing: "border-box" };
}

/** Héros (niveau 2, UN seul par carte) : contour 0,003 L + ombre dure 0,005 L. */
export function styleHeros(W: number): CSSProperties {
  const c = Math.max(2, Math.round(0.003 * W));
  const o = Math.max(3, Math.round(0.005 * W));
  return { border: `${c}px solid ${N4.encre}`, boxShadow: `${o}px ${o}px 0 ${N4.encre}`, boxSizing: "border-box" };
}

/** Micro-ombre sous un élément posé : encre 12 %, flou 0,006 L, décalage 0,003 L. */
export const microOmbre = (W: number, a = 0.12) => `0 ${Math.round(0.003 * W)}px ${Math.round(0.006 * W)}px ${encreA(a)}`;
/** Ombre intérieure d'un champ en creux (10 %). */
export const ombreCreux = (W: number) => `inset 0 ${Math.round(0.003 * W)}px ${Math.round(0.006 * W)}px ${encreA(0.1)}`;
/** Épaisseur d'un filet intérieur (0,0018 L). */
export const epFilet = (W: number) => Math.max(2, Math.round(0.0018 * W));

/** Reflet ivoire de 2 px à 22 % en haut d'une surface orange ou encre (à poser dans un parent `position: relative`). */
export function Reflet({ rayon = 0, inset = 2, opacite = 0.22 }: { rayon?: number; inset?: number; opacite?: number }) {
  return <div style={{ position: "absolute", left: inset + rayon * 0.4, right: inset + rayon * 0.4, top: inset, height: 2, borderRadius: 2, background: ivoireA(opacite), pointerEvents: "none" }} />;
}

/** Reflet en ombre intérieure (suit l'arrondi d'un disque ou d'une pilule) : ivoire 22 %, 2 px, en haut. */
export const refletInset = (W: number, opacite = 0.22) => `inset 0 ${Math.max(2, Math.round(0.002 * W))}px 0 ${ivoireA(opacite)}`;

/** Grain fixe (feTurbulence, encre, 3-4 % ; 6 % pour une zone « avant »). Couvre son parent (`position: relative`). */
export function Grain({ id, opacite = 0.035, frequence = 0.85, style }: { id: string; opacite?: number; frequence?: number; style?: CSSProperties }) {
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: opacite, ...style }}>
      <filter id={id} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency={frequence} numOctaves={2} seed={7} stitchTiles="stitch" />
        {/* Bruit → encre pure, alpha = luminance du bruit contrastée. */}
        <feColorMatrix type="matrix" values="0 0 0 0 0.067  0 0 0 0 0.039  0 0 0 0 0.02  0 0 0 2.2 -0.9" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}

/* ------------------------------------------------------------------ Mouvement ------------------------------------------------------------------ */

const BORNE = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** « pose » : ressort amorti, ≈ 6 % de dépassement (back 1,3), 0,18-0,25 s. */
export const pose = (t: number, a: number, duree = 0.22) => interpolate(t, [a, a + duree], [0, 1], { ...BORNE, easing: Easing.out(Easing.back(1.3)) });
/** « claque » : ≈ 11 % de dépassement (back 1,8) en 0,1 s, pour un mot ou un héros fort. */
export const claque = (t: number, a: number, duree = 0.1) => interpolate(t, [a, a + duree], [0, 1], { ...BORNE, easing: Easing.out(Easing.back(1.8)) });
/** « glisse » : départ rapide, arrivée très douce (expo out), 0,15-0,22 s. */
export const glisse = (t: number, a: number, duree = 0.18) => interpolate(t, [a, a + duree], [0, 1], { ...BORNE, easing: Easing.out(Easing.exp) });
/** Progression linéaire bornée. */
export const lin = (t: number, a: number, duree: number) => interpolate(t, [a, a + duree], [0, 1], BORNE);

/** « sortie » : anticipation de 3 % en sens inverse (0,04 s) puis départ cubic in (0,12 s). Rend -0,03 → 1. */
export function sortieAnticipee(t: number, a: number): number {
  if (t <= a) return 0;
  if (t < a + 0.04) return -0.03 * Math.sin(((t - a) / 0.04) * (Math.PI / 2));
  return -0.03 + 1.03 * interpolate(t, [a + 0.04, a + 0.16], [0, 1], { ...BORNE, easing: Easing.in(Easing.cubic) });
}

/**
 * ÉCLAT d'arrivée (N2) : une surface pleine (orange, ou encre-douce pour un élément « avant / subi ») pendant 0,16 s
 * (4 images à 25 i/s), sans fondu, derrière l'élément qui arrive. C'est l'exception « flash ≤ 0,16 s » du standard : elle
 * garantit que l'arrivée change ≥ 5 % de l'image (écart > 40 niveaux de gris : orange 105, encre-douce 59, ivoire 222).
 */
export const ECLAT = 0.16;
export const enEclat = (t: number, a: number, duree = ECLAT) => t >= a && t < a + duree;

/** Opacité d'entrée : 0 → 1 sur les 2 premières images (0,08 s). */
export const fondu = (t: number, a: number) => lin(t, a, 0.08);

/** Entrée par translation (px) : `{ o, d }` = opacité et décalage restant (multiplier par la distance voulue). */
export function entree(t: number, a: number, duree = 0.2): { o: number; d: number; visible: boolean } {
  const p = pose(t, a, duree);
  return { o: fondu(t, a), d: 1 - p, visible: t >= a };
}

/** Bosse 0 → 1 → 0 sur `duree`. */
export const bosse = (t: number, a: number, duree: number) => Math.sin(Math.PI * lin(t, a, duree));

/**
 * Suivi du conteneur : il s'écrase de `amp` (1,5-2,5 %) pendant 0,1 s à chaque instant de `poses` (arrivée d'un héros).
 * Rend le facteur vertical (≤ 1) ; l'horizontal est 1 + amp / 2 × bosse (volume conservé, à peu près).
 */
export function suivi(t: number, poses: number[], amp = 0.02, duree = 0.1): { sx: number; sy: number } {
  let b = 0;
  for (const x of poses) b = Math.max(b, bosse(t, x, duree));
  return { sx: 1 + (amp / 2) * b, sy: 1 - amp * b };
}

/** Tremblement de 1 px (N3 « corvée »), déterministe. */
export const tremble = (t: number, graine: number, amp = 1) => ({ x: amp * Math.sin(t * 61 + graine * 2.1), y: amp * Math.cos(t * 47 + graine * 1.3) });

/** Respiration de 1 à 2 % (N3). */
export const respire = (t: number, graine = 0, amp = 0.015, hz = 0.9) => 1 + amp * Math.sin(2 * Math.PI * hz * t + graine);

/* ------------------------------------------------------------------ Chiffre roulant (tambour tabulaire) ------------------------------------------------------------------ */

/**
 * Nombre qui ROULE d'une valeur à l'autre (chaque chiffre glisse verticalement, chiffres tabulaires). `etapes` : liste
 * [instant, valeur] croissante ; avant le premier instant, `initial`. Le roulement dure `duree`.
 */
export function ChiffreRoulant({ t, etapes, initial = 0, taille, couleur, police = POLICES.titre, duree = 0.22 }: { t: number; etapes: [number, number][]; initial?: number; taille: number; couleur: string; police?: string; duree?: number }) {
  let avant = initial;
  let apres = initial;
  let a = -1;
  for (const [x, v] of etapes) {
    if (t >= x) {
      avant = apres;
      apres = v;
      a = x;
    }
  }
  const p = a < 0 ? 1 : glisse(t, a, duree);
  const s1 = String(Math.round(avant));
  const s2 = String(Math.round(apres));
  const n = Math.max(s1.length, s2.length);
  const c1 = s1.padStart(n, " ");
  const c2 = s2.padStart(n, " ");
  const h = taille * 1.0;
  return (
    <span style={{ display: "inline-flex", height: h, overflow: "hidden", fontFamily: police, fontSize: taille, lineHeight: `${h}px`, color: couleur, ...TABULAIRE }}>
      {Array.from({ length: n }, (_, i) => {
        const change = c1[i] !== c2[i] && p < 1;
        if (!change) return <span key={i} style={{ display: "inline-block", minWidth: c2[i] === " " ? 0 : undefined }}>{c2[i] === " " ? "" : c2[i]}</span>;
        // Montée : l'ancien chiffre sort par le haut, le nouveau arrive d'en bas (étirement de vitesse léger).
        const etire = 1 + 0.05 * bosse(t, a, duree);
        return (
          <span key={i} style={{ display: "inline-block", position: "relative", height: h, transform: `scaleY(${etire})` }}>
            <span style={{ display: "block", transform: `translateY(${-p * h}px)` }}>{c1[i] === " " ? " " : c1[i]}</span>
            <span style={{ display: "block", transform: `translateY(${-p * h}px)` }}>{c2[i]}</span>
          </span>
        );
      })}
    </span>
  );
}

/* ------------------------------------------------------------------ Tampon « EXEMPLE » ------------------------------------------------------------------ */

/**
 * Tampon « EXEMPLE » du standard : petit, ENCRE, incliné de −6°, posé dans un coin, sans rien masquer. Coup de tampon :
 * arrive à 118 % et se pose (claque, 0,1 s). Texte à 0,024 L (26 px), jamais moins.
 */
export function Tampon4({ t, a, W, style }: { t: number; a: number; W: number; style?: CSSProperties }) {
  if (t < a) return null;
  const e = claque(t, a, 0.12);
  const taille = Math.max(26, MIN_TEXTE_L * W);
  return (
    <div
      style={{
        position: "absolute",
        border: `${Math.max(2, Math.round(0.0028 * W))}px solid ${N4.encre}`,
        borderRadius: taille * 0.22,
        color: N4.encre,
        fontFamily: POLICES.titre,
        fontSize: taille,
        lineHeight: 1,
        letterSpacing: "0.1em",
        padding: `${taille * 0.2}px ${taille * 0.32}px ${taille * 0.16}px ${taille * 0.42}px`,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        opacity: fondu(t, a) * 0.92,
        transform: `rotate(-6deg) scale(${1.18 - 0.18 * e})`,
        ...style,
      }}
    >
      Exemple
    </div>
  );
}

/* ------------------------------------------------------------------ Divers ------------------------------------------------------------------ */

/** Pseudo-aléa déterministe dans [0, 1[. */
export const alea = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Instant de mot le plus récent ≤ t dans une liste (ou -1). */
export const dernierInstant = (t: number, instants: number[]) => instants.reduce((m, x) => (x <= t && x > m ? x : m), -1);
