import React from "react";
/**
 * BRIQUES COMMUNES v4 (standard DA v4 §B, §C, §D, §L) : SOURCE UNIQUE des jetons de couleur (palette unique, une seule palette),
 * ressorts nommés, `Plaque`, `Pose`, descente/remontée de la prise (`descenteA`), `SousTitresV4` (position recalculée à CHAQUE image
 * depuis la descente réelle), `EtiquetteTete`, `BarreProgression`, bruitages (`Sons`, niveaux normalisés).
 * Reprend la meilleure version de chaque brique parmi les 5 lots (base : lot 5, la plus complète et la seule à calculer yST(f) = 0,66 + D(f)).
 * Aplats francs, contours encre, ombres dures. Tout est une fonction PURE de l'image courante (30 i/s). Jamais de zoom ni de recadrage de la prise.
 */

import { AbsoluteFill, Audio, Easing, interpolate, OffthreadVideo, Sequence, spring } from "remotion";
import { continueRender, delayRender } from "remotion";
import { GAIN_BRUITAGES, mediaV4, rendu4DeProduction } from "./medias-v4";
import { bordGaucheSousTitres, largeurMaxSousTitres, ZONE_SURE_916 } from "./zone-sure-v4";

/**
 * Police : Montserrat Black (900). INTERPRÉTATION : le standard (§ B.5) demande `@remotion/google-fonts` ; le bac à sable de rendu bloque
 * `fonts.gstatic.com` (certificat du mandataire refusé par Chromium). Les mêmes fichiers Google Fonts (variable, latin + latin-ext, SIL OFL)
 * sont donc livrés dans `polices/` et chargés ici en local (`FontFace` + `delayRender`) : même police, aucun réseau au rendu.
 * L'intégration pourra revenir à `@remotion/google-fonts/Montserrat` sans rien changer d'autre (même nom de famille exporté).
 */
export const MONTSERRAT = "Montserrat V4";
export const INTER = MONTSERRAT; // le lot 5 n'utilise pas Inter
let policeChargee: Promise<void> | null = null;
let echecsPolice = 0;
/**
 * Chargée à l'import (studio Remotion, planches : `staticFile`) ET par `VideoAnimeeV4` au rendu de production : à l'import, `mediasBase`
 * n'est pas encore lisible (404 `/public/polices/…`, police de repli, relevé en prod le 18/10). Un échec n'est donc plus mémorisé :
 * le rendu de production recharge avec la bonne adresse.
 */
export function chargerPolice() {
  if (policeChargee || typeof document === "undefined") return;
  const attente = delayRender("Police Montserrat 900 (briques v4)");
  const fichiers: [string, string][] = [
    ["polices/Montserrat-900-latin-ext.woff2", "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF"],
    ["polices/Montserrat-900-latin.woff2", "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"],
  ];
  policeChargee = Promise.all(
    fichiers.map(async ([f, plage]) => {
      const face = new FontFace(MONTSERRAT, `url(${mediaV4(f)})`, { weight: "900", style: "normal", unicodeRange: plage });
      document.fonts.add(await face.load());
    }),
  )
    .then(() => continueRender(attente))
    // Le module est chargé par TOUT le paquet de rendu : une police introuvable (rendu sans `mediasBase`, ex. tableau) ne doit
    // jamais arrêter les autres compositions. La police manque seulement au texte v4 (police de repli).
    .catch((e) => {
      // Alerte seulement pour un rendu v4 de production : les autres rendus (tableau, cas concret…) n'écrivent pas ce texte.
      if (rendu4DeProduction()) console.warn("Police Montserrat 900 (briques v4) introuvable, police de repli :", e);
      // Une seule nouvelle tentative (celle du rendu de production) : jamais un rechargement à chaque image.
      if (echecsPolice++ < 1) policeChargee = null;
      continueRender(attente);
    });
}
chargerPolice();

/* ------------------------------------------------------------------ Jetons (§ B.1, à l'identique) ------------------------------------------------------------------ */

export const COULEURS = {
  ENCRE: "#110A05", IVOIRE: "#E9DCC8", IVOIRE_CLAIR: "#FBF7EF", BLANC: "#FFFFFF",
  GRIS: "#9A948C", ORANGE_MARQUE: "#B44F29",
  ORANGE_VIF: "#F07C3E",
} as const;
/** Palette unique (standard § L) : accent 1 = orange vif ; accent 2 (chiffres, états) = blanc sur contour encre. Le paramètre est conservé (ignoré) pour les appels existants. */
export type Palette = "B";
export const accents = (_p?: Palette) => ({ ACCENT_1: COULEURS.ORANGE_VIF, ACCENT_2: COULEURS.BLANC });
export const TRAIT = { FORT: 7, MOYEN: 5, FIN: 3 };
export const OMBRE = { S: [5, 6], M: [8, 9], L: [11, 12] };
export const RAYON = { PLAQUE: 10, CHAMP: 12, TUILE: 14, CARTE: 18, FENETRE: 22, PILULE: 999 };
export const DESCENTE = { D0: 0, D1: 0.06, D2: 0.26, D3: 0.32 };

export const W = 1080;
export const H = 1920;
export const FPS = 30;
const { ENCRE } = COULEURS;

export const ombreBoite = (t: "S" | "M" | "L") => `${OMBRE[t][0]}px ${OMBRE[t][1]}px 0 0 ${ENCRE}`;
export const ombreTexte = (t: "S" | "M" | "L") => `drop-shadow(${OMBRE[t][0]}px ${OMBRE[t][1]}px 0 ${ENCRE})`;

/* ------------------------------------------------------------------ Ressorts nommés (§ D.1) ------------------------------------------------------------------ */

export const RESSORTS = {
  POP: { damping: 14, stiffness: 300, mass: 0.6 },
  CHUTE: { damping: 18, stiffness: 320, mass: 0.8 },
  CLAQUE: { damping: 20, stiffness: 500, mass: 0.5 },
  DESCENTE: { damping: 20, stiffness: 300, mass: 0.7 },
  GLISSE: { damping: 28, stiffness: 400, mass: 0.6 },
} as const;
export type NomRessort = keyof typeof RESSORTS;

/** Ressort 0 → 1, `k` images après son départ (peut être décimal). Avant : 0. */
export function ressort(nom: NomRessort, k: number): number {
  if (k <= 0) return 0;
  return spring({ frame: k, fps: FPS, config: { ...RESSORTS[nom] } });
}
export const borne = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
/** Progression 0 → 1 de l'image `i0` à `i0 + n`. */
export function courbe(i: number, i0: number, n: number, easing: (x: number) => number = (x) => x): number {
  return interpolate(i, [i0, i0 + n], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
}
export const sortieRapide = Easing.in(Easing.cubic);
export const freinCubique = Easing.out(Easing.cubic);
/** Secousse amortie de l'ÉLÉMENT (jamais de la prise), `k` images après l'impact. */
export function secousse(k: number, amplitude: number): number {
  if (k < 0 || k > 12) return 0;
  return amplitude * Math.exp(-k / 3) * Math.sin((2 * Math.PI * k) / 3);
}
/**
 * GESTE DE VIE (critique v4 §3.4) : pulsation 1 → 1 + `amp` → 1 sur 6 images, toutes les `periode` images (12 au plus : aucun objet figé > 0,4 s).
 * `i` = images depuis l'apparition de l'objet ; `decale` : retard (images) pour que les objets ne pulsent pas tous ensemble.
 */
export function tick(i: number, i0 = 8, decale = 0, amp = 0.05, periode = 12): number {
  const k = i - i0 - decale;
  if (k < 0) return 1;
  const ph = k % periode;
  return ph < 6 ? 1 + amp * Math.sin((Math.PI * ph) / 6) : 1;
}
/** Images (relatives) des gestes de vie `tick` entre `i0` et `fin` : pour la mesure de rythme. */
export const gestesDeVie = (i0: number, fin: number, decale = 0, periode = 12) => {
  const r: number[] = [];
  for (let k = i0 + decale + 3; k < fin; k += periode) r.push(k);
  return r;
};
/** Mélange de deux couleurs #RRGGBB (interpolation directe, sans fondu de transparence). */
export function melange(a: string, b: string, p: number): string {
  const c = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  const m = (i: number) => Math.round(lerp(c(a, i), c(b, i), borne(p)));
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}

/* ------------------------------------------------------------------ Texte ------------------------------------------------------------------ */

let ctxMesure: CanvasRenderingContext2D | null = null;
/** Largeur (px) d'un texte Montserrat 900 de `corps` px. */
export function largeurTexte(texte: string, corps: number, interlettrage = 0.01, poids = 900): number {
  if (typeof document === "undefined") return texte.length * corps * 0.78;
  if (!ctxMesure) ctxMesure = document.createElement("canvas").getContext("2d");
  if (!ctxMesure) return texte.length * corps * 0.78;
  ctxMesure.font = `${poids} ${corps}px ${MONTSERRAT}`;
  return ctxMesure.measureText(texte).width + interlettrage * corps * texte.length;
}
/** Corps (px) qui fait tenir `texte` dans `largeurMax`, borné. */
export function corpsAjuste(texte: string, largeurMax: number, max: number, min = 40, interlettrage = 0.01): number {
  const l1 = largeurTexte(texte, 100, interlettrage);
  return Math.max(min, Math.min(max, (100 * largeurMax) / l1));
}
/** Contour de texte v4 (§ B.2) : `paint-order: stroke fill`, trait de 0,14 em par défaut (≈ 0,07 em visible à l'extérieur). */
export const contourTexte = (corps: number, couleur: string = ENCRE, epaisseurEm = 0.14): React.CSSProperties => ({
  WebkitTextStroke: `${epaisseurEm * corps}px ${couleur}`,
  paintOrder: "stroke fill",
  strokeLinejoin: "round",
} as React.CSSProperties);

export const styleMontserrat = (corps: number, couleur: string, extra?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: MONTSERRAT, fontWeight: 900, fontSize: corps, lineHeight: 1, letterSpacing: "0.01em", color: couleur,
  textTransform: "uppercase", whiteSpace: "nowrap", ...extra,
});

/* ------------------------------------------------------------------ Plaque (§ B.7) ------------------------------------------------------------------ */

export type PropsPlaque = {
  texte: React.ReactNode;
  fond: string;
  couleurTexte?: string;
  corps: number;
  inclinaison?: number;
  echelle?: number;
  echelleX?: number;
  opacite?: number;
  /** Ombre : S par défaut. */
  ombre?: "S" | "M" | "L";
  contour?: number;
  style?: React.CSSProperties;
};
/** Rectangle à rayon 10, contour 5, ombre S, padding 0,16 em × 0,30 em, texte Montserrat 900 capitales. */
export function Plaque({ texte, fond, couleurTexte = ENCRE, corps, inclinaison = 0, echelle = 1, echelleX = 1, opacite = 1, ombre = "S", contour = TRAIT.MOYEN, style }: PropsPlaque) {
  return (
    <div
      style={{
        boxSizing: "border-box", display: "inline-flex", alignItems: "center", justifyContent: "center",
        padding: `${0.16 * corps}px ${0.3 * corps}px`, borderRadius: RAYON.PLAQUE, background: fond,
        border: `${contour}px solid ${ENCRE}`, boxShadow: fond === ENCRE ? `0 0 0 3px ${COULEURS.IVOIRE_CLAIR}, ${ombreBoite(ombre)}` : ombreBoite(ombre), opacity: opacite,
        transform: `rotate(${inclinaison}deg) scale(${echelle * echelleX}, ${echelle})`,
        transformOrigin: "left center", ...styleMontserrat(corps, couleurTexte), ...style,
      }}
    >
      {texte}
    </div>
  );
}

/** Plaque posée par son CENTRE (x, y en px de l'image 1080 × 1920), avec entrée au choix. */
export function Pose({ x, y, children, rotation = 0, echelle = 1, opacite = 1, origine = "center center", decalageX = 0, decalageY = 0, z, ancre = "centre" }: { x: number; y: number; children: React.ReactNode; rotation?: number; echelle?: number; opacite?: number; origine?: string; decalageX?: number; decalageY?: number; z?: number; ancre?: "centre" | "gauche" }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, zIndex: z }}>
      <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(${ancre === "gauche" ? "0%" : "-50%"}, -50%) translate(${decalageX}px, ${decalageY}px) rotate(${rotation}deg) scale(${echelle})`, transformOrigin: origine, opacity: opacite, display: "flex" }}>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ Prise de Will + descente (§ D.4) ------------------------------------------------------------------ */

export type ChangementD = { i: number; D: number };
/** D (fraction de H) à l'image `f` : descente = ressort DESCENTE, remontée = 4 i `Easing.out(Easing.back(1.3))`. */
export function descenteA(f: number, plan: ChangementD[]): number {
  // Chaque clé part de la valeur RÉELLE de la clé précédente à cet instant (une descente qui n'a pas fini ne saute pas à sa cible) : plus de téléportation de la prise.
  let k = -1;
  for (let m = 0; m < plan.length; m++) if (f >= plan[m].i) k = m;
  const valeur = (m: number, t: number): number => {
    if (m < 0) return 0;
    const cible = plan[m].D;
    const avant = m > 0 ? plan[m - 1].D : 0;
    const depart = m > 0 ? valeur(m - 1, plan[m].i) : 0;
    if (t - plan[m].i >= 40) return cible;
    const p = cible >= avant ? ressort("DESCENTE", t - plan[m].i) : courbe(t, plan[m].i, 4, Easing.out(Easing.back(1.3)));
    return lerp(depart, cible, p);
  };
  return valeur(k, f);
}

export const PRISE_VIDEO = "prise-commune-15s.mp4";

/**
 * Fond : la vraie prise de Will (voix comprise) en `OffthreadVideo`, plein cadre, SANS échelle ; descente = `translateY`.
 * La bande révélée en haut est IVOIRE. `depuisSec` : instant de la prise à l'image 0 de la composition.
 * `mode="visage"` : la prise est remplacée par un magenta sur la zone Z (mesure de la couverture du visage).
 */
export type FondTest = "prise" | "blanc" | "noir" | "broll";
export const BROLL_FOND = "broll/lotE-m1.mp4";
export function Prise({ D, depuisSec = 0, mode = "normal", volume = 1, fond = "prise" }: { D: number; depuisSec?: number; mode?: "normal" | "visage"; volume?: number; /** Test des 4 fonds (standard J.5) : la prise est remplacée par un aplat ou un B-roll chargé. Jamais utilisé en production. */ fond?: FondTest }) {
  if (fond !== "prise" && mode === "normal") {
    return (
      <AbsoluteFill style={{ background: fond === "blanc" ? "#FFFFFF" : "#111111" }}>
        {fond === "broll" ? <OffthreadVideo src={mediaV4(BROLL_FOND)} muted style={{ position: "absolute", left: 0, top: 0, width: W, height: H, objectFit: "cover" }} pauseWhenBuffering={false} /> : null}
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ background: COULEURS.IVOIRE }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `translateY(${D * H}px)`, background: mode === "visage" ? "#888" : undefined }}>
        {mode === "visage" ? (
          <div style={{ position: "absolute", left: 0.25 * W, top: 0.12 * H, width: 0.5 * W, height: 0.46 * H, background: "#FF00FF" }} />
        ) : (
          <OffthreadVideo src={mediaV4(PRISE_VIDEO)} startFrom={Math.round(depuisSec * FPS)} volume={volume} style={{ position: "absolute", left: 0, top: 0, width: W, height: H, objectFit: "cover" }} pauseWhenBuffering={false} />
        )}
      </div>
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ Barre de progression (§ B.7) ------------------------------------------------------------------ */

export function BarreProgression({ frame, duree, palette }: { frame: number; duree: number; palette: Palette }) {
  const { ACCENT_1 } = accents(palette);
  const p = borne((frame + 1) / duree);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 10, background: ENCRE, zIndex: 900 }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: p * W, height: 10, background: ACCENT_1 }} />
      <div style={{ position: "absolute", left: Math.max(0, p * W - 4), top: 0, width: 4, height: 10, background: COULEURS.BLANC }} />
    </div>
  );
}

/* ------------------------------------------------------------------ Sous-titres v4 (§ C) ------------------------------------------------------------------ */

export type MotDemo = { mot: string; debut: number; fin: number; fort?: boolean; chiffre?: boolean };
export type GroupeST = { mots: MotDemo[]; debut: number; fin: number };

const LIAISON = new Set(["DE", "DU", "DES", "LA", "LE", "LES", "UN", "UNE", "ET", "À", "EN", "AU", "AUX", "QUE", "QUI", "SUR", "POUR", "PAR", "MON", "MA", "MES", "SES", "VOS", "VOTRE", "CE", "CA", "ÇA", "JE", "IL", "ON", "OU", "SE", "NE", "N'", "L'", "D'", "J'", "C'"]);
/** 1 à 2 mots par groupe, 3 si le 3ᵉ fait ≤ 3 lettres ; un mot de liaison n'est jamais seul (§ C.1). */
export function grouperMots(mots: MotDemo[], finVideo: number): GroupeST[] {
  const groupes: MotDemo[][] = [];
  let i = 0;
  while (i < mots.length) {
    const g = [mots[i]];
    i++;
    if (i < mots.length && LIAISON.has(g[0].mot.replace(/[.,!?]/g, "")) && !g[0].mot.endsWith(".")) {
      g.push(mots[i]);
      i++;
      if (i < mots.length && mots[i].mot.replace(/[^A-ZÀ-Ü0-9]/g, "").length <= 3 && !g[1].mot.endsWith(".") && !g[0].mot.endsWith(".")) {
        g.push(mots[i]);
        i++;
      }
    }
    groupes.push(g);
  }
  return groupes.map((g, k) => ({ mots: g, debut: g[0].debut, fin: k + 1 < groupes.length ? groupes[k + 1][0].debut : Math.min(finVideo, g[g.length - 1].fin + 0.2) }));
}

/** Centre vertical du groupe (fraction de H) selon la mise en page, à l'image `f`. `null` : sous-titres masqués. */
export type PositionST = (frame: number) => number | null;

export function SousTitresV4({ frame, groupes, palette, position, tailleBase = 84, masquer, bande }: { frame: number; groupes: GroupeST[]; palette: Palette; position: PositionST; tailleBase?: number; /** Bande [x min, x max] (fractions de L) imposée à l'image `frame` (ex. à gauche d'une carte), ou null : largeur habituelle. */ bande?: (frame: number) => readonly [number, number] | null; /** Vrai : le groupe est masqué (une étiquette posée affiche déjà ces mots). */ masquer?: (g: GroupeST) => boolean }) {
  const { ACCENT_1, ACCENT_2 } = accents(palette);
  const t = frame / FPS;
  const g = groupes.find((x) => t >= x.debut - 1e-6 && t < x.fin - 1e-6);
  const yc = position(frame);
  if (!g || yc === null || (masquer && masquer(g))) return null;
  const b = bande ? bande(Math.round(g.debut * FPS)) : null; // bande figée au début du groupe : pas de saut aux bornes de la fenêtre
  const maxL = b ? (b[1] - b[0]) * W : largeurMaxSousTitres(W);
  let corps = tailleBase;
  const largeurPlaques = (c: number) => g.mots.reduce((s, m) => s + largeurTexte(m.mot, c) + (m.fort || m.chiffre ? 0.48 * c + 2 * TRAIT.MOYEN : 0), 0) + 0.32 * c * (g.mots.length - 1);
  while (corps > 48 && largeurPlaques(corps) > maxL) corps -= 2; // plancher 48 : un groupe long réduit plutôt que de mordre la zone des boutons (0,82 L)
  // Encore trop large à 48 (2 mots très longs) : un mot par ligne, jamais de coupure au milieu d'un mot ; chaque ligne est réduite pour tenir dans la largeur max.
  const empile = largeurPlaques(corps) > maxL && g.mots.length > 1;
  const largeurMot = (m: GroupeST["mots"][number], c: number) => largeurTexte(m.mot, c) + (m.fort || m.chiffre ? 0.48 * c + 2 * TRAIT.MOYEN : 0);
  // Mot seul trop large pour la bande (même à 48) : il descend aussi jusqu'à 30 px plutôt que de mordre la carte.
  if (empile || (b && g.mots.length === 1 && largeurPlaques(corps) > maxL)) { corps = tailleBase; while (corps > 30 && g.mots.some((m) => largeurMot(m, corps) > maxL)) corps -= 2; }
  const pas = 1.3 * corps; // pas entre deux lignes empilées
  const demiBloc = empile ? ((g.mots.length - 1) * pas) / 2 + 0.62 * corps : 0;
  const largeur = largeurPlaques(corps);
  const bord = (largeur: number) => (b ? Math.max(b[0] * W, b[0] * W + (maxL - largeur) / 2) : bordGaucheSousTitres(largeur, W));
  let x = bord(largeur); // centré si ça tient entre 0,18 et 0,82 L, sinon décalé à gauche (zone sûre des réseaux)
  const elems = g.mots.map((m, k) => {
    const lm = largeurTexte(m.mot, corps);
    const plaque = m.fort || m.chiffre;
    const wBloc = lm + (plaque ? 0.48 * corps + 2 * TRAIT.MOYEN : 0);
    const x0 = empile ? bord(wBloc) : x;
    const dy = empile ? (k - (g.mots.length - 1) / 2) * pas : 0;
    x += wBloc + 0.32 * corps;
    const kk = frame - Math.round(m.debut * FPS);
    if (kk < 0) return null;
    const enCours = t >= m.debut - 1e-6 && t < m.fin - 1e-6;
    const pop = 0.5 + 0.5 * ressort("POP", kk * 1.5);
    const op = 1; // jamais de plaque vide : plaque (≥ 0,6) et texte apparaissent dans la même image
    const incl = k % 2 === 0 ? -2 : 1.5;
    const fondPlaque = m.chiffre ? ACCENT_2 : ACCENT_1;
    return (
      <div key={k} style={{ position: "absolute", left: x0, top: dy - corps * (plaque ? 0.62 : 0.5), width: wBloc, height: corps * (plaque ? 1.24 : 1), display: "flex", alignItems: "center", justifyContent: "center", transform: `rotate(${plaque ? incl : 0}deg) scale(${pop})`, opacity: op, transformOrigin: "center center" }}>
        {plaque ? (
          <>
            <div style={{ position: "absolute", inset: 0, boxSizing: "border-box", borderRadius: RAYON.PLAQUE, background: fondPlaque, border: `${TRAIT.MOYEN}px solid ${ENCRE}`, boxShadow: ombreBoite("S"), transform: `scaleX(${0.75 + 0.25 * freinCubique(borne(kk / 3))})`, transformOrigin: "left center" }} />
            <span style={{ position: "relative", ...styleMontserrat(corps, ENCRE) }}>{m.mot}</span>
          </>
        ) : (
          <span style={{ ...styleMontserrat(corps, enCours ? ACCENT_1 : COULEURS.BLANC), ...contourTexte(corps), filter: `drop-shadow(4px 5px 0 ${ENCRE})` }}>{m.mot}</span>
        )}
      </div>
    );
  });
  return <div style={{ position: "absolute", left: 0, top: empile ? Math.min(yc * H, (1 - ZONE_SURE_916.bas) * H - demiBloc) : yc * H, width: W, height: 0, zIndex: 800 }}>{elems}</div>;
}

/* ------------------------------------------------------------------ Étiquette de tête générique (local, § F.1) ------------------------------------------------------------------ */

/** Étiquette au-dessus de la tête (M1, D1) : pop 4 i, sortie S-RETRECIT 3 i. Sert de remplissage de l'enchaînement. */
export function EtiquetteTete({ frame, debut, fin, texte, palette, alterne = 0, surEtiquette, corps = 72 }: { frame: number; debut: number; fin: number; texte: string; palette: Palette; alterne?: number; surEtiquette?: string; corps?: number }) {
  const { ACCENT_1 } = accents(palette);
  const i = frame - debut;
  if (i < 0 || frame >= fin) return null;
  const kS = frame - (fin - 3);
  const e = kS >= 0 ? 1 - courbe(kS + 1, 0, 3, Easing.in(Easing.back(1.6))) : 0.3 + 0.7 * ressort("POP", i);
  const incl = alterne % 2 === 0 ? -3 : 2.5;
  const fond = alterne % 2 === 0 ? ACCENT_1 : COULEURS.BLANC;
  const rot = incl + (kS >= 0 ? 0 : -6 * (1 - ressort("POP", i)));
  return (
    <Pose x={W / 2 + (alterne % 2 ? 40 : -30)} y={0.1 * H} rotation={rot} echelle={Math.max(0, e) * (kS >= 0 ? 1 : tick(i, 8))} opacite={borne(i / 2)} z={50}>
      <div style={{ position: "relative" }}>
        <Plaque texte={texte} fond={fond} corps={corps} />
        {surEtiquette ? (
          <div style={{ position: "absolute", left: 0.04 * W, top: -corps * 0.62, transform: `scale(${0.3 + 0.7 * ressort("POP", i - 4)}) rotate(-1.5deg)`, transformOrigin: "left bottom" }}>
            <Plaque texte={surEtiquette} fond={ENCRE} couleurTexte={COULEURS.BLANC} corps={38} />
          </div>
        ) : null}
      </div>
    </Pose>
  );
}

/* ------------------------------------------------------------------ Bruitages ------------------------------------------------------------------ */

/** Bruitage : [instant (s), fichier de `sons/` sans extension, niveau relatif 0-1 (1 = crête à -12 dBFS)]. Aucune musique. */
export type Bruitage = [number, string, number];

/** Crêtes mesurées (dBFS) des fichiers de `sons/` : le niveau relatif est converti pour que chaque bruitage culmine à -12 dBFS × niveau. */
const CRETES: Record<string, number> = {
  click_001: -4.4, click_002: -3.9, click_003: -4.5, confirmation_002: -4, "ding-1": -1.4, "ding-2": -1.4, "ding-3": -1.4, "ding-4": -1.4, "ding-5": -1.4,
  drop_001: -0.9, drop_002: -1.1, drop_003: -1.1, drop_004: -0.9, eclats: -2, feutre: -2.3, select_001: -1.1, select_002: -0.9, tick_001: -2.5, tick_002: -1.9, tick_004: -3.8,
  vibreur: -1.4, "whoosh-in": -16.2, "whoosh-out": -19.3, boum: -1, "whoosh-grave": -5.1, montee: -2.3,
};
export const volumeBruitage = (son: string, relatif: number) => Math.min(1, relatif * Math.pow(10, (-12 - (CRETES[son] ?? -1)) / 20));

export function Sons({ liste }: { liste: Bruitage[] }) {
  return (
    <>
      {liste.map(([t, son, vol], k) => (
        <Sequence key={k} from={Math.max(0, Math.round(t * FPS))} durationInFrames={90} layout="none">
          <Audio src={mediaV4(`sons/${son}.wav`)} volume={volumeBruitage(son, vol) * GAIN_BRUITAGES} />
        </Sequence>
      ))}
    </>
  );
}

/** Traits d'impact (rectangles ENCRE 14 × 70 px, sans flou) qui jaillissent d'un point en `n` images. */
export function TraitsImpact({ cx, cy, rayon, k, angles, duree = 4 }: { cx: number; cy: number; rayon: number; k: number; angles: number[]; duree?: number }) {
  if (k < 0 || k >= duree) return null;
  const p = k / duree;
  return (
    <>
      {angles.map((a, n) => {
        const r = rayon + 22 + p * 80;
        const longueur = 96 * (1 - 0.45 * p);
        return <div key={n} style={{ position: "absolute", left: cx + Math.cos((a * Math.PI) / 180) * r - 9, top: cy + Math.sin((a * Math.PI) / 180) * r - longueur / 2, width: 18, height: longueur, background: ENCRE, transform: `rotate(${a + 90}deg)`, transformOrigin: "9px center" }} />;
      })}
    </>
  );
}

/** Coche ENCRE tracée (`strokeDashoffset`) dans une boîte `t` px. */
export function Coche({ t, p, couleur = ENCRE, epaisseur = 8 }: { t: number; p: number; couleur?: string; epaisseur?: number }) {
  return (
    <svg width={t} height={t} viewBox="0 0 24 24" fill="none" stroke={couleur} strokeWidth={epaisseur / (t / 24)} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5l5 5L20 6.5" strokeDasharray={20} strokeDashoffset={20 * (1 - borne(p))} />
    </svg>
  );
}
