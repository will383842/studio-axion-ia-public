import React from "react";
/**
 * BRIQUES COMMUNES du lot 2 « Cartes qui se construisent » (standard v4 du 16/10, § B, C, D, E).
 * Version LOCALE : jetons, ressorts nommés, `Plaque`, `CoqueCarte`, descente de la prise, `SousTitresV4`, `BarreProgression`,
 * `EtiquetteTete` générique (remplissage de l'enchaînement), bruitages. Elles seront harmonisées avec celles des autres lots.
 *
 * Convention : tout est piloté par `i` (images à 30 i/s depuis le début de l'élément) ; « i0 » = image où Will dit le mot déclencheur.
 * Tous les px sont à 1080 × 1920 (les extraits se rendent avec `scale: 0.5`).
 */
import { Audio, continueRender, delayRender, Easing, interpolate, OffthreadVideo, Sequence, spring } from "remotion";
import { GAIN_BRUITAGES, mediaV4 } from "../communs/medias-v4";
import type { CSSProperties, ReactNode } from "react";
import interBold from "../../../commune/polices/Inter-Bold.ttf";
import montserratExtraBold from "../../../commune/polices/Montserrat-ExtraBold.ttf";
import montserratBlack from "./polices/Montserrat-Black.ttf";

export const FPS = 30;
export const L = 1080;
export const H = 1920;

/* ------------------------------------------------------------------ Jetons (B.1, recopiés tels quels) ------------------------------------------------------------------ */

import { COULEURS, accents, TRAIT, OMBRE, RAYON, DESCENTE } from "../communs/briques-v4";
import type { Palette } from "../communs/briques-v4";
import { placerDansZoneSure } from "../communs/zone-sure-v4";
export { COULEURS, accents, TRAIT, OMBRE, RAYON, DESCENTE };
export type { Palette };

const { ENCRE, IVOIRE, IVOIRE_CLAIR, BLANC, GRIS } = COULEURS;
/** Liseré IVOIRE_CLAIR de 3 px entre le contour et l'ombre d'une surface ENCRE (lisible sur fond sombre ; test des 4 fonds). */
export const LISERE = `0 0 0 3px ${IVOIRE_CLAIR}`;
export const ombre = (t: keyof typeof OMBRE): string => `${OMBRE[t][0]}px ${OMBRE[t][1]}px 0 0 ${ENCRE}`;

/* ------------------------------------------------------------------ Polices (B.5) ------------------------------------------------------------------ */

export const MONTSERRAT = "Axion V4 Montserrat Black";
export const MONTSERRAT_800 = "Axion V4 Montserrat ExtraBold";
export const INTER = "Axion V4 Inter";

let chargement: Promise<void> | null = null;
/** Charge les polices EN LOCAL (aucun réseau) ; le rendu attend leur chargement. À appeler au début de chaque composition. */
export function chargerPolicesV4(): void {
  if (chargement || typeof document === "undefined") return;
  const attente = delayRender("Polices v4 du lot 2");
  const faces = [
    new FontFace(MONTSERRAT, `url(${montserratBlack})`, { weight: "900" }),
    new FontFace(MONTSERRAT_800, `url(${montserratExtraBold})`, { weight: "800" }),
    new FontFace(INTER, `url(${interBold})`, { weight: "100 900" }),
  ];
  chargement = Promise.all(faces.map((f) => f.load())).then((fs) => {
    fs.forEach((f) => document.fonts.add(f));
    continueRender(attente);
  });
}

/* ------------------------------------------------------------------ Ressorts nommés (D.1) ------------------------------------------------------------------ */

export const RESSORTS = {
  POP: { damping: 14, stiffness: 300, mass: 0.6 },
  CHUTE: { damping: 18, stiffness: 320, mass: 0.8 },
  CLAQUE: { damping: 20, stiffness: 500, mass: 0.5 },
  DESCENTE: { damping: 20, stiffness: 300, mass: 0.7 },
  GLISSE: { damping: 28, stiffness: 400, mass: 0.6 },
} as const;
export type NomRessort = keyof typeof RESSORTS;

/** Ressort 0 → 1 `i` images après son départ (avant : 0). */
export function ressort(nom: NomRessort, i: number): number {
  if (i <= 0) return 0;
  return spring({ frame: i, fps: FPS, config: RESSORTS[nom] });
}
/** Progression 0 → 1 en `n` images à partir de l'image `i0`. */
export function courbe(i: number, i0: number, n: number, easing: (x: number) => number = (x) => x): number {
  return interpolate(i, [i0, i0 + n], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
}
export const lerp = (a: number, b: number, p: number): number => a + (b - a) * p;
export const borne01 = (v: number): number => Math.min(1, Math.max(0, v));
/** Secousse amortie : A · e^(−k/3) · sin(2πk/3), `k` images après l'arrêt. */
export function secousse(k: number, amplitude: number): number {
  if (k < 0 || k > 12) return 0;
  return amplitude * Math.exp(-k / 3) * Math.sin((2 * Math.PI * k) / 3);
}
/** Bosse 0 → 1 → 0 en `n` images à partir de `i0` (pulsation CLAQUE 1 → 1 + amp → 1). */
export function bosse(i: number, i0: number, n = 6): number {
  return i >= i0 && i < i0 + n ? Math.sin((Math.PI * (i - i0)) / n) : 0;
}
/** Échelle de pulsation : somme des bosses aux images `frames`. */
export const pulsation = (i: number, frames: number[], amp = 0.06, n = 6): number => 1 + amp * frames.reduce((a, f) => Math.max(a, bosse(i, f, n)), 0);
/**
 * Gestes de vie (aucun objet figé > 0,75 s) : entre deux événements, une pulsation 6 images après le premier, puis toutes les 9 images, et
 * jusqu'à la sortie. `evenements` : images locales des événements graphiques de l'élément.
 */
export const vieEntre = (evenements: number[], duree: number): number[] => {
  const ev = [...new Set(evenements.filter((f) => f < duree - 3))].sort((x, y) => x - y);
  const r: number[] = [];
  ev.forEach((e, k) => {
    const fin = (ev[k + 1] ?? duree - 3) - 3;
    for (let f = e + 6; f <= fin; f += 9) r.push(f);
  });
  return r;
};

/** Couleur interpolée directement (pas de fondu de surface : 3 images). */
export function melange(a: string, b: string, p: number): string {
  const lire = (h: string) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  const [r1, g1, b1] = lire(a);
  const [r2, g2, b2] = lire(b);
  const m = (x: number, y: number) => Math.round(lerp(x, y, borne01(p)));
  return `rgb(${m(r1, r2)}, ${m(g1, g2)}, ${m(b1, b2)})`;
}

/** E-POP : échelle 0,3 → 1 (`POP`), rotation (finale − 6°) → finale, opacité 0 → 1 en 2 i. */
export function entreePop(i: number, rotation: number, nom: NomRessort = "POP", depart = 0.3) {
  const p = ressort(nom, i);
  return { scale: depart + (1 - depart) * p, rotation: lerp(rotation - 6, rotation, p), opacite: i <= 0 ? 0 : courbe(i, 0, 2) };
}

/* ------------------------------------------------------------------ Bruitages ------------------------------------------------------------------ */

/** Bruitage du dossier `sons/` du studio (Kenney CC0) ; `f` en images locales à l'élément. */
export const REGLAGE_SONS = { facteur: 1 };
export function Son({ f, fichier, volume = 0.2, actif }: { f: number; fichier: string; volume?: number; actif: boolean }) {
  if (!actif || f < 0) return null;
  volume *= REGLAGE_SONS.facteur;
  return (
    <Sequence from={Math.max(0, Math.round(f))} layout="none">
      <Audio src={mediaV4(`sons/${fichier}.wav`)} volume={volume * GAIN_BRUITAGES} />
    </Sequence>
  );
}
/** Liste de bruitages [image, fichier, volume] → calques audio. */
export function Sons({ liste, actif }: { liste: [number, string, number?][]; actif: boolean }) {
  return (
    <>
      {liste.map(([f, fichier, volume], k) => (
        <Son key={k} f={f} fichier={fichier} volume={volume} actif={actif} />
      ))}
    </>
  );
}
export const SONS_TICK = ["tick_001", "tick_002", "tick_004"];
export const SONS_CLICK = ["click_001", "click_002", "click_003"];

/* ------------------------------------------------------------------ Texte, plaques ------------------------------------------------------------------ */

export const styleMontserrat = (corps: number, extra?: CSSProperties): CSSProperties => ({
  fontFamily: `"${MONTSERRAT}", sans-serif`,
  fontWeight: 900,
  fontSize: corps,
  lineHeight: 1,
  textTransform: "uppercase",
  letterSpacing: "0.01em",
  whiteSpace: "nowrap",
  ...extra,
});
export const styleInter = (corps: number, poids = 700, extra?: CSSProperties): CSSProperties => ({
  fontFamily: `"${INTER}", sans-serif`,
  fontWeight: poids,
  fontSize: corps,
  lineHeight: 1.1,
  whiteSpace: "nowrap",
  color: ENCRE,
  ...extra,
});

/** `Plaque` (B.7) : rayon 10, contour 5, ombre S, padding 0,16 em × 0,30 em, texte Montserrat 900 capitales. */
export function Plaque(p: { fond: string; texte?: string; couleur?: string; corps?: number; inclinaison?: number; style?: CSSProperties; children?: ReactNode; ombreTaille?: "S" | "M" }) {
  const corps = p.corps ?? 60;
  return (
    <div
      style={{
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        gap: corps * 0.25,
        background: p.fond,
        color: p.couleur ?? ENCRE,
        border: `${TRAIT.MOYEN}px solid ${ENCRE}`,
        borderRadius: RAYON.PLAQUE,
        boxShadow: p.fond === ENCRE ? `${LISERE}, ${ombre(p.ombreTaille ?? "S")}` : ombre(p.ombreTaille ?? "S"),
        padding: `${(corps * 0.16).toFixed(1)}px ${(corps * 0.3).toFixed(1)}px`,
        transform: p.inclinaison ? `rotate(${p.inclinaison}deg)` : undefined,
        ...styleMontserrat(corps),
        ...p.style,
      }}
    >
      {p.texte}
      {p.children}
    </div>
  );
}

/** Bloc animé en E-POP / S-RETRECIT ancré par son centre (x, y). `sortie` : image de début de la sortie de 3 i. */
export function Pop({ i, i0 = 0, x, y, rotation = 0, sortie, nom = "POP", depart = 0.3, children, dx = 0, dy = 0, z }: { i: number; i0?: number; x: number; y: number; rotation?: number; sortie?: number; nom?: NomRessort; depart?: number; children: ReactNode; dx?: number; dy?: number; z?: number }) {
  const k = i - i0;
  if (k <= 0) return null;
  const e = entreePop(k, rotation, nom, depart);
  const s = sortie === undefined ? 0 : courbe(i, sortie, 3, Easing.in(Easing.back(1.6)));
  if (s >= 1) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, zIndex: z, transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(${e.rotation}deg) scale(${e.scale * (1 - s)})`, opacity: e.opacite }}>{children}</div>
  );
}

/* ------------------------------------------------------------------ Icônes simples (pictogrammes, jamais de visage) ------------------------------------------------------------------ */

export type NomIcone = "coche" | "personne" | "horloge" | "mail" | "fleche" | "envoi" | "filtre" | "stylo" | "avion" | "calendrier" | "coeur" | "etoile" | "bulle" | "eclair" | "doc" | "appel";
const CHEMINS: Record<NomIcone, ReactNode> = {
  coche: <path d="M5 12.5l4.5 4.5L19 7" />,
  personne: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c.6-4.2 3.5-6.2 7.5-6.2s6.9 2 7.5 6.2z" />
    </>
  ),
  horloge: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7v5.2l3.4 2" />
    </>
  ),
  mail: (
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="2" />
      <path d="M4 7.5l8 6 8-6" />
    </>
  ),
  fleche: <path d="M6 17.5L17.5 6M9 6h8.5v8.5" />,
  envoi: <path d="M5 12h13M12.5 6l6 6-6 6" />,
  filtre: <path d="M4 5.5h16l-6.2 7.6v5.4l-3.6 1.8v-7.2z" />,
  stylo: <path d="M4.5 19.5l1-4.2L16.3 4.5l3.2 3.2L8.7 18.5zM14.2 6.6l3.2 3.2" />,
  avion: <path d="M3.5 11.5l17-7.5-4.6 16-4.2-5.2zM11.7 14.8l8.8-10.8" />,
  calendrier: (
    <>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  coeur: <path d="M12 20s-7.6-4.6-7.6-10.2C4.4 6.8 6.6 5 9 5c1.4 0 2.4.7 3 1.8C12.600 5.700 13.600 5 15 5c2.400 0 4.600 1.800 4.600 4.800C19.600 15.400 12 20 12 20z" />,
  etoile: <path d="M12 3.8l2.5 5.2 5.700.8-4.100 4 1 5.700L12 16.800 6.900 19.500l1-5.700-4.100-4 5.700-.8z" />,
  bulle: <path d="M4.500 5.500h15v10h-7.500l-4.500 3.500v-3.500h-3z" />,
  eclair: <path d="M13.500 3.500L5.500 13.500H11l-1 7 8-10H12.500z" />,
  doc: (
    <>
      <path d="M6 3.500h8.500L19 8v12.500H6z" />
      <path d="M9 12.500h7M9 16h7" />
    </>
  ),
  appel: <path d="M6.500 4h3l1.500 4-2 1.500a11 11 0 005 5l1.500-2 4 1.500v3a2 2 0 01-2 2C10.500 19 5 13.500 4.500 6a2 2 0 012-2z" />,
};
/** Icône à trait ENCRE (≥ 44 px dans les cartes), remplissage optionnel. */
export function Ico({ nom, taille = 44, fond = "none", trait = ENCRE, epaisseur = 2.4 }: { nom: NomIcone; taille?: number; fond?: string; trait?: string; epaisseur?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill={fond} stroke={trait} strokeWidth={epaisseur} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flex: "none" }}>
      {CHEMINS[nom]}
    </svg>
  );
}
/** Pastille ronde à contour (pictogramme sur ACCENT_1 ou BLANC). */
export function PastilleRonde({ taille, fond, children, contour = TRAIT.MOYEN, style }: { taille: number; fond: string; children?: ReactNode; contour?: number; style?: CSSProperties }) {
  return (
    <div style={{ boxSizing: "border-box", width: taille, height: taille, borderRadius: "50%", border: `${contour}px solid ${ENCRE}`, background: fond, display: "flex", alignItems: "center", justifyContent: "center", flex: "none", ...style }}>{children}</div>
  );
}
/** Case à cocher (D.3 « Coche ») : remplissage ACCENT_1 en 2 i, puis la coche ENCRE se trace en 4 i. `i0` = image de la coche. */
export function Case({ i, i0, taille = 52, fond }: { i: number; i0: number; taille?: number; fond: string }) {
  const rempli = courbe(i, i0, 2);
  const trace = courbe(i, i0 + 2, 4, Easing.out(Easing.cubic));
  return (
    <div style={{ boxSizing: "border-box", width: taille, height: taille, borderRadius: 10, border: `${TRAIT.FIN}px solid ${ENCRE}`, background: rempli >= 1 ? fond : BLANC, flex: "none", position: "relative" }}>
      <svg width="100%" height="100%" viewBox="0 0 24 24" style={{ position: "absolute", inset: 0 }} fill="none" stroke={ENCRE} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5.500 12.500l4.200 4.200L18.500 7.500" strokeDasharray={16} strokeDashoffset={16 * (1 - trace)} />
      </svg>
    </div>
  );
}

/** Texte tapé (D.3) : `cps` caractères par image à partir de `i0`. */
export const tape = (texte: string, i: number, i0: number, cps = 2): string => texte.slice(0, Math.max(0, Math.min(texte.length, Math.floor((i - i0) * cps))));
/** Curseur ENCRE 4 × 0,9 em, 15 i allumé / 15 i éteint. */
export function Curseur({ i, corps }: { i: number; corps: number }) {
  return <span style={{ display: "inline-block", width: 4, height: corps * 0.9, marginLeft: 3, verticalAlign: "-0.12em", background: Math.floor(i / 15) % 2 === 0 ? ENCRE : "transparent" }} />;
}

/** « Compteur à rouleau » : l'ancien texte part vers le haut en 3 i, le nouveau monte de +100 % à 0 en 4 i. */
export function Rouleau({ valeurs, frames, i, hauteur, style }: { valeurs: string[]; frames: number[]; i: number; hauteur: number; style?: CSSProperties }) {
  let k = 0;
  frames.forEach((f, n) => {
    if (i >= f) k = n;
  });
  const depuis = i - frames[k];
  const plusLong = valeurs.reduce((a, b) => (b.length > a.length ? b : a), "");
  const couche = (texte: string, y: number, cle: string) => (
    <div key={cle} style={{ position: "absolute", left: 0, right: 0, top: 0, height: hauteur, transform: `translateY(${y}%)`, textAlign: "center", lineHeight: `${hauteur}px` }}>
      {texte}
    </div>
  );
  return (
    <div style={{ position: "relative", display: "inline-block", overflow: "hidden", height: hauteur, lineHeight: `${hauteur}px`, ...style }}>
      <span style={{ visibility: "hidden" }}>{plusLong}</span>
      {k > 0 && depuis < 3 && couche(valeurs[k - 1], -100 * courbe(depuis, 0, 3, Easing.in(Easing.cubic)), "ancien")}
      {couche(valeurs[k], k > 0 ? 100 * (1 - courbe(depuis, 0, 4, Easing.out(Easing.cubic))) : 0, "nouveau")}
    </div>
  );
}

/* ------------------------------------------------------------------ CoqueCarte, entrée et sortie (B.7, D.2) ------------------------------------------------------------------ */

export const CARTE = { x: 0.07 * L, haut: 0.035 * H, largeur: 0.86 * L, hauteurM2: 0.295 * H, hauteurM3: 0.365 * H, entete: 106, corps: 0.035 * L };

/** E-CHUTE (translateY −0,40 H → 0, rotateZ −5° → 0, `CHUTE`) puis S-REMONTE (0 → −0,45 H en 3 i, cubique). `duree` : image où la carte a disparu. */
export function mouvementCarte(i: number, duree: number) {
  const e = ressort("CHUTE", i);
  const s = courbe(i, duree - 3, 3, Easing.in(Easing.cubic));
  return { ty: -0.4 * H * (1 - e) - 0.45 * H * s, rot: -5 * (1 - e), visible: i >= 0 && i < duree };
}

/** Pastille « n/N » ou étiquette de l'en-tête : ENCRE, texte BLANC, Montserrat 800 30. */
export function PastilleEntete({ children }: { children: ReactNode }) {
  return (
    <div style={{ boxSizing: "border-box", background: ENCRE, color: BLANC, borderRadius: RAYON.PILULE, padding: "0 22px", height: 56, display: "flex", alignItems: "center", fontFamily: `"${MONTSERRAT_800}", sans-serif`, fontWeight: 800, fontSize: 30, textTransform: "uppercase", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{children}</div>
  );
}

/**
 * Carte (largeur 0,86 L, rayon 18, contour 7, ombre M). En-tête 106 px ACCENT_1 (ne défile jamais), corps IVOIRE_CLAIR.
 * `children` : calques du CORPS (coordonnées relatives au corps, 914 px de large) ; `debord` : calques posés sur la carte, qui peuvent
 * déborder de ses bords (coordonnées relatives à la carte).
 */
export function CoqueCarte(p: { palette: Palette; titre: ReactNode; pastille?: ReactNode; i: number; duree: number; haute?: boolean; children?: ReactNode; debord?: ReactNode; extraTransform?: string; vie?: number[] }) {
  const { ACCENT_1 } = accents(p.palette);
  const m = mouvementCarte(p.i, p.duree);
  if (!m.visible) return null;
  const h = p.haute ? CARTE.hauteurM3 : CARTE.hauteurM2;
  return (
    <div style={{ position: "absolute", left: CARTE.x, top: CARTE.haut, width: CARTE.largeur, height: h, transform: `translateY(${m.ty}px) rotate(${m.rot}deg)`, transformOrigin: "50% 0%" }}>
      <div style={{ position: "absolute", inset: 0, boxSizing: "border-box", border: `${TRAIT.FORT}px solid ${ENCRE}`, borderRadius: RAYON.CARTE, boxShadow: ombre("M"), background: IVOIRE_CLAIR, overflow: "hidden" }}>
        <div style={{ boxSizing: "border-box", height: CARTE.entete, background: ACCENT_1, borderBottom: `${TRAIT.MOYEN}px solid ${ENCRE}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 26px 0 30px" }}>
          <div style={styleMontserrat(38, { letterSpacing: "0.04em", color: ENCRE })}>{p.titre}</div>
          <div style={{ transform: `scale(${pulsation(p.i, p.vie ?? [], 0.2)})` }}>{p.pastille}</div>
        </div>
        <div style={{ position: "relative", width: CARTE.largeur - 2 * TRAIT.FORT, height: h - 2 * TRAIT.FORT - CARTE.entete }}>{p.children}</div>
      </div>
      {p.debord}
    </div>
  );
}
/** Largeur et hauteur utiles du corps d'une carte. */
export const CORPS_L = CARTE.largeur - 2 * TRAIT.FORT;
export const corpsH = (haute?: boolean): number => (haute ? CARTE.hauteurM3 : CARTE.hauteurM2) - 2 * TRAIT.FORT - CARTE.entete;

/** Ligne ajoutée (D.3) : hauteur 0 → h en 3 i (`GLISSE`) ; `p` 0 → 1. */
export const hauteurLigne = (i: number, i0: number, h: number): number => h * courbe(i, i0, 3, Easing.out(Easing.cubic));

/* ------------------------------------------------------------------ Prise : descente / remontée (D.4) ------------------------------------------------------------------ */

export type ChangementD = { f: number; vers: number };
export type ItemD = { de: number; fin: number; D: number };

/** Transforme les objets posés (images globales) en changements de cible de la prise : descente au début, remontée 1 image après la fin. */
export function changementsDescente(items: ItemD[]): ChangementD[] {
  const evts: { f: number; vers: number | null; fin: boolean }[] = [];
  items.forEach((it) => {
    evts.push({ f: it.de, vers: it.D, fin: false });
    evts.push({ f: it.fin + 1, vers: null, fin: true });
  });
  evts.sort((a, b) => a.f - b.f || (a.fin ? 1 : 0) - (b.fin ? 1 : 0));
  const res: ChangementD[] = [];
  let cible = 0;
  evts.forEach((e) => {
    let vers = e.vers;
    if (vers === null) {
      const actifs = items.filter((o) => o.de <= e.f && o.fin + 1 > e.f).sort((a, b) => a.de - b.de);
      vers = actifs.length ? actifs[actifs.length - 1].D : 0;
    }
    if (vers === cible) return;
    const f = !e.fin && vers < cible ? e.f + 1 : e.f;
    res.push({ f, vers });
    cible = vers;
  });
  return res;
}
const remonte = (i: number): number => courbe(i, 0, 4, Easing.out(Easing.back(1.3)));
function evaluerD(de: number, vers: number, i: number): number {
  if (i <= 0) return de;
  return vers > de ? de + (vers - de) * ressort("DESCENTE", i) : de + (vers - de) * remonte(i);
}
/** D (fraction de H) à l'image globale `frame`. */
export function valeurD(frame: number, changements: ChangementD[]): number {
  let courant = 0;
  let cible = 0;
  let f0 = -1e9;
  for (const ch of changements) {
    if (frame < ch.f) break;
    courant = evaluerD(courant, cible, ch.f - f0);
    cible = ch.vers;
    f0 = ch.f;
  }
  return evaluerD(courant, cible, frame - f0);
}
/** Cible (non animée) de D à l'image `frame` : sert à placer les sous-titres (coupe sèche, jamais de glissement). */
export function cibleD(frame: number, changements: ChangementD[]): number {
  let c = 0;
  for (const ch of changements) if (frame >= ch.f - 1) c = ch.vers;
  return c;
}

/**
 * La prise de Will en fond, SANS ZOOM : seule transformation = translateY(D × 1920 px). La bande révélée en haut est IVOIRE.
 * `video` : prise de 15 s (avec sa voix) ; `depuis` : secondes dans la prise. Sinon l'image fixe de secours.
 */
export type FondTest = "prise" | "blanc" | "noir" | `broll:${string}`;
export function Prise({ D, depuis = 0, video = true, fond = "prise" }: { D: number; depuis?: number; video?: boolean; fond?: FondTest }) {
  if (fond !== "prise") {
    // Test des 4 fonds (J.5) : la prise est remplacée par un aplat ou un B-roll en plein cadre ; le fond de la prise elle-même n'est jamais modifié.
    return (
      <div style={{ position: "absolute", inset: 0, background: fond === "blanc" ? "#FFFFFF" : "#111111", overflow: "hidden" }}>
        {fond.startsWith("broll:") && <OffthreadVideo src={mediaV4(fond.slice(6))} trimBefore={0} muted style={{ width: L, height: H, objectFit: "cover" }} />}
      </div>
    );
  }
  return (
    <div style={{ position: "absolute", inset: 0, background: IVOIRE, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: L, height: H, transform: `translateY(${(D * H).toFixed(2)}px)` }}>
        {video ? (
          <OffthreadVideo src={mediaV4("prise-commune-15s.mp4")} trimBefore={Math.round(depuis * FPS)} style={{ width: L, height: H, objectFit: "cover" }} />
        ) : (
          <img src={mediaV4("prise-commune-1080x1920.png")} style={{ width: L, height: H, objectFit: "cover" }} />
        )}
      </div>
    </div>
  );
}

/** Barre de progression du haut : y 0 → 10 px, fond ENCRE, rempli ACCENT_1, trait BLANC de 4 px au bout. */
export function BarreProgression({ frame, total, palette }: { frame: number; total: number; palette: Palette }) {
  const p = borne01((frame + 1) / total);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: L, height: 10, background: ENCRE, zIndex: 50 }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: L * p, height: 10, background: accents(palette).ACCENT_1 }} />
      <div style={{ position: "absolute", left: Math.max(0, L * p - 4), top: 0, width: 4, height: 10, background: BLANC }} />
    </div>
  );
}

/* ------------------------------------------------------------------ Sous-titres v4 (§ C) ------------------------------------------------------------------ */

export type Mot = { mot: string; debut: number; fin: number; fort?: boolean; chiffre?: boolean };
type Groupe = { mots: Mot[]; debut: number; fin: number };

const lettres = (m: Mot): number => m.mot.replace(/[^A-Za-zÀ-ÿ0-9]/g, "").length;
const liaison = (m: Mot): boolean => lettres(m) <= 3 && !m.fort && !m.chiffre;

/** 1 à 2 mots par groupe (3 si le 3ᵉ fait ≤ 3 lettres) ; un mot de liaison n'est jamais seul. */
export function grouper(mots: Mot[]): Groupe[] {
  const res: Groupe[] = [];
  let derniereSolo = false;
  let n = 0;
  while (n < mots.length) {
    const g: Mot[] = [mots[n]];
    const suivant = mots[n + 1];
    if (suivant && (liaison(mots[n]) || (!mots[n].fort && !suivant.fort && !liaison(suivant) && derniereSolo))) g.push(suivant);
    if (g.length === 2 && mots[n + 2] && lettres(mots[n + 2]) <= 3 && !mots[n + 2].fort && g.reduce((a, m) => a + lettres(m), 0) <= 9) g.push(mots[n + 2]);
    derniereSolo = g.length === 1;
    res.push({ mots: g, debut: g[0].debut, fin: g[g.length - 1].fin });
    n += g.length;
  }
  return res;
}

const LARGEUR_MAX = 0.88 * L;
/** Corps ajusté : 84 px, jusqu'à 62 px minimum, pour tenir en 0,88 L sur une ligne. */
function corpsGroupe(g: Groupe): number {
  const em = g.mots.reduce((a, m) => a + lettres(m) * 0.8 + (m.fort || m.chiffre ? 0.48 : 0), 0) + (g.mots.length - 1) * 0.3;
  return Math.max(62, Math.min(84, LARGEUR_MAX / Math.max(1, em)));
}

/**
 * Sous-titres v4 : Montserrat 900 capitales 84 px, 1-2 mots, trois états (dit : BLANC ; en cours : ACCENT_1 ; mot fort : plaque ACCENT_1 ;
 * chiffre : plaque ACCENT_2), contour de texte ENCRE 0,14 em, ombre dure. `y(frame)` renvoie le centre vertical (px) selon la mise en page à l'image courante (coupe sèche quand la cible de D change).
 */
export function SousTitresV4({ mots, frame, palette, y }: { mots: Mot[]; frame: number; palette: Palette; y: (frame: number) => number }) {
  const { ACCENT_1, ACCENT_2 } = accents(palette);
  const groupes = React.useMemo(() => grouper(mots), [mots]);
  const t = frame / FPS;
  let courant = -1;
  groupes.forEach((g, k) => {
    if (g.debut * FPS <= frame + 0.01) courant = k;
  });
  if (courant < 0) return null;
  const g = groupes[courant];
  if (t > g.fin + 0.45 && !groupes[courant + 1]) return null;
  const corps = corpsGroupe(g);
  return (
    <div style={{ position: "absolute", left: 0, width: L, top: y(frame), transform: "translateY(-50%)", display: "flex", justifyContent: "center", alignItems: "center", gap: corps * 0.26, zIndex: 40 }}>
      {g.mots.map((m, k) => {
        const kd = Math.round(m.debut * FPS);
        const j = frame - kd;
        const demarre = j >= 0;
        const suivantMot = g.mots[k + 1];
        const enCours = demarre && !(suivantMot && frame >= Math.round(suivantMot.debut * FPS));
        const pop = demarre ? 0.5 + 0.5 * ressort("POP", j) : 0.5;
        const fort = m.fort || m.chiffre;
        const rotPlaque = k % 2 === 0 ? -2 : 1.5;
        const commun: CSSProperties = { ...styleMontserrat(corps), opacity: demarre ? Math.min(1, j + 1) : 0 };
        if (fort) {
          const fond = m.chiffre ? ACCENT_2 : ACCENT_1;
          const etire = 0.35 + 0.65 * courbe(j, 0, 3, Easing.out(Easing.cubic));
          return (
            <div key={k} style={{ ...commun, opacity: demarre ? 1 : 0, boxSizing: "border-box", background: fond, color: ENCRE, border: `${TRAIT.MOYEN}px solid ${ENCRE}`, borderRadius: RAYON.PLAQUE, boxShadow: ombre("S"), padding: `${(corps * 0.1).toFixed(1)}px ${(corps * 0.24).toFixed(1)}px`, transform: `rotate(${rotPlaque}deg) scaleX(${etire})`, transformOrigin: "0% 50%" }}>
              <span style={{ display: "inline-block", transform: `scale(${0.5 + 0.5 * ressort("POP", j)})` }}>{m.mot}</span>
            </div>
          );
        }
        return (
          <div key={k} style={{ ...commun, color: enCours ? ACCENT_1 : BLANC, transform: `scale(${pop})`, WebkitTextStroke: `${(0.14 * corps).toFixed(1)}px ${ENCRE}`, paintOrder: "stroke fill", filter: `drop-shadow(4px 5px 0 ${ENCRE})` }}>
            {m.mot}
          </div>
        );
      })}
    </div>
  );
}

/** Bas de la carte + 0,015 H + demi-hauteur du sous-titre : centre des sous-titres posés sous la carte (M2 / M3). */
export const Y_SOUS_CARTE = { M2: 0.375, M3: 0.432 };
const DEMI_SOUS_TITRE = 0.031;
const YEUX = { haut: 0.27, bas: 0.36 };

/**
 * Centre vertical (px) des sous-titres, calculé à CHAQUE image depuis la descente RÉELLE `D` (jamais la cible) : sous la carte (`ybas`, fraction de H)
 * seulement quand la boîte du groupe reste au-dessus des yeux ([0,27 + D ; 0,36 + D] H) ; sinon sous le visage, en suivant la prise (0,66 + D).
 */
export function ySousTitresReel(D: number, ybas: number | null): number {
  if (ybas !== null && ybas + DEMI_SOUS_TITRE + 0.012 <= YEUX.haut + D) return placerDansZoneSure(ybas, D) * H;
  return placerDansZoneSure(0.66 + D, D) * H;
}
/** Assertion par image : la boîte du groupe ne coupe jamais la bande des yeux. */
export function verifierYeux(frame: number, yPx: number, D: number): void {
  const haut = yPx / H - DEMI_SOUS_TITRE;
  const bas = yPx / H + DEMI_SOUS_TITRE;
  if (bas > YEUX.haut + D && haut < YEUX.bas + D) throw new Error(`Sous-titres sur les yeux à l'image ${frame} : boîte [${haut.toFixed(3)} ; ${bas.toFixed(3)}] H, yeux [${(YEUX.haut + D).toFixed(3)} ; ${(YEUX.bas + D).toFixed(3)}] H`);
}

/** Mots de démonstration : le texte est réparti sur [t0, t1] (secondes) au prorata des lettres. `forts` / `chiffres` : indices des mots. */
export function motsSur(texte: string, t0: number, t1: number, forts: number[] = [], chiffres: number[] = []): Mot[] {
  const brut = texte.split(/\s+/).filter(Boolean);
  const poids = brut.map((m) => 0.08 * 5 + Math.max(2, m.replace(/[^A-Za-zÀ-ÿ0-9]/g, "").length));
  const somme = poids.reduce((a, b) => a + b, 0);
  let t = t0;
  return brut.map((m, k) => {
    const d = ((t1 - t0) * poids[k]) / somme;
    const mot: Mot = { mot: m.toUpperCase(), debut: t, fin: t + d * 0.9, fort: forts.includes(k), chiffre: chiffres.includes(k) };
    t += d;
    return mot;
  });
}

/* ------------------------------------------------------------------ Étiquette générique (remplissage de l'enchaînement) ------------------------------------------------------------------ */

/**
 * `EtiquetteTete` locale (M1) : plaque de 1 à 3 mots au-dessus de la tête, inclinée, entrée E-POP, sortie S-RETRECIT, changement de texte en
 * rouleau. `textes[k]` s'affiche à partir de l'image `changes[k]`. Elle appartient au lot 1 : ceci n'est qu'une version de remplissage.
 */
export function EtiquetteTete(p: { palette: Palette; textes: string[]; changes?: number[]; i: number; duree: number; blanc?: boolean; inclinaison?: number; sur?: string; avecSons: boolean }) {
  const { ACCENT_1 } = accents(p.palette);
  if (p.i < 0 || p.i >= p.duree) return null;
  const rot = p.inclinaison ?? -3;
  const e = entreePop(p.i, rot);
  const s = courbe(p.i, p.duree - 3, 3, Easing.in(Easing.back(1.6)));
  return (
    <>
      <div style={{ position: "absolute", left: L / 2, top: 0.108 * H, transform: `translate(-50%, -50%) rotate(${e.rotation}deg) scale(${e.scale * (1 - s)})`, opacity: e.opacite, zIndex: 20 }}>
        <Plaque fond={p.blanc ? BLANC : ACCENT_1} corps={68}>
          <Rouleau valeurs={p.textes} frames={p.changes ?? [0]} i={p.i} hauteur={68} />
        </Plaque>
        {p.sur && p.i >= 4 && (
          <div style={{ position: "absolute", left: 0.04 * L, top: -34, transform: `rotate(-1.5deg) scale(${0.3 + 0.7 * ressort("POP", p.i - 4)})`, transformOrigin: "0% 100%" }}>
            <Plaque fond={ENCRE} couleur={BLANC} corps={38}>
              {p.sur}
            </Plaque>
          </div>
        )}
      </div>
      <Sons actif={p.avecSons} liste={[[0, "select_001", 0.12]]} />
    </>
  );
}
