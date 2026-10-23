import React, { useEffect, useMemo, useState } from "react";
/**
 * BRIQUES COMMUNES du lot 3 « Fil conducteur, chiffres et preuves » (standard v4 du 16/10, § A à D).
 * Version LOCALE : aplats, contour encre, ombre dure sans flou, ressorts nommés, entrées/sorties, sous-titres v4, prise qui descend.
 * Elle sera harmonisée avec les autres lots à l'intégration. Tout est piloté par l'image locale `i` (30 i/s) ; « i0 » est l'image du mot déclencheur.
 * Les px sont à 1080 de large (le rendu des extraits se fait avec `scale: 0.5`).
 */
import { Audio, continueRender, delayRender, Easing, interpolate, OffthreadVideo, Sequence, spring, useCurrentFrame } from "remotion";
import { GAIN_BRUITAGES, mediaV4 } from "../communs/medias-v4";
import type { CSSProperties, ReactNode } from "react";

export const FPS = 30;
export const W = 1080;
export const H = 1920;

/* ------------------------------------------------------------------ Jetons (§ B.1, recopiés à l'identique) ------------------------------------------------------------------ */
import { COULEURS, accents, TRAIT, OMBRE, RAYON, DESCENTE } from "../communs/briques-v4";
import type { Palette } from "../communs/briques-v4";
import { Y_ST_MAX, Y_ST_MIN, ZONE_SURE_916 } from "../communs/zone-sure-v4";
export { COULEURS, accents, TRAIT, OMBRE, RAYON, DESCENTE };
export type { Palette };

const E = COULEURS.ENCRE;
export const ombre = (t: "S" | "M" | "L"): string => `${OMBRE[t][0]}px ${OMBRE[t][1]}px 0 0 ${E}`;

/* ------------------------------------------------------------------ Typographie ------------------------------------------------------------------ */
export const MONTSERRAT = '"Axion Montserrat Black", "Montserrat", "Arial Black", sans-serif';
export const INTER = '"Inter", "Axion Inter Bold", system-ui, sans-serif';

/** Charge Montserrat Black (fichier `polices/Montserrat-Black.ttf` du dossier public). Inter vient du système. */
export function Polices(): null {
  const [poignee] = useState(() => delayRender("polices v4 lot 3"));
  useEffect(() => {
    const f = new FontFace("Axion Montserrat Black", `url(${mediaV4("polices/Montserrat-Black.ttf")})`, { weight: "900" });
    f.load().then((face) => { document.fonts.add(face); continueRender(poignee); }).catch(() => continueRender(poignee));
  }, [poignee]);
  return null;
}

/** Contour de texte encre 0,14 em (la moitié, extérieure, est visible), peint sous le remplissage. */
export const contourTexte = (corps: number, couleur: string = E, facteur = 0.14): CSSProperties => ({
  WebkitTextStroke: `${(facteur * corps).toFixed(1)}px ${couleur}`,
  paintOrder: "stroke fill",
});

/* ------------------------------------------------------------------ Ressorts nommés (§ D.1) ------------------------------------------------------------------ */
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
export const courbe = (i: number, i0: number, n: number, easing: (x: number) => number = (x) => x): number =>
  interpolate(i, [i0, i0 + n], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
export const lerp = (a: number, b: number, p: number): number => a + (b - a) * p;
export const aspire = Easing.in(Easing.cubic);
export const sortieRetrecit = Easing.in(Easing.back(1.6));
export const sortieDouce = Easing.out(Easing.cubic);

/** Secousse amortie de l'ÉLÉMENT (jamais de la prise), `k` images après l'arrêt. */
export function secousse(k: number, amplitude: number): number {
  if (k < 0 || k > 12) return 0;
  return amplitude * Math.exp(-k / 3) * Math.sin((2 * Math.PI * k) / 3);
}

/** Bruitage du dossier `sons/` (`i0` = image locale de départ). */
export function Son({ i0, fichier, volume = 0.5, actif = true }: { i0: number; fichier: string; volume?: number; actif?: boolean }) {
  if (!actif) return null;
  return (
    <Sequence from={Math.max(0, Math.round(i0))} layout="none">
      <Audio src={mediaV4(`sons/${fichier}.wav`)} volume={volume * GAIN_BRUITAGES} />
    </Sequence>
  );
}

/* ------------------------------------------------------------------ Entrées / sorties (§ D.2) ------------------------------------------------------------------ */
export type Entree = "pop" | "chute" | "coteD" | "coteG" | "bas" | "etire" | "coupe";
export type Sortie = "retrecit" | "remonte" | "coteG" | "coteD" | "bas" | "vers" | "aucune";
export type Vie = { debut: number; pas?: number; amp?: number };
/** Onde de 0 à 1 sur les 6 premières images de chaque cycle de `pas` images (geste de vie : jamais plus de `pas` images sans mouvement). */
export const onde = (k: number, pas = 12, dur = 6): number => (k < 0 ? 0 : (k % pas) < dur ? Math.sin((Math.PI * (k % pas)) / dur) : 0);
/** Échelle de la pulsation CLAQUE 1 → 1,06 → 1 toutes les `pas` images à partir de `debut` (image locale). */
export const pulsation = (i: number, v?: Vie): number => (v ? 1 + (v.amp ?? 0.06) * onde(i - v.debut, v.pas ?? 12) : 1);

/**
 * Enveloppe animée : positionne l'objet (px à 1080) puis lui applique l'entrée (≤ 6 i) et la sortie (3-5 i).
 * Aucun reste : après la sortie, plus rien n'est rendu.
 */
export function Anim({ i, i0, iSortie, entree = "pop", sortie = "retrecit", incl = 0, x, y, w, h, origine = "50% 50%", z = 1, extra, children, ressortNom, delaiPop = 0, vie, vers, id }: {
  i: number; i0: number; iSortie?: number; entree?: Entree; sortie?: Sortie; incl?: number;
  x: number; y: number; w?: number; h?: number; origine?: string; z?: number; extra?: string; ressortNom?: NomRessort; delaiPop?: number; children: ReactNode;
  /** Pulsation de vie tant que l'objet est posé. */
  vie?: Vie;
  /** Sortie « vers » : l'objet se réduit en 5 i vers un point (dx, dy en px, échelle finale). */
  vers?: { dx: number; dy: number; echelle: number };
  /** Identifiant de l'objet pour l'audit (rectangle, immobilité). */
  id?: string;
}) {
  const k = i - i0;
  if (k < 0) return null;
  let tx = 0, ty = 0, rot = incl, sx = 1, sy = 1, op = 1;
  const rs = (n: NomRessort) => ressort(ressortNom ?? n, k);
  if (entree === "pop") { const p = rs("POP"); sx = sy = 0.3 + 0.7 * p; rot = incl - 6 * (1 - p); op = courbe(k, 0, 2); }
  else if (entree === "chute") { const p = rs("CHUTE"); ty = -0.4 * H * (1 - p); rot = incl - 5 * (1 - p); }
  else if (entree === "coteD") { const p = rs("CHUTE"); tx = W * (1 - p); rot = incl + 4 * (1 - p); }
  else if (entree === "coteG") { const p = rs("GLISSE"); tx = -W * (1 - p); rot = incl - 4 * (1 - p); }
  else if (entree === "bas") { const p = rs("CHUTE"); ty = 0.6 * H * (1 - p); rot = incl + 2 * (1 - p); }
  else if (entree === "etire") { const p = rs("GLISSE"); sx = 0.35 + 0.65 * p; }
  if (iSortie !== undefined && sortie !== "aucune") {
    const ks = i - iSortie;
    if (ks >= 0) {
      if (sortie === "retrecit") {
        if (ks >= 3) return null;
        const q = courbe(ks, 0, 3, sortieRetrecit); sx *= 1 - q; sy *= 1 - q;
      } else if (sortie === "remonte") {
        if (ks >= 3) return null;
        ty += -0.45 * H * courbe(ks, 0, 3, aspire);
      } else if (sortie === "vers" && vers) {
        if (ks >= 5) return null;
        const q = courbe(ks, 0, 5, aspire); tx += vers.dx * q; ty += vers.dy * q; sx *= lerp(1, vers.echelle, q); sy *= lerp(1, vers.echelle, q);
      } else if (sortie === "coteG") { if (ks >= 4) return null; tx += -1.1 * W * courbe(ks, 0, 4, aspire); }
      else if (sortie === "coteD") { if (ks >= 4) return null; tx += 1.1 * W * courbe(ks, 0, 4, aspire); }
      else if (sortie === "bas") { if (ks >= 4) return null; ty += 0.7 * H * courbe(ks, 0, 4, aspire); }
    }
  }
  const dy = delaiPop; // décalage éventuel (non utilisé en général)
  const pu = (iSortie === undefined || i < iSortie) ? pulsation(i, vie) : 1;
  sx *= pu; sy *= pu;
  return (
    <div data-objet={id ?? `${Math.round(x)}-${Math.round(y)}`} style={{ position: "absolute", left: x, top: y + dy, width: w, height: h, transformOrigin: origine, zIndex: z, opacity: op,
      transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) rotate(${rot.toFixed(3)}deg) scale(${sx.toFixed(4)}, ${sy.toFixed(4)}) ${extra ?? ""}` }}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ Prise qui descend (§ D.4) ------------------------------------------------------------------ */
export type ClePrise = { i: number; D: number };

/** Profondeur D de la prise à l'image `i` : descente = ressort DESCENTE, remontée = 4 i `out(back 1,3)`. Enchaîne sans saut. */
export function profondeurPrise(cles: ClePrise[], i: number): number {
  const trie = [...cles].sort((a, b) => a.i - b.i);
  const valeur = (n: number, t: number): number => {
    if (n < 0) return 0;
    const prev = valeur(n - 1, trie[n].i);
    const cible = trie[n].D;
    const k = t - trie[n].i;
    if (k <= 0) return prev;
    const p = cible >= prev ? ressort("DESCENTE", k) : courbe(k, 0, 4, Easing.out(Easing.back(1.3)));
    return lerp(prev, cible, p);
  };
  let n = -1;
  for (let j = 0; j < trie.length; j++) if (trie[j].i <= i) n = j;
  return valeur(n, i);
}

export type Fond = "prise" | "blanc" | "noir" | "broll";
export const FOND_BROLL = "broll/broll-bureau-ordinateur.mp4";

/** Fond du plan : bande IVOIRE + la prise de Will (seule transformation : translateY). Pour le test des 4 fonds, `fond` remplace la prise
 *  par un aplat ou un B-roll, qui descend de la même façon ; en production on ne touche JAMAIS au fond de la prise. */
export function Prise({ D, depart = 0, fond = "prise" }: { D: number; depart?: number; fond?: Fond }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: COULEURS.IVOIRE, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `translateY(${(D * H).toFixed(2)}px)`, background: fond === "blanc" ? "#FFFFFF" : fond === "noir" ? "#111111" : undefined }}>
        {fond === "prise" ? <OffthreadVideo src={mediaV4("prise-commune-15s.mp4")} startFrom={depart} style={{ width: W, height: H, objectFit: "cover" }} /> : null}
        {fond === "broll" ? <OffthreadVideo src={mediaV4(FOND_BROLL)} muted style={{ width: W, height: H, objectFit: "cover" }} /> : null}
      </div>
    </div>
  );
}

/** Surface ENCRE : liseré IVOIRE_CLAIR de 3 px entre le contour et l'ombre dure, pour que la forme reste lisible sur un fond sombre (test des 4 fonds). */
export const liserePlaque = (t: "S" | "M" | "L"): string => `0 0 0 3px ${COULEURS.IVOIRE_CLAIR}, ${OMBRE[t][0]}px ${OMBRE[t][1]}px 0 3px ${E}`;

/* ------------------------------------------------------------------ Primitives (§ B.7) ------------------------------------------------------------------ */
export function Plaque({ fond, texte = E, corps, children, incl = 0, style, ombreT = "S", bord = TRAIT.MOYEN }: {
  fond: string; texte?: string; corps: number; children: ReactNode; incl?: number; style?: CSSProperties; ombreT?: "S" | "M" | "L"; bord?: number;
}) {
  return (
    <div style={{ display: "inline-block", boxSizing: "border-box", background: fond, color: texte, border: `${bord}px solid ${E}`, borderRadius: RAYON.PLAQUE,
      boxShadow: fond === E ? liserePlaque(ombreT) : ombre(ombreT), padding: `${(0.16 * corps).toFixed(1)}px ${(0.3 * corps).toFixed(1)}px`, fontFamily: MONTSERRAT, fontWeight: 900, fontSize: corps,
      lineHeight: 1, letterSpacing: "0.01em", textTransform: "uppercase", whiteSpace: "nowrap", transform: `rotate(${incl}deg)`, ...style }}>
      {children}
    </div>
  );
}

/** Carte (M2/M3) : en-tête ACCENT_1 qui ne défile jamais, corps IVOIRE_CLAIR. Le contenu est rogné à l'intérieur ; `debord` (puces) est posé dehors. */
export function CoqueCarte({ palette, titre, droite, w, h, entete = 106, children, debord, corps = 38 }: {
  palette: Palette; titre: ReactNode; droite?: ReactNode; w: number; h: number; entete?: number; children?: ReactNode; debord?: ReactNode; corps?: number;
}) {
  const { ACCENT_1 } = accents(palette);
  return (
    <div style={{ position: "relative", width: w, height: h }}>
      <div style={{ position: "absolute", inset: 0, boxSizing: "border-box", border: `${TRAIT.FORT}px solid ${E}`, borderRadius: RAYON.CARTE, boxShadow: ombre("M"), background: COULEURS.IVOIRE_CLAIR, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: entete, boxSizing: "border-box", background: ACCENT_1, borderBottom: `${TRAIT.MOYEN}px solid ${E}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 30px", zIndex: 3 }}>
          <div style={{ fontFamily: MONTSERRAT, fontWeight: 900, fontSize: corps, letterSpacing: "0.04em", color: E, textTransform: "uppercase", whiteSpace: "nowrap" }}>{titre}</div>
          {droite}
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: entete, bottom: 0 }}>{children}</div>
      </div>
      {debord}
    </div>
  );
}

/** Coche (trait ENCRE) qui se trace : `p` de 0 à 1. */
export function Coche({ taille, p, couleur = E, epaisseur = 8 }: { taille: number; p: number; couleur?: string; epaisseur?: number }) {
  const L = 60;
  return (
    <svg width={taille} height={taille} viewBox="0 0 52 52" style={{ display: "block", overflow: "visible" }}>
      <path d="M11 27 L22 38 L42 14" fill="none" stroke={couleur} strokeWidth={epaisseur * (52 / taille) * 0.75} strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={L} strokeDashoffset={L * (1 - p)} />
    </svg>
  );
}

/** Étoile à 5 branches (SVG), contour ENCRE. */
export function Etoile({ taille, fond, trait = TRAIT.MOYEN }: { taille: number; fond: string; trait?: number }) {
  const pts: string[] = [];
  for (let k = 0; k < 10; k++) {
    const r = k % 2 === 0 ? 1 : 0.43;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    pts.push(`${(50 + 46 * r * Math.cos(a)).toFixed(2)},${(52 + 46 * r * Math.sin(a)).toFixed(2)}`);
  }
  return (
    <svg width={taille} height={taille} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible" }}>
      <polygon points={pts.join(" ")} fill={fond} stroke={E} strokeWidth={trait * (100 / taille) * 1.1} strokeLinejoin="round" />
    </svg>
  );
}

/** Étiquette générique au-dessus de la tête (version locale de `EtiquetteTete`) : plaque + sur-étiquette optionnelle. */
export function EtiquetteTete({ i, i0, iSortie, palette, texte, sur, alt = false, incl = -3, y = 150, corps = 66, x }: {
  i: number; i0: number; iSortie: number; palette: Palette; texte: string; sur?: string; alt?: boolean; incl?: number; y?: number; corps?: number; x?: number;
}) {
  const { ACCENT_1 } = accents(palette);
  const largeur = Math.min(0.88 * W, Math.round(texte.length * 0.74 * corps + 0.6 * corps));
  const gauche = x ?? Math.round((W - largeur) / 2);
  return (
    <>
      <Anim i={i} i0={i0} iSortie={iSortie} incl={incl} x={gauche} y={y} w={largeur} origine="50% 50%" z={4} vie={{ debut: i0 + 8 }} id="etiquette">
        <Plaque fond={alt ? COULEURS.BLANC : ACCENT_1} corps={corps} incl={0} style={{ width: largeur, textAlign: "center" }}>{texte}</Plaque>
      </Anim>
      {sur ? (
        <Anim i={i} i0={i0 + 4} iSortie={iSortie} incl={-1.5} x={gauche + 0.04 * W} y={y - 0.55 * 38 - 18} origine="0% 100%" z={5}>
          <Plaque fond={E} texte={COULEURS.BLANC} corps={38}>{sur}</Plaque>
        </Anim>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ Sous-titres v4 (§ C) ------------------------------------------------------------------ */
export type MotDemo = { mot: string; debut: number; fin: number; fort?: boolean; chiffre?: boolean };

/** Groupes de 1 à 2 mots (3 si le 3ᵉ fait ≤ 3 lettres) ; un mot de liaison n'est jamais seul. */
export function grouper(mots: MotDemo[]): MotDemo[][] {
  const g: MotDemo[][] = [];
  let k = 0;
  while (k < mots.length) {
    const cur = [mots[k]];
    if (k + 1 < mots.length) cur.push(mots[k + 1]);
    if (k + 2 < mots.length && mots[k + 2].mot.length <= 3 && cur.length === 2) cur.push(mots[k + 2]);
    g.push(cur);
    k += cur.length;
  }
  return g;
}

export type CleSt = { i: number; y: number; carte?: number };
/** Mots affichés par un objet posé (étiquette, carte) entre les images absolues `i0` et `i1` : le sous-titre ne les répète pas. */
export type Muet = { mots: string[]; i0: number; i1: number };

/** Bande des yeux (fractions de H) à D = 0 : [0,27 ; 0,36]. Elle descend avec la prise. */
export const OEIL = { haut: 0.27, bas: 0.36, marge: 0.015 };
/** Position D à partir de laquelle un gabarit « carte » (sous-titre entre la carte et le visage) est valable. */
export const D_CARTE = 0.2;

/**
 * Centre vertical (fraction de H) des sous-titres à l'image `i`, calculé à partir de la profondeur RÉELLE `D` de la prise à cette image :
 * le gabarit « carte » (`carte`) n'est pris que lorsque D ≥ 0,20 ; puis la boîte (hauteur `h`, fraction de H) ne coupe JAMAIS la bande des yeux :
 * sinon elle passe sous les yeux, ou au-dessus, ou le groupe est masqué (null).
 */
export function ySt(cles: CleSt[], i: number, D: number, h: number): number | null {
  let c = cles[0];
  for (const k of [...cles].sort((a, b) => a.i - b.i)) if (k.i <= i) c = k;
  let y = Math.min(Y_ST_MAX, Math.max(Y_ST_MIN, c.carte !== undefined && D >= D_CARTE ? c.carte : c.y)); // zone sûre TikTok / Reels / Shorts
  const haut = OEIL.haut + D - OEIL.marge, bas = OEIL.bas + D + OEIL.marge;
  if (y + h / 2 > haut && y - h / 2 < bas) {
    const dessous = bas + h / 2;
    const dessus = haut - h / 2;
    if (dessous + h / 2 <= 1 - ZONE_SURE_916.bas) y = dessous;
    else if (dessus - h / 2 >= ZONE_SURE_916.haut) y = dessus;
    else return null;
  }
  return y;
}

const norme = (m: string): string => m.toUpperCase().replace(/[^A-ZÀ-ÖØ-Þ0-9']/g, "");

export function SousTitresV4({ mots, palette, cles, prise, muets = [] }: { mots: MotDemo[]; palette: Palette; cles: CleSt[]; prise: ClePrise[]; muets?: Muet[] }) {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const groupes = useMemo(() => grouper(mots), [mots]);
  const { ACCENT_1, ACCENT_2 } = accents(palette);
  let gi = -1;
  for (let k = 0; k < groupes.length; k++) if (groupes[k][0].debut <= t + 1e-6) gi = k;
  if (gi < 0) return null;
  const complet = groupes[gi];
  const finDernier = complet[complet.length - 1].fin + 0.35;
  const fin = gi + 1 < groupes.length ? Math.min(groupes[gi + 1][0].debut, finDernier) : finDernier;
  if (t >= fin) return null;
  // mots déjà écrits par un objet posé : pas de doublon sous-titre / étiquette
  const actifs = new Set(muets.filter((m) => frame >= m.i0 && frame < m.i1).flatMap((m) => m.mots.map(norme)));
  const groupe = complet.filter((m) => !actifs.has(norme(m.mot)));
  if (groupe.length === 0 || groupe.every((m) => m.mot.length <= 3 && !m.chiffre)) return null;
  const nbCar = groupe.reduce((s, m) => s + m.mot.length, 0);
  const nbPlaques = groupe.filter((m) => m.fort || m.chiffre).length;
  let corps = 84;
  const largeurEst = (c: number) => nbCar * 0.86 * c + (groupe.length - 1) * 0.3 * c + nbPlaques * 0.55 * c;
  if (largeurEst(corps) > 0.88 * W) corps = Math.max(62, Math.floor((corps * 0.88 * W) / largeurEst(corps)));
  const hBox = corps * 1.5;
  const D = profondeurPrise(prise, frame);
  const y = ySt(cles, frame, D, hBox / H);
  if (y === null) return null;
  const yc = y * H;
  const dernier = groupe.reduce((n, m, idx) => (complet.indexOf(m) >= 0 && m.debut <= t + 1e-6 ? idx : n), 0);
  return (
    <div data-st="1" style={{ position: "absolute", left: 0, width: W, top: yc - hBox / 2, height: hBox, display: "flex", justifyContent: "center", alignItems: "center", gap: corps * 0.3, zIndex: 900 }}>
      {groupe.map((m, idx) => {
        const i = frame - Math.round(m.debut * FPS);
        const visible = i >= 0;
        const plaque = m.fort || m.chiffre;
        const p = ressort("POP", i);
        const echelle = visible ? 0.5 + 0.5 * p : 0.5;
        const opacite = visible ? courbe(i, 0, 1) : 0;
        const couleurTexte = plaque ? E : idx === dernier ? ACCENT_1 : COULEURS.BLANC;
        const incl = (gi % 2 === 0 ? -2 : 1.5);
        // la plaque part de 0,6 de sa largeur (jamais un carré vide, le texte à l'échelle 0,6 y tient) et le texte pop dans la MÊME image
        const etire = visible ? 0.6 + 0.4 * ressort("GLISSE", i) : 0.6;
        const texteP = visible ? ressort("POP", i) : 0;
        return (
          <div key={idx} style={{ position: "relative", flexShrink: 0, opacity: opacite, transform: `rotate(${plaque ? incl : 0}deg) scale(${plaque ? 1 : echelle.toFixed(3)})`, transformOrigin: "50% 50%" }}>
            {plaque ? (
              <>
                <div style={{ position: "absolute", inset: 0, boxSizing: "border-box", background: m.chiffre ? ACCENT_2 : ACCENT_1, border: `${TRAIT.MOYEN}px solid ${E}`, borderRadius: RAYON.PLAQUE,
                  boxShadow: ombre("S"), transform: `scaleX(${Math.min(1, etire).toFixed(3)})`, transformOrigin: "0% 50%" }} />
                <div style={{ position: "relative", padding: `${(0.1 * corps).toFixed(1)}px ${(0.24 * corps).toFixed(1)}px`, fontFamily: MONTSERRAT, fontWeight: 900, fontSize: corps, lineHeight: 1,
                  letterSpacing: "0.01em", color: E, whiteSpace: "nowrap", transform: `scale(${(0.6 + 0.4 * texteP).toFixed(3)})`, opacity: visible ? 1 : 0 }}>{m.mot}</div>
              </>
            ) : (
              <div style={{ fontFamily: MONTSERRAT, fontWeight: 900, fontSize: corps, lineHeight: 1, letterSpacing: "0.01em", color: couleurTexte, whiteSpace: "nowrap",
                ...contourTexte(corps), filter: `drop-shadow(4px 5px 0 ${E})` }}>{m.mot}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Aides diverses ------------------------------------------------------------------ */
const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
/** Interpolation directe de deux couleurs #rrggbb (recoloration sans fondu d'opacité). */
export function melange(a: string, b: string, p: number): string {
  const [r1, g1, b1] = hex(a), [r2, g2, b2] = hex(b);
  const q = Math.max(0, Math.min(1, p));
  return `rgb(${Math.round(lerp(r1, r2, q))}, ${Math.round(lerp(g1, g2, q))}, ${Math.round(lerp(b1, b2, q))})`;
}
