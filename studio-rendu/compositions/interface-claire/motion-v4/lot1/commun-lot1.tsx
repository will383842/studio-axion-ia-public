import React, { useEffect, useState } from "react";
/**
 * BRIQUES COMMUNES du lot 1 « Au-dessus de la tête » (standard DA v4 du 16/10/2026, § A à D).
 * Version LOCALE : jetons, ressorts nommés, Plaque / SurEtiquette / Puce, SousTitresV4, BarreProgression, fond de prise.
 * Elle sera harmonisée avec celles des autres lots à l'intégration. Aucun flou, aucun dégradé, aucune ombre douce :
 * aplats, contour encre, ombre dure bas-droite.
 *
 * Convention : tout se pilote en IMAGES à 30 i/s. Chaque élément vit dans une `<Sequence>` : `useCurrentFrame()` y vaut `i`,
 * l'image écoulée depuis le mot déclencheur (i0 = 0).
 */
import { AbsoluteFill, Audio, continueRender, delayRender, Easing, interpolate, OffthreadVideo, Sequence, spring, useCurrentFrame } from "remotion";
import { GAIN_BRUITAGES, mediaV4 } from "../communs/medias-v4";
import { placerDansZoneSure } from "../communs/zone-sure-v4";
import type { CSSProperties, ReactNode } from "react";

export const W = 1080;
export const H = 1920;
export const FPS = 30;

/* ------------------------------------------------------------------ Jetons (§ B.1, recopiés à l'identique) ------------------------------------------------------------------ */

import { COULEURS, accents, TRAIT, OMBRE, RAYON, DESCENTE } from "../communs/briques-v4";
import type { Palette } from "../communs/briques-v4";
export { COULEURS, accents, TRAIT, OMBRE, RAYON, DESCENTE };
export type { Palette };

const { ENCRE, IVOIRE, BLANC, GRIS } = COULEURS;
export const ombre = (t: "S" | "M" | "L"): string => `${OMBRE[t][0]}px ${OMBRE[t][1]}px 0 0 ${ENCRE}`;

/** Zone interdite Z (visage + cheveux + marge) en pixels pour une descente `d` (fraction de H). */
export const zoneVisage = (d: number) => ({ x0: 0.25 * W, x1: 0.75 * W, y0: (0.12 + d) * H, y1: (0.58 + d) * H });
/** Bande des yeux (interdite aux sous-titres). */
export const bandeYeux = (d: number) => ({ y0: (0.27 + d) * H, y1: (0.36 + d) * H });
/** Bas de la zone « au-dessus de la tête » (M1) en pixels : y 0,185 H. */
export const BAS_M1 = 0.18 * H;

/* ------------------------------------------------------------------ Polices ------------------------------------------------------------------ */

export const MONTSERRAT = "Axion Montserrat Black";
export const INTER = "Axion Inter Bold";
let chargement: Promise<unknown> | null = null;
function chargerPolices(): Promise<unknown> {
  if (!chargement) {
    const faces = [
      new FontFace(MONTSERRAT, `url(${mediaV4("polices/Montserrat-Black.ttf")})`, { weight: "900" }),
      new FontFace(INTER, `url(${mediaV4("polices/Inter-Bold.ttf")})`, { weight: "700" }),
    ];
    chargement = Promise.all(faces.map((f) => f.load().then((l) => { document.fonts.add(l); })));
  }
  return chargement;
}
/** Retient le rendu tant que les polices ne sont pas chargées. */
export function Polices({ children }: { children: ReactNode }) {
  const [poignee] = useState(() => delayRender("polices lot 1"));
  useEffect(() => {
    chargerPolices().then(() => continueRender(poignee), () => continueRender(poignee));
  }, [poignee]);
  return <>{children}</>;
}

/** Largeur approximative d'un texte en capitales Montserrat Black (sert à ajuster le corps, pas à dessiner). */
export const largeurTexte = (texte: string, corps: number, interlettrage = 0.01): number => texte.length * corps * (0.78 + interlettrage);

/** Plus grand corps (≤ `max`, ≥ `min`) pour que le plus long des textes tienne dans `largeur` px. */
export function corpsPour(textes: string[], largeur: number, max: number, min = 40): number {
  const plus = Math.max(...textes.map((t) => t.length), 1);
  return Math.max(min, Math.min(max, Math.floor(largeur / (plus * 0.79))));
}

/* ------------------------------------------------------------------ Ressorts et courbes (§ D.1) ------------------------------------------------------------------ */

export const RESSORTS = {
  POP: { damping: 14, stiffness: 300, mass: 0.6 },
  CHUTE: { damping: 18, stiffness: 320, mass: 0.8 },
  CLAQUE: { damping: 20, stiffness: 500, mass: 0.5 },
  DESCENTE: { damping: 20, stiffness: 300, mass: 0.7 },
  GLISSE: { damping: 28, stiffness: 400, mass: 0.6 },
} as const;
export type NomRessort = keyof typeof RESSORTS;

/** Ressort 0 → 1 (avec son dépassement), `i` images après son départ ; 0 avant. */
export function ressort(nom: NomRessort, i: number): number {
  if (i <= 0) return 0;
  return spring({ frame: i, fps: FPS, config: RESSORTS[nom] });
}
/** Progression 0 → 1 en `n` images à partir de `i0`. */
export function courbe(i: number, i0: number, n: number, easing: (x: number) => number = (x) => x): number {
  return interpolate(i, [i0, i0 + n], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
}
export const lerp = (a: number, b: number, p: number): number => a + (b - a) * p;
/** Mélange de deux couleurs #rrggbb (interpolation directe, jamais de fondu de surface). */
export function melange(a: string, b: string, p: number): string {
  const x = (c: string) => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16));
  const [ar, ag, ab] = x(a); const [br, bg, bb] = x(b);
  const h = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${h(lerp(ar, br, p))}${h(lerp(ag, bg, p))}${h(lerp(ab, bb, p))}`;
}
/** Secousse amortie de l'ÉLÉMENT : A · e^(−k/3) · sin(2πk/3), `k` images après l'arrêt. */
export function secousse(k: number, amplitude: number): number {
  if (k < 0 || k > 10) return 0;
  return amplitude * Math.exp(-k / 3) * Math.sin((2 * Math.PI * k) / 3);
}

/* ------------------------------------------------------------------ Entrées et sorties (§ D.2) ------------------------------------------------------------------ */

export type EtatAnim = { visible: boolean; scale: number; scaleX: number; rotate: number; x: number; y: number; opacity: number };
const NEUTRE: EtatAnim = { visible: true, scale: 1, scaleX: 1, rotate: 0, x: 0, y: 0, opacity: 1 };
export const sortieRetrecit = Easing.in(Easing.back(1.6));

/** Sortie S-RETRECIT : échelle 1 → 0 en `n` images (2-3), ressort inverse ; l'objet disparaît entièrement après. */
export function facteurSortie(i: number, debut: number | undefined, n = 3): number {
  if (debut === undefined) return 1;
  return Math.max(0, 1 - courbe(i, debut, n, sortieRetrecit));
}

/** E-POP : pop sur place, échelle 0,3 → 1, rotation (inclinaison - 6°) → inclinaison, opacité en 2 i. */
export function entreePop(i: number, opts: { incl?: number; nom?: NomRessort; sortie?: number; nSortie?: number; depart?: number } = {}): EtatAnim {
  const { incl = 0, nom = "POP", sortie, nSortie = 3, depart = 0.3 } = opts;
  const s = ressort(nom, i);
  const f = facteurSortie(i, sortie, nSortie);
  const fini = sortie !== undefined && i >= sortie + nSortie;
  return { ...NEUTRE, visible: i >= 0 && !fini && f > 0.002, scale: lerp(depart, 1, s) * f, rotate: incl + (-6) * (1 - Math.min(1, s)), opacity: Math.min(1, Math.max(0, i + 1) / 2) };
}
/** E-ETIRE : scaleX 0 → 1 depuis le bord gauche (GLISSE). */
export function entreeEtire(i: number, opts: { sortie?: number; nSortie?: number } = {}): EtatAnim {
  const { sortie, nSortie = 3 } = opts;
  const s = Math.min(1.0, ressort("GLISSE", i));
  const f = facteurSortie(i, sortie, nSortie);
  const fini = sortie !== undefined && i >= sortie + nSortie;
  return { ...NEUTRE, visible: i >= 0 && !fini && f > 0.002, scaleX: lerp(0.35, 1, s) * f, scale: f, opacity: Math.min(1, (i + 1) / 2) };
}
/** E-COTE : arrivée latérale (`cote` -1 : depuis la gauche, +1 : depuis la droite), rotation ±6° → ±2°. */
export function entreeCote(i: number, cote: -1 | 1, opts: { sortie?: number; nSortie?: number; inclFinale?: number } = {}): EtatAnim {
  const { sortie, nSortie = 3, inclFinale = 2 } = opts;
  const s = ressort("GLISSE", i);
  const f = facteurSortie(i, sortie, nSortie);
  const fini = sortie !== undefined && i >= sortie + nSortie;
  return { ...NEUTRE, visible: i >= 0 && !fini && f > 0.002, x: cote * 0.6 * W * (1 - s), rotate: lerp(cote * 6, cote * inclFinale, Math.min(1, s)), scale: f };
}

/** Applique un `EtatAnim` à une boîte (origine paramétrable). */
export function Anim({ etat, origine = "center center", style, children }: { etat: EtatAnim; origine?: string; style?: CSSProperties; children?: ReactNode }) {
  if (!etat.visible) return null;
  return (
    <div style={{ ...style, transformOrigin: origine, opacity: etat.opacity, transform: `${style?.transform ?? ""} translate(${etat.x}px, ${etat.y}px) rotate(${etat.rotate}deg) scale(${etat.scale * etat.scaleX}, ${etat.scale})` }}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ Gestes de vie (aucun objet figé plus de 0,75 s) ------------------------------------------------------------------ */

/** Écart maximal entre deux événements d'un même objet (images) : 12 i = 0,4 s, bien sous les 0,75 s du standard. */
export const PAS_VIE = 12;
/** Ajoute des gestes de vie (pulsations) là où l'écart entre deux événements dépasse `PAS_VIE`. Renvoie les seuls gestes ajoutés. */
export function gestesVie(evts: number[], pas = PAS_VIE): number[] {
  const e = [...evts].sort((a, b) => a - b);
  const ajoutes: number[] = [];
  for (let k = 1; k < e.length; k++) {
    const trou = e[k] - e[k - 1];
    if (trou <= pas) continue;
    const n = Math.ceil(trou / pas) - 1;
    for (let m = 1; m <= n; m++) ajoutes.push(Math.round(e[k - 1] + (trou * m) / (n + 1)));
  }
  return ajoutes;
}
/** Enveloppe d'un objet : à chaque geste de vie, pulsation CLAQUE 1 → 1,06 → 1 (échelle autour du pied de l'objet au-dessus de la tête). */
export function Vie({ gestes, children }: { gestes: number[]; children: ReactNode }) {
  const i = useCurrentFrame();
  let s = 1;
  for (const g of gestes) {
    const k = i - g;
    if (k >= 0 && k < 12) s += 0.06 * Math.sin(Math.min(1, k / 8) * Math.PI) * Math.exp(-k / 14);
  }
  return <AbsoluteFill style={{ transform: `scale(${s.toFixed(4)})`, transformOrigin: `50% ${(BAS_M1 / H) * 100}%` }}>{children}</AbsoluteFill>;
}

/* ------------------------------------------------------------------ Bruitages ------------------------------------------------------------------ */

/** Bruitage du dossier `sons/` (CC0 Kenney ou fabriqué), `t` en images locales ; crête ≈ -12 dBFS à 0,25. */
export function Son({ t, fichier, volume = 0.25 }: { t: number; fichier: string; volume?: number }) {
  return (
    <Sequence from={Math.max(0, Math.round(t))} layout="none">
      <Audio src={mediaV4(`sons/${fichier}.wav`)} volume={volume * GAIN_BRUITAGES} />
    </Sequence>
  );
}

/* ------------------------------------------------------------------ Matière : Plaque, SurEtiquette, Puce ------------------------------------------------------------------ */

const styleCapitales = (corps: number, interl = 0.01): CSSProperties => ({ fontFamily: `${MONTSERRAT}, sans-serif`, fontWeight: 900, fontSize: corps, lineHeight: 1, letterSpacing: `${interl}em`, textTransform: "uppercase", whiteSpace: "nowrap" });
/** Hauteur extérieure d'une plaque à une ligne (padding 0,16 em × 2 + contour 2 × 5). */
export const hauteurPlaque = (corps: number, padV = 0.16): number => Math.round(corps * (1 + 2 * padV) + 2 * TRAIT.MOYEN);
/** Liseré extérieur IVOIRE_CLAIR de 3 px des surfaces ENCRE (lisibles sur fond noir) ; l'ombre dure ENCRE passe derrière. */
export const ombreEncre = (t: "S" | "M" | "L" = "S"): string => `0 0 0 3px ${COULEURS.IVOIRE_CLAIR}, ${OMBRE[t][0] + 3}px ${OMBRE[t][1] + 3}px 0 0 ${ENCRE}`;

export function Plaque({ fond, texte = ENCRE, corps = 66, children, style, ombreT = "S", interl = 0.01, largeur, padV = 0.16, padH = 0.3, lisere }: {
  fond: string; texte?: string; corps?: number; children?: ReactNode; style?: CSSProperties; ombreT?: "S" | "M" | "L"; interl?: number; largeur?: number; padV?: number; padH?: number; lisere?: boolean;
}) {
  const avecLisere = lisere ?? fond === ENCRE;
  return (
    <div style={{ ...styleCapitales(corps, interl), boxSizing: "border-box", display: "inline-flex", alignItems: "center", justifyContent: "center", background: fond, color: texte, border: `${TRAIT.MOYEN}px solid ${ENCRE}`, borderRadius: RAYON.PLAQUE, padding: `${(padV * corps).toFixed(1)}px ${(padH * corps).toFixed(1)}px`, boxShadow: avecLisere ? ombreEncre(ombreT) : ombre(ombreT), width: largeur, ...style }}>
      {children}
    </div>
  );
}

/** Petit titre posé à cheval sur le bord haut-gauche de l'étiquette principale (débord 55 % de sa hauteur, décalage x +0,04 L). */
export function SurEtiquette({ texte, corps = 38, style }: { texte: string; corps?: number; style?: CSSProperties }) {
  const h = hauteurPlaque(corps);
  return (
    <div style={{ position: "absolute", left: 0.04 * W, top: -0.55 * h, transform: "rotate(-1.5deg)", transformOrigin: "left bottom", ...style }}>
      <Plaque fond={ENCRE} texte={BLANC} corps={corps} interl={0.03}>{texte}</Plaque>
    </div>
  );
}

/** Pilule ronde, contour 5, ombre S (corps 34-40), icône optionnelle à gauche. */
export function Puce({ fond, texte = ENCRE, corps = 36, icone, children, style }: { fond: string; texte?: string; corps?: number; icone?: ReactNode; children?: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ ...styleCapitales(corps, 0.02), boxSizing: "border-box", display: "inline-flex", alignItems: "center", gap: 0.3 * corps, background: fond, color: texte, border: `${TRAIT.MOYEN}px solid ${ENCRE}`, borderRadius: RAYON.PILULE, padding: `${0.2 * corps}px ${0.5 * corps}px`, boxShadow: ombre("S"), ...style }}>
      {icone}{children}
    </div>
  );
}

/** Texte libre posé sur la prise : contour de texte encre 0,14 em, ombre dure (état « dit » des sous-titres). */
export function TexteContour({ children, corps, couleur = BLANC, style }: { children: ReactNode; corps: number; couleur?: string; style?: CSSProperties }) {
  return (
    <span style={{ ...styleCapitales(corps), color: couleur, WebkitTextStroke: `${(0.14 * corps).toFixed(1)}px ${ENCRE}`, paintOrder: "stroke fill", filter: `drop-shadow(4px 5px 0 ${ENCRE})`, ...style }}>{children}</span>
  );
}

/** Tuile carrée (logo, chiffre, picto) : contour 5, ombre S, rayon 14. */
export function Tuile({ taille, fond = BLANC, children, style }: { taille: number; fond?: string; children?: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ boxSizing: "border-box", width: taille, height: taille, display: "flex", alignItems: "center", justifyContent: "center", background: fond, border: `${TRAIT.MOYEN}px solid ${ENCRE}`, borderRadius: RAYON.TUILE, boxShadow: ombre("S"), ...style }}>{children}</div>
  );
}

/** Rouleau (§ D.3, « changement de titre sans sortie ») : l'ancien texte monte et sort en 3 i, le nouveau entre par le bas en 4 i. */
export function Rouleau({ ancien, nouveau, i, a }: { ancien: ReactNode; nouveau: ReactNode; i: number; a: number }) {
  const sortant = courbe(i, a, 3, Easing.in(Easing.cubic));
  const entrant = courbe(i, a, 4, Easing.out(Easing.cubic));
  return (
    <span style={{ display: "inline-grid", overflow: "hidden", justifyItems: "center", alignItems: "center" }}>
      <span style={{ gridArea: "1 / 1", transform: `translateY(${-100 * sortant}%)`, visibility: sortant >= 1 ? "hidden" : "visible" }}>{ancien}</span>
      <span style={{ gridArea: "1 / 1", transform: `translateY(${100 * (1 - entrant)}%)`, visibility: i < a ? "hidden" : "visible" }}>{nouveau}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ Pictogrammes (aucun faux visage, aucun logo de marque) ------------------------------------------------------------------ */

export type NomPicto = "courriel" | "bulle" | "telephone" | "agenda" | "etoile" | "plume" | "personne" | "reseau" | "eclair" | "euro";
/** Pictogrammes SVG maison : trait ENCRE, remplissage `fond`. Taille ≥ 44 px dans le standard. */
export function Picto({ nom, taille = 56, fond = BLANC, trait = ENCRE }: { nom: NomPicto; taille?: number; fond?: string; trait?: string }) {
  const p = { fill: fond, stroke: trait, strokeWidth: 4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  const corps = (() => {
    switch (nom) {
      case "courriel": return <><rect x="6" y="14" width="52" height="36" rx="6" {...p} /><path d="M8 18 L32 36 L56 18" fill="none" stroke={trait} strokeWidth={4} strokeLinejoin="round" /></>;
      case "bulle": return <path d="M8 12 H56 V44 H30 L16 56 V44 H8 Z" {...p} />;
      case "telephone": return <><rect x="18" y="4" width="28" height="56" rx="7" {...p} /><circle cx="32" cy="50" r="3" fill={trait} /></>;
      case "agenda": return <><rect x="6" y="12" width="52" height="46" rx="6" {...p} /><path d="M6 26 H58" stroke={trait} strokeWidth={4} /><path d="M20 6 V18 M44 6 V18" stroke={trait} strokeWidth={5} strokeLinecap="round" /></>;
      case "etoile": return <path d="M32 4 L40 24 L60 26 L44 40 L50 60 L32 48 L14 60 L20 40 L4 26 L24 24 Z" {...p} />;
      case "plume": return <><path d="M14 52 L10 58 L18 56 L54 14 L46 8 Z" {...p} /><path d="M40 22 L48 30" stroke={trait} strokeWidth={4} /></>;
      case "personne": return <><circle cx="32" cy="20" r="12" {...p} /><path d="M8 58 C8 42 20 36 32 36 C44 36 56 42 56 58 Z" {...p} /></>;
      case "reseau": return <><path d="M32 32 L12 14 M32 32 L52 14 M32 32 L12 50 M32 32 L52 50" stroke={trait} strokeWidth={4} /><circle cx="32" cy="32" r="10" {...p} /><circle cx="12" cy="14" r="6" {...p} /><circle cx="52" cy="14" r="6" {...p} /><circle cx="12" cy="50" r="6" {...p} /><circle cx="52" cy="50" r="6" {...p} /></>;
      case "eclair": return <path d="M36 4 L12 36 H30 L26 60 L52 26 H34 Z" {...p} />;
      case "euro": return <><circle cx="32" cy="32" r="26" {...p} /><path d="M42 22 C32 14 22 20 22 32 C22 44 32 50 42 42 M16 28 H34 M16 36 H34" fill="none" stroke={trait} strokeWidth={4} strokeLinecap="round" /></>;
    }
  })();
  return <svg width={taille} height={taille} viewBox="0 0 64 64">{corps}</svg>;
}

/** Symbole Claude (étoile à 12 rayons inégaux, terre cuite #D97757), tracé en SVG maison ; à remplacer par le fichier de marque officiel si Will le fournit. */
export function LogoClaude({ taille = 126 }: { taille?: number }) {
  const longueurs = [30, 22, 29, 20, 30, 23, 29, 21, 30, 22, 28, 20];
  return (
    <svg width={taille} height={taille} viewBox="-32 -32 64 64">
      {longueurs.map((l, k) => <line key={k} x1="0" y1="0" x2={(l * Math.cos((k * Math.PI) / 6)).toFixed(2)} y2={(l * Math.sin((k * Math.PI) / 6)).toFixed(2)} stroke="#D97757" strokeWidth="6.5" strokeLinecap="round" />)}
      <circle cx="0" cy="0" r="7" fill="#D97757" />
    </svg>
  );
}

/* ------------------------------------------------------------------ Prise, descente, barre ------------------------------------------------------------------ */

export type CleDescente = { i: number; d: number; type?: "descend" | "remonte" };
/** Valeur de la descente `d` (fraction de H) à l'image `frame` : ressort DESCENTE en descendant, back(1,3) en 4 i en remontant. */
export function descenteA(frame: number, cles: CleDescente[]): number {
  let valeur: (f: number) => number = () => 0;
  for (const c of [...cles].sort((a, b) => a.i - b.i)) {
    const avant = valeur;
    const depart = avant(c.i);
    valeur = (f) => {
      if (f < c.i) return avant(f);
      const p = c.type === "remonte" ? courbe(f, c.i, 4, Easing.out(Easing.back(1.3))) : ressort("DESCENTE", f - c.i);
      return lerp(depart, c.d, p);
    };
  }
  return valeur(frame);
}

/** Prise de Will en fond (vidéo avec sa voix), translatée de `d × H` — la SEULE transformation permise ; bande ivoire révélée en haut. */
export type FondTest = "prise" | "blanc" | "noir" | string;
export function FondPrise({ d, source, debutVideo = 0, fondTest = "prise" }: { d: number; source: string; debutVideo?: number; fondTest?: FondTest }) {
  if (fondTest === "blanc" || fondTest === "noir") return <AbsoluteFill style={{ background: fondTest === "blanc" ? BLANC : "#111111" }} />;
  if (fondTest !== "prise") return <AbsoluteFill style={{ background: "#111111" }}><OffthreadVideo src={mediaV4(fondTest)} muted style={{ width: W, height: H, objectFit: "cover" }} /></AbsoluteFill>;
  return (
    <AbsoluteFill style={{ background: IVOIRE }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `translateY(${(d * H).toFixed(2)}px)` }}>
        <OffthreadVideo src={source} startFrom={debutVideo} style={{ width: W, height: H, objectFit: "cover" }} />
      </div>
    </AbsoluteFill>
  );
}

/** Barre de progression du haut : y 0 → 10 px, fond ENCRE, rempli ACCENT_1, trait BLANC de 4 px au bout du rempli. */
export function BarreProgression({ palette, total }: { palette: Palette; total: number }) {
  const frame = useCurrentFrame();
  const x = Math.min(1, (frame + 1) / total) * W;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 10, background: ENCRE }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: x, height: 10, background: accents(palette).ACCENT_1 }} />
      <div style={{ position: "absolute", left: Math.max(0, x - 4), top: 0, width: 4, height: 10, background: BLANC }} />
    </div>
  );
}

/* ------------------------------------------------------------------ Sous-titres v4 (§ C) ------------------------------------------------------------------ */

export type Mot = { mot: string; debut: number; fin: number; fort?: boolean; chiffre?: boolean; /** reste seul dans son groupe (MotSaute : il part du centre du sous-titre) */ seul?: boolean; /** le mot est déjà écrit sur une étiquette : pas de plaque (état « en cours » en texte) */ sansPlaque?: boolean; /** image à partir de laquelle le mot est masqué (MotSaute) */ masqueDepuis?: number };
type Groupe = { mots: Mot[]; debut: number; fin: number };

/** 1-2 mots par groupe ; 3 seulement si le 3ᵉ fait ≤ 3 lettres ; un mot de liaison (≤ 3 lettres) n'est jamais seul en fin de phrase. */
export function grouper(mots: Mot[]): Groupe[] {
  const sortie: Groupe[] = [];
  let k = 0;
  while (k < mots.length) {
    const g = [mots[k++]];
    const isole = g[0].seul || mots[k]?.seul;
    if (k < mots.length && !isole) g.push(mots[k++]);
    if (k < mots.length && !isole && !mots[k].seul && mots[k].mot.replace(/[^A-Za-zÀ-ÿ]/g, "").length <= 3 && g.length === 2) g.push(mots[k++]);
    sortie.push({ mots: g, debut: g[0].debut, fin: g[g.length - 1].fin });
  }
  return sortie.map((g, n) => ({ ...g, fin: n + 1 < sortie.length ? sortie[n + 1].debut : g.fin + 0.2 }));
}

/** Centre vertical du groupe (px) selon la descente de la prise (§ C.3 : prise seule ou M1 → 0,66 H + D). */
export const centreSousTitres = (d: number): number => placerDansZoneSure(0.66 + d, d) * H;
/** Centre réel du groupe : jamais dans la bande des yeux [0,27 + D ; 0,36 + D] H (marge 0,015 H), calculé depuis la descente D de l'image courante. */
export const centreSurs = (d: number, hauteurGroupe: number): number => centreSousTitres(d); // la zone sûre place déjà le groupe hors de la bande des yeux (hauteurGroupe n'est plus utilisé)

export function SousTitresV4({ mots, palette, d }: { mots: Mot[]; palette: Palette; d: number }) {
  const frame = useCurrentFrame();
  const { ACCENT_1, ACCENT_2 } = accents(palette);
  const groupes = React.useMemo(() => grouper(mots), [mots]);
  const t = frame / FPS;
  const g = groupes.find((x) => t >= x.debut - 1e-6 && t < x.fin);
  if (!g) return null;
  const indexFort = mots.filter((m) => (m.fort || m.chiffre) && !m.sansPlaque);
  // corps : 84 px, réduit jusqu'à 62 px pour tenir dans 0,88 L
  const largeurDe = (c: number) => g.mots.reduce((s, m) => s + largeurTexte(m.mot, c) + ((m.fort || m.chiffre) ? 0.48 * c : 0) + 0.3 * c, 0);
  let corps = 84;
  while (corps > 62 && largeurDe(corps) > 0.88 * W) corps -= 2;
  const courant = g.mots.reduce((a, m, k) => (t >= m.debut - 1e-6 ? k : a), 0);
  return (
    <div style={{ position: "absolute", left: 0, width: W, top: centreSurs(d, 1.32 * corps + 10), transform: "translateY(-50%)", display: "flex", justifyContent: "center", alignItems: "center", gap: 0.28 * corps }}>
      {g.mots.map((m, k) => {
        const i = frame - Math.round(m.debut * FPS);
        const masque = m.masqueDepuis !== undefined && frame >= m.masqueDepuis;
        if (i < 0 || masque) return <span key={k} style={{ visibility: "hidden", ...styleCapitales(corps) }}>{m.mot}</span>;
        const pop = lerp(0.5, 1, Math.min(1.12, ressort("POP", i)));
        const fort = (m.fort || m.chiffre) && !m.sansPlaque;
        if (fort) {
          const rang = indexFort.indexOf(m);
          const incl = rang % 2 === 0 ? -2 : 1.5;
          const etire = Math.min(1, ressort("GLISSE", i * (7 / 3)));
          const popTexte = lerp(0.5, 1, Math.min(1.12, ressort("POP", i - 1)));
          return (
            <span key={k} style={{ display: "inline-block", transform: `rotate(${incl}deg) scaleX(${etire})`, transformOrigin: "left center" }}>
              <Plaque fond={m.chiffre ? ACCENT_2 : ACCENT_1} corps={corps} style={{ padding: `${0.1 * corps}px ${0.24 * corps}px` }}>
                <span style={{ display: "inline-block", transform: `scale(${popTexte})`, opacity: i >= 1 ? 1 : 0 }}>{m.mot}</span>
              </Plaque>
            </span>
          );
        }
        return (
          <span key={k} style={{ display: "inline-block", transform: `scale(${pop})`, opacity: Math.min(1, i + 1) }}>
            <TexteContour corps={corps} couleur={k === courant ? ACCENT_1 : BLANC}>{m.mot}</TexteContour>
          </span>
        );
      })}
    </div>
  );
}
