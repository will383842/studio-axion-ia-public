import React from "react";
/**
 * BRIQUES COMMUNES du lot 4 « Fenêtres vidéo » (standard DA v4 du 16/10, §§ A à D). Version LOCALE : l'intégration fusionnera
 * ces primitives avec celles des autres lots (jetons du § B.1 recopiés à l'identique). Style v4 : aplats, contours encre,
 * ombres dures sans flou, capitales Montserrat Black. Aucun verre, aucun dégradé, aucune perspective, aucun flou.
 *
 * Tout est piloté par des IMAGES (30 i/s) locales à l'élément : `f = 0` est l'image où le mot déclencheur commence (i0).
 */
import { Audio, Easing, interpolate, OffthreadVideo, Sequence, spring } from "remotion";
import type { CSSProperties, ReactNode } from "react";
import { continueRender, delayRender } from "remotion";
import { GAIN_BRUITAGES, mediaV4 } from "../communs/medias-v4";
import { placerDansZoneSure, Y_ST_MAX, Y_ST_MIN } from "../communs/zone-sure-v4";
import montserratBlack from "./polices/Montserrat-Black.ttf";

export const FPS = 30;
export const L = 1080;
export const H = 1920;

/* ------------------------------------------------------------------ Jetons (§ B.1) ------------------------------------------------------------------ */
import { COULEURS, accents, TRAIT, OMBRE, RAYON, DESCENTE } from "../communs/briques-v4";
import type { Palette } from "../communs/briques-v4";
export { COULEURS, accents, TRAIT, OMBRE, RAYON, DESCENTE };
export type { Palette };
const { ENCRE, IVOIRE, BLANC, GRIS } = COULEURS;

export const ombre = (taille: "S" | "M" | "L", k = 1): string => `${OMBRE[taille][0] * k}px ${OMBRE[taille][1] * k}px 0 0 ${ENCRE}`;

/* ------------------------------------------------------------------ Police ------------------------------------------------------------------ */
export const MONTSERRAT = "Axion Montserrat Black";
export const INTER = "Inter, 'Axion Inter Bold', system-ui, sans-serif";
let chargement: Promise<void> | null = null;
/** Charge Montserrat Black (SIL OFL 1.1) en local ; le rendu attend la police (jamais une police de secours). */
export function chargerMontserratBlack(): void {
  if (chargement || typeof document === "undefined") return;
  const attente = delayRender("Police Montserrat Black");
  const face = new FontFace(MONTSERRAT, `url(${montserratBlack})`, { weight: "900" });
  chargement = face.load().then((f) => {
    document.fonts.add(f);
    continueRender(attente);
  });
}

/* ------------------------------------------------------------------ Ressorts (§ D.1) ------------------------------------------------------------------ */
export const RESSORTS = {
  POP: { damping: 14, stiffness: 300, mass: 0.6 },
  CHUTE: { damping: 18, stiffness: 320, mass: 0.8 },
  CLAQUE: { damping: 20, stiffness: 500, mass: 0.5 },
  DESCENTE: { damping: 20, stiffness: 300, mass: 0.7 },
  GLISSE: { damping: 28, stiffness: 400, mass: 0.6 },
} as const;
export type NomRessort = keyof typeof RESSORTS;
/** Ressort 0 → 1 (dépasse ≈ 1 selon le nom) `f - delai` images après son départ ; avant : 0. */
export function ress(nom: NomRessort, f: number, delai = 0): number {
  const k = f - delai;
  if (k <= 0) return 0;
  return spring({ frame: k, fps: FPS, config: RESSORTS[nom] });
}
export const lerp = (a: number, b: number, p: number): number => a + (b - a) * p;
export const borne = (v: number, a = 0, b = 1): number => Math.min(b, Math.max(a, v));
/** Progression 0 → 1 en `n` images à partir de `f0` (avec un easing). */
export function prog(f: number, f0: number, n: number, easing: (x: number) => number = (x) => x): number {
  return interpolate(f, [f0, f0 + n], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
}
export const aspire = Easing.in(Easing.cubic);
/** Secousse amortie de l'ÉLÉMENT (jamais de la prise) : A · e^(−k/3) · sin(2πk/3), k images après l'arrêt. */
export function secousse(k: number, amplitude: number): number {
  if (k < 0 || k > 12) return 0;
  return amplitude * Math.exp(-k / 3) * Math.sin((2 * Math.PI * k) / 3);
}
/** Sortie « S-RETRECIT » : échelle 1 → 0 en `n` images, Easing.in(back(1.6)). Renvoie null quand c'est fini (aucun reste). */
export function retrecit(f: number, f0: number, n = 3): number | null {
  if (f < f0) return 1;
  if (f >= f0 + n) return null;
  return 1 - interpolate(f, [f0, f0 + n], [0, 1], { easing: Easing.in(Easing.back(1.6)) });
}

/* ------------------------------------------------------------------ Bruitages ------------------------------------------------------------------ */
export type SonPlan = { f: number; nom: string; volume?: number };
/** Crête mesurée (dBFS, `volumedetect`) de chaque bruitage utilisé : le gain les ramène à −18 dBFS (R13 : crêtes ≤ −12 dBFS, voix de Will à −12,9). */
const CRETES_SONS: Record<string, number> = { "whoosh-in": -16.2, "whoosh-out": -19.3, maximize_004: -3.9, maximize_006: -3.9, minimize_004: -4.0, drop_001: -0.9, drop_002: -1.1, select_001: -1.1, select_002: -0.9, tick_001: -2.5, tick_002: -1.9, vibreur: -1.4 };
export const CIBLE_SONS_DB = -18;
export const gainSon = (nom: string): number => Math.min(1, Math.pow(10, (CIBLE_SONS_DB - (CRETES_SONS[nom] ?? -3)) / 20));
/** Les fichiers viennent de `sons/` (Kenney CC0 + fabriqués Axion-IA). `f` en images locales. */
export function Sons({ liste, decalage = 0 }: { liste: SonPlan[]; decalage?: number }) {
  return (
    <>
      {liste.map((s, k) => (
        <Sequence key={`${s.nom}-${k}`} from={Math.max(0, Math.round(s.f + decalage))} layout="none">
          <Audio src={mediaV4(`sons/${s.nom}.wav`)} volume={(s.volume ?? 1) * gainSon(s.nom) * GAIN_BRUITAGES} />
        </Sequence>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ Vidéos ------------------------------------------------------------------ */
/** B-roll en « cover », SANS échelle ni zoom, qui démarre à `depuisSec` de la source. `nom` = fichier de `broll/`. */
export function Clip({ nom, depuisSec = 0.3, style, gris }: { nom: string; depuisSec?: number; style?: CSSProperties; gris?: boolean }) {
  return (
    <OffthreadVideo
      src={mediaV4(`broll/${nom}`)}
      muted
      startFrom={Math.round(depuisSec * FPS)}
      style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", objectFit: "cover", filter: gris ? "grayscale(1) contrast(1.08)" : undefined, ...style }}
    />
  );
}

/* ------------------------------------------------------------------ Plaque / Puce (§ B.7) ------------------------------------------------------------------ */
const styleTexteMontserrat = (corps: number): CSSProperties => ({ fontFamily: MONTSERRAT, fontWeight: 900, fontSize: corps, lineHeight: 1, textTransform: "uppercase", letterSpacing: "0.01em", whiteSpace: "nowrap" });

/** `Plaque` : rayon 10, contour 5, ombre S, padding 0,16 em × 0,30 em. */
export function Plaque(p: { texte: ReactNode; fond: string; couleur?: string; corps?: number; inclinaison?: number; style?: CSSProperties; sansOmbre?: boolean }) {
  const corps = p.corps ?? 60;
  return (
    <div
      style={{
        ...styleTexteMontserrat(corps),
        display: "inline-block",
        boxSizing: "border-box",
        padding: `${0.16 * corps}px ${0.3 * corps}px`,
        background: p.fond,
        color: p.couleur ?? ENCRE,
        border: `${TRAIT.MOYEN}px solid ${ENCRE}`,
        borderRadius: RAYON.PLAQUE,
        boxShadow: p.sansOmbre ? undefined : ombre("S"),
        transform: `rotate(${p.inclinaison ?? 0}deg)`,
        ...p.style,
      }}
    >
      {p.texte}
    </div>
  );
}

/** `Puce` : pilule ronde, contour 5, ombre S. */
export function Puce(p: { texte: ReactNode; fond: string; couleur?: string; corps?: number; inclinaison?: number; style?: CSSProperties }) {
  const corps = p.corps ?? 38;
  return (
    <div
      style={{
        ...styleTexteMontserrat(corps),
        display: "inline-block",
        boxSizing: "border-box",
        padding: `${0.3 * corps}px ${0.65 * corps}px`,
        background: p.fond,
        color: p.couleur ?? ENCRE,
        border: `${TRAIT.MOYEN}px solid ${ENCRE}`,
        borderRadius: RAYON.PILULE,
        boxShadow: ombre("S"),
        transform: `rotate(${p.inclinaison ?? 0}deg)`,
        ...p.style,
      }}
    >
      {p.texte}
    </div>
  );
}

/** Pose un enfant centré sur (x, y) (px de l'image), avec une transformation CSS (échelle, rotation…) autour de son centre. */
export function Ancre({ x, y, transform, children, style }: { x: number; y: number; transform?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) ${transform ?? ""}`, transformOrigin: "50% 50%", ...style }}>{children}</div>
  );
}

/** Étiquette qui chevauche un bord : pop (`POP`, E-POP) puis sortie S-RETRECIT. `fin` = image où commence la sortie. */
export function EtiquetteBord(p: { f: number; debut: number; fin?: number; x: number; y: number; texte: ReactNode; fond: string; couleur?: string; corps?: number; inclinaison: number; transformPlus?: string; largeurMin?: number; pulses?: number[] }) {
  const k = p.f - p.debut;
  if (k < 0) return null;
  const sortie = p.fin === undefined ? 1 : retrecit(p.f, p.fin, 3);
  if (sortie === null) return null;
  const pulse = 1 + (p.pulses ?? []).reduce((a, pf) => a + 0.08 * Math.sin(Math.PI * borne((p.f - pf) / 6)), 0);
  const e = lerp(0.3, 1, ress("POP", p.f, p.debut)) * sortie * pulse;
  const rot = p.inclinaison + lerp(-6, 0, borne(ress("POP", p.f, p.debut)));
  return (
    <Ancre x={p.x} y={p.y} transform={`${p.transformPlus ?? ""} scale(${e.toFixed(3)}) rotate(${rot.toFixed(2)}deg)`} style={{ opacity: borne(k / 2) }}>
      <Plaque texte={p.texte} fond={p.fond} couleur={p.couleur} corps={p.corps ?? 60} style={p.largeurMin ? { minWidth: p.largeurMin, textAlign: 'center' } : undefined} />
    </Ancre>
  );
}

/** Traits d'impact ENCRE (12 × 0,05 L) qui jaillissent d'un point en 4 i puis disparaissent, sans flou : `f0` = image du choc. */
export function Impact({ f, f0, x, y, angles, r0 = 40 }: { f: number; f0: number; x: number; y: number; angles: number[]; r0?: number }) {
  const k = f - f0;
  if (k < 0 || k > 6) return null;
  const p = prog(k, 0, 4, Easing.out(Easing.cubic));
  const long = 0.05 * L * (1 - 0.35 * borne((k - 4) / 2));
  return (
    <>
      {angles.map((a, i) => (
        <div key={i} style={{ position: "absolute", left: x, top: y, width: long, height: 12, borderRadius: 6, background: ENCRE, transform: `rotate(${a}deg) translateX(${lerp(r0, r0 + 62, p)}px) translateX(-50%)`, transformOrigin: "0 50%", opacity: k > 5 ? 0 : 1 }} />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ CoqueFenetre (§ B.7) ------------------------------------------------------------------ */
/**
 * Fenêtre vidéo : rayon 22, contour 7 ENCRE (intérieur), ombre L dure, contenu clipsé par les coins. `rot` en degrés autour du centre.
 * Le contour est dessiné par-dessus le contenu (calque dédié) : le contenu occupe toute la boîte et ne se décale jamais.
 */
export function CoqueFenetre(p: { x: number; y: number; l: number; h: number; rot?: number; rayon?: number; bord?: number; ombreK?: number; tx?: number; ty?: number; fond?: string; children?: ReactNode; dessus?: ReactNode; origine?: string; echelle?: number }) {
  const bord = p.bord ?? TRAIT.FORT;
  const rayon = p.rayon ?? RAYON.FENETRE;
  return (
    <div
      style={{
        position: "absolute",
        left: p.x,
        top: p.y,
        width: p.l,
        height: p.h,
        borderRadius: rayon,
        boxShadow: (p.ombreK ?? 1) > 0.02 ? ombre("L", p.ombreK ?? 1) : undefined,
        transform: `translate(${p.tx ?? 0}px, ${p.ty ?? 0}px) rotate(${p.rot ?? 0}deg) scale(${(p.echelle ?? 1).toFixed(4)})`,
        transformOrigin: p.origine ?? "50% 50%",
        background: p.fond ?? ENCRE,
      }}
    >
      <div style={{ position: "absolute", inset: 0, borderRadius: rayon, overflow: "hidden" }}>{p.children}</div>
      {bord > 0.1 ? <div style={{ position: "absolute", inset: 0, borderRadius: rayon, border: `${bord}px solid ${ENCRE}`, boxSizing: "border-box", pointerEvents: "none" }} /> : null}
      {p.dessus}
    </div>
  );
}

/* ------------------------------------------------------------------ Prise et descente (§ D.4) ------------------------------------------------------------------ */
export type SegDescente = { de: number; D: number };
/** Valeur de la descente D (fraction de H) à l'image `f` : ressort `DESCENTE` en descente, retour `Easing.out(back(1.3))` en 4 i à la remontée. */
export function valeurDescente(f: number, segs: SegDescente[]): number {
  let from = 0;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (f < s.de) break;
    const suivant = segs[i + 1]?.de ?? Infinity;
    const k = Math.min(f, suivant) - s.de;
    const p = s.D >= from ? ress("DESCENTE", k) : prog(k, 0, 4, Easing.out(Easing.back(1.3)));
    const v = from + (s.D - from) * p;
    if (f < suivant) return v;
    from = v;
  }
  return from;
}

/**
 * La prise de Will (vidéo 1080×1920 avec sa voix), plein cadre, AUCUNE échelle : seule `translateY(D × 1920)` est permise. La bande
 * révélée en haut est IVOIRE, sans ombre ni filet. `debutSec` = point de départ dans la prise de 15 s.
 */
export function Prise({ debutSec, descente, volume = 1 }: { debutSec: number; descente: number; volume?: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: IVOIRE, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: L, height: H, transform: `translateY(${(descente * H).toFixed(2)}px)` }}>
        <OffthreadVideo src={mediaV4("prise-commune-15s.mp4")} startFrom={Math.round(debutSec * FPS)} volume={volume} style={{ width: L, height: H, objectFit: "cover" }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Barre de progression (§ B.7) ------------------------------------------------------------------ */
export function BarreProgression({ f, total, palette }: { f: number; total: number; palette: Palette }) {
  const w = borne(f / total) * L;
  const { ACCENT_1 } = accents(palette);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: L, height: 10, background: ENCRE, zIndex: 50 }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: w, height: 10, background: ACCENT_1 }} />
      <div style={{ position: "absolute", left: Math.max(0, w - 4), top: 0, width: 4, height: 10, background: BLANC }} />
    </div>
  );
}

/* ------------------------------------------------------------------ Étiquettes génériques (lot 1, version locale) ------------------------------------------------------------------ */
/** `EtiquetteTete` générique (M1, D1) : plaque 0,40-0,72 L au-dessus de la tête, éventuellement coiffée d'une sur-étiquette. */
export function EtiquetteTete(p: { f: number; debut: number; fin: number; palette: Palette; texte: string; sur?: string; blanc?: boolean; x?: number; inclinaison?: number; interjection?: boolean }) {
  const { ACCENT_1 } = accents(p.palette);
  const x = p.x ?? L / 2;
  const inc = p.inclinaison ?? -3;
  const y = 0.115 * H;
  const fond = p.interjection ? ENCRE : p.blanc ? BLANC : ACCENT_1;
  const couleur = p.interjection ? ACCENT_1 : ENCRE;
  const tremble = p.interjection ? secousse(p.f - p.debut - 6, 0.006 * L) : 0;
  return (
    <>
      <EtiquetteBord f={p.f} debut={p.debut} fin={p.fin} x={x + tremble} y={y} largeurMin={0.4 * L} texte={p.texte} fond={fond} couleur={couleur} corps={p.texte.length > 10 ? 70 : p.interjection ? 84 : 80} inclinaison={inc} />
      {p.sur ? <EtiquetteBord f={p.f} debut={p.debut + 4} fin={p.fin} x={x - 150} y={y - 78} texte={p.sur} fond={ENCRE} couleur={BLANC} corps={38} inclinaison={-1.5} /> : null}
    </>
  );
}

/* ------------------------------------------------------------------ Sous-titres v4 (§ C) ------------------------------------------------------------------ */
export type MotDemo = { mot: string; debut: number; fin: number; fort?: boolean; chiffre?: boolean };
type Groupe = { mots: MotDemo[]; debut: number; fin: number };

/** Regroupe en 1-2 mots (3 si le 3ᵉ ≤ 3 lettres) ; les mots de liaison ne restent jamais seuls. */
export function grouper(mots: MotDemo[]): Groupe[] {
  const out: Groupe[] = [];
  let i = 0;
  while (i < mots.length) {
    const g: MotDemo[] = [mots[i]];
    const long = (a: MotDemo[]) => a.reduce((s, m) => s + m.mot.length, 0) + a.length - 1;
    if (i + 1 < mots.length && long([mots[i], mots[i + 1]]) <= 15 && mots[i + 1].debut - mots[i].fin < 0.5) g.push(mots[i + 1]);
    if (g.length === 2 && i + 2 < mots.length && mots[i + 2].mot.length <= 3 && long([...g, mots[i + 2]]) <= 15 && mots[i + 2].debut - mots[i + 1].fin < 0.3) g.push(mots[i + 2]);
    out.push({ mots: g, debut: g[0].debut, fin: g[g.length - 1].fin });
    i += g.length;
  }
  for (let k = 0; k < out.length; k++) out[k].fin = k + 1 < out.length ? out[k + 1].debut : out[k].fin + 0.3;
  return out;
}

export type PositionSousTitres = { y: number; align?: "centre" | "gauche"; xGauche?: number };
/**
 * `SousTitresV4` : Montserrat 900, capitales, corps 84 (62 min), 1-2 mots. Trois états (dit blanc / en cours accent / mot fort sur plaque) +
 * plaque `ACCENT_2` pour un chiffre. Chaque mot POP (échelle 0,5 → 1 en 4 i). Remplacement du groupe : coupe sèche.
 * `position(f)` donne le centre vertical (px) ; la position change par coupe sèche, jamais par glissement.
 */
export function SousTitresV4({ f, mots, palette, position, exclure, masque }: { f: number; mots: MotDemo[]; palette: Palette; position: (f: number) => PositionSousTitres; exclure?: (m: MotDemo, f: number) => boolean; masque?: (f: number) => boolean }) {
  const groupes = React.useMemo(() => grouper(mots), [mots]);
  const t = f / FPS;
  const g = groupes.find((x) => t >= x.debut && t < x.fin);
  if (!g || (masque && masque(f))) return null; // `masque` : groupe caché ≤ 6 i pendant qu'un objet balaie sa place (ouverture du plein cadre)
  // un mot déjà affiché par une étiquette posée n'est pas répété en plaque dans le sous-titre
  if (exclure && g.mots.every((m) => exclure(m, f))) return null;
  const { ACCENT_1, ACCENT_2 } = accents(palette);
  const visibles = g.mots.filter((m) => t >= m.debut && !(exclure && exclure(m, f)));
  if (visibles.length === 0) return null;
  const dernier = visibles[visibles.length - 1];
  const total = g.mots.map((m) => m.mot).join(" ").length;
  const corps = Math.max(62, Math.min(84, Math.floor((0.88 * L) / (0.82 * (total + 1.2)))));
  const pos0 = position(f);
  const pos = { ...pos0, y: Math.min(Y_ST_MAX * H, Math.max(Y_ST_MIN * H, pos0.y)) }; // zone sûre TikTok / Reels / Shorts
  const contour = 0.14 * corps;
  const alignGauche = pos.align === "gauche";
  return (
    <div
      style={{
        position: "absolute",
        left: alignGauche ? pos.xGauche ?? 0.04 * L : 0,
        width: alignGauche ? undefined : L,
        top: pos.y,
        transform: "translateY(-50%)",
        display: "flex",
        justifyContent: alignGauche ? "flex-start" : "center",
        alignItems: "center",
        gap: 0.22 * corps,
        filter: `drop-shadow(${OMBRE.S[0] - 1}px ${OMBRE.S[1] - 1}px 0 ${ENCRE})`,
        zIndex: 40,
      }}
    >
      {visibles.map((m, k) => {
        const fm = Math.round(m.debut * FPS);
        const age = f - fm;
        const echelle = lerp(0.5, 1, ress("POP", f, fm));
        const enCours = m === dernier;
        const plaque = m.fort || m.chiffre;
        const fondPlaque = m.chiffre ? ACCENT_2 : ACCENT_1;
        const incl = k % 2 === 0 ? -2 : 1.5;
        const etire = plaque ? lerp(0.35, 1, ress("GLISSE", f, fm)) : 1;
        return (
          <div key={`${m.mot}-${m.debut}`} style={{ position: "relative", transform: `scale(${echelle.toFixed(3)}) rotate(${plaque ? incl : 0}deg)`, opacity: age >= 0 ? 1 : 0, transformOrigin: "50% 50%" }}>
            {plaque ? (
              <div style={{ position: "absolute", inset: `${-0.12 * corps}px ${-0.24 * corps}px`, background: fondPlaque, border: `${TRAIT.MOYEN}px solid ${ENCRE}`, borderRadius: RAYON.PLAQUE, boxShadow: ombre("S"), transform: `scaleX(${borne(etire).toFixed(3)})`, transformOrigin: "0% 50%", boxSizing: "border-box" }} />
            ) : null}
            <div
              style={{
                position: "relative",
                ...styleTexteMontserrat(corps),
                color: plaque ? ENCRE : enCours ? ACCENT_1 : BLANC,
                WebkitTextStroke: plaque ? undefined : `${contour}px ${ENCRE}`,
                paintOrder: "stroke fill",
                opacity: 1,
                padding: plaque ? `0 ${0.24 * corps}px` : undefined,
                transform: plaque ? `scale(${lerp(0.5, 1, ress("POP", f, fm)).toFixed(3)})` : undefined,
              }}
            >
              {m.mot}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Mots de démonstration calés sur la voix ------------------------------------------------------------------ */
/** Segments de parole de la prise de 15 s (secondes absolues, détectés au silencedetect −35 dB / 0,12 s). */
export const SEGMENTS_VOIX: ReadonlyArray<[number, number]> = [
  [0.0, 0.74],
  [1.405, 3.13],
  [3.377, 3.853],
  [3.99, 4.097],
  [4.55, 5.373],
  [5.95, 7.348],
  [7.6, 7.837],
  [8.004, 8.254],
  [8.551, 8.682],
  [8.807, 8.846],
  [9.472, 10.127],
  [10.588, 11.674],
  [11.819, 12.302],
  [12.445, 12.658],
  [13.11, 15.0],
];
export type MotBrut = { mot: string; fort?: boolean; chiffre?: boolean };
/**
 * Distribue les mots d'une phrase PLAUSIBLE sur la parole réelle de la prise entre `depart` et `depart + duree` (secondes de la prise) :
 * les mots tombent seulement dans les segments de voix, proportionnellement à leur longueur. Sortie en secondes LOCALES (0 = `depart`).
 * ATTENTION : ce ne sont pas les vrais mots de Will (aucune transcription disponible) — calage « à l'œil ».
 */
export function motsSurVoix(mots: MotBrut[], depart: number, duree: number): MotDemo[] {
  const segs: Array<[number, number]> = [];
  for (const [a, b] of SEGMENTS_VOIX) {
    const x = Math.max(a, depart);
    const y = Math.min(b, depart + duree);
    if (y - x > 0.05) segs.push([x, y]);
  }
  const poids = mots.map((m) => m.mot.length + 2);
  const out: MotDemo[] = [];
  let seg = 0;
  let curseur = segs[0]?.[0] ?? depart;
  mots.forEach((m, i) => {
    const resteParole = (): number => segs.reduce((acc, [a, b], k) => (k < seg ? acc : acc + (b - Math.max(a, k === seg ? curseur : a))), 0);
    const resteMots = poids.slice(i).reduce((a, b) => a + b, 0);
    let dur = (resteParole() * poids[i]) / resteMots;
    // un mot ne démarre pas à la toute fin d'un segment de voix : il attend le segment suivant (jamais de mot tenu à travers un silence)
    while (seg < segs.length - 1 && segs[seg][1] - Math.max(curseur, segs[seg][0]) < Math.min(0.6 * dur, 0.12)) {
      seg++;
      curseur = segs[seg][0];
      dur = (resteParole() * poids[i]) / resteMots;
    }
    const debut = curseur;
    let restant = dur;
    let fin = curseur;
    while (restant > 1e-6 && seg < segs.length) {
      const dispo = segs[seg][1] - Math.max(curseur, segs[seg][0]);
      if (dispo >= restant) {
        fin = Math.max(curseur, segs[seg][0]) + restant;
        curseur = fin;
        restant = 0;
      } else {
        restant -= dispo;
        seg++;
        curseur = segs[seg]?.[0] ?? curseur;
        fin = segs[Math.min(seg, segs.length - 1)]?.[0] ?? fin;
      }
    }
    dur = fin - debut;
    out.push({ mot: m.mot, debut: +(debut - depart).toFixed(3), fin: +(fin - depart).toFixed(3), fort: m.fort, chiffre: m.chiffre });
  });
  return out;
}

/* ------------------------------------------------------------------ Couverture du visage (contrôle E4) ------------------------------------------------------------------ */
export type Rect = { x0: number; y0: number; x1: number; y1: number };
/** Visage de Will mesuré sur la prise (§ 0.5) : cheveux 0,14 H, menton 0,49 H, x 0,27 → 0,76 L. */
export const VISAGE: Rect = { x0: 0.27 * L, y0: 0.14 * H, x1: 0.76 * L, y1: 0.49 * H };
/** Part (0 → 1) du visage recouverte par l'union des rectangles opaques (échantillonnage 24 × 24). */
export function partCouverte(rects: Rect[], D = 0): number {
  const n = 24;
  let c = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x = VISAGE.x0 + ((i + 0.5) / n) * (VISAGE.x1 - VISAGE.x0);
      const y = VISAGE.y0 + D * H + ((j + 0.5) / n) * (VISAGE.y1 - VISAGE.y0);
      if (rects.some((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1)) c++;
    }
  return c / (n * n);
}

/** Rectangle englobant d'un rectangle (x, y, l, h) tourné de `rot` degrés autour de son centre. */
export function rectTourne(x: number, y: number, l: number, h: number, rot: number, tx = 0, ty = 0): Rect {
  const r = (rot * Math.PI) / 180;
  const w2 = (Math.abs(l * Math.cos(r)) + Math.abs(h * Math.sin(r))) / 2;
  const h2 = (Math.abs(l * Math.sin(r)) + Math.abs(h * Math.cos(r))) / 2;
  const cx = x + l / 2 + tx;
  const cy = y + h / 2 + ty;
  return { x0: cx - w2, y0: cy - h2, x1: cx + w2, y1: cy + h2 };
}

/** Description commune d'un élément : durée, événements graphiques, couverture du visage. */
export type MesuresElement = {
  /** images (relatives à i0) où un événement graphique a lieu (hors sous-titres) */
  evenements: number[];
  /** rectangles opaques qui couvrent l'image à l'image `f` (pour la mesure du visage) */
  couvre: (f: number, duree: number) => Rect[];
};

/** Encre en chaîne de caractères (pour les calques de contour). */
export const ENCRE_BORD = COULEURS.ENCRE;

/* ------------------------------------------------------------------ Tour 2 : marges et sous-titres hors des yeux ------------------------------------------------------------------ */
/** Largeur estimée (px) d'une puce/étiquette de corps `corps` (Montserrat Black ≈ 0,80 em par lettre + padding de la `Plaque`). */
export const largeurEtiquette = (texte: string, corps: number): number => texte.length * 0.8 * corps + 0.6 * corps + 2 * TRAIT.MOYEN;
/** Centre x d'une étiquette ramené dans les marges 0,05 L (R5 : jamais de texte au bord), compte tenu de sa largeur. */
export const bornePuce = (x: number, texte: string, corps: number, marge = 0.05 * L): number => {
  const demi = largeurEtiquette(texte, corps) / 2;
  return Math.min(L - marge - demi, Math.max(marge + demi, x));
};
/** Yeux de Will sur la prise (y 0,25 → 0,38 H) décalés de la descente réelle `D(t)`. */
export const YEUX = { y0: 0.25, y1: 0.38 };
/**
 * Position du centre des sous-titres calculée à CHAQUE image depuis la descente réelle `D` : si la boîte du sous-titre (± 0,035 H) touche les yeux
 * (marge 0,02 H), elle est poussée sous le menton (0,60 H + D) ; coupe sèche, jamais de glissement.
 */
export function ySousTitresSurYeux(y: number, D: number): number {
  const h2 = 0.035;
  const haut = YEUX.y0 + D - 0.02;
  const bas = YEUX.y1 + D + 0.02;
  const yn = y / H;
  if (yn + h2 > haut && yn - h2 < bas) return placerDansZoneSure((bas + h2 + 0.01), D) * H;
  return placerDansZoneSure(yn, D) * H;
}
