/**
 * OUTILS COMMUNS du lot B « Fenêtres de forme, visage entier » (standard v3 du 16/10/2026, §§ C, D.4, D.5).
 *
 * Tout ce qui est partagé par les 5 éléments : ressorts nommés du standard (VERRE, PIVOT, FOUET, JAILLIR, CLAQUER, POSER,
 * GLISSER), ombre douce en 3 couches (lumière du haut, toutes les ombres tombent vers le bas), liseré ivoire, vignette,
 * reflet qui passe, flou directionnel (filtre SVG bon marché), puce v3 (dégradé orange, sans contour) et la vidéo en
 * « cover » SANS ZOOM. Aucune nouvelle teinte : `NUANCES` + `alpha()`.
 *
 * Convention : tout est piloté par `t` (secondes) ; « i0 » du standard = `debut` ; les images sont comptées à 30 i/s.
 * Le « faux verre » (`alpha(ivoire, 0,88)` sans flou d'arrière-plan) remplace `backdrop-filter` (standard § D.6).
 */
import React, { useId } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Audio, Easing, interpolate, OffthreadVideo, Sequence, spring, staticFile } from "remotion";
import { SousTitres } from "../../SousTitres";
import type { GroupeSousTitre, MotSousTitre } from "../../SousTitres";
import { POLICES, largeurTexte } from "../../charte";
import { NUANCES, alpha, degradeOrange } from "../../variantes/premium-2";

export const FPS = 30;

/** Ressorts nommés du standard v3 (§ C.4). Dépassements théoriques, réglés à l'œil sur extrait. */
export const RESSORTS = Object.freeze({
  VERRE: { damping: 16, stiffness: 180, mass: 0.9 },
  PIVOT: { damping: 11, stiffness: 120, mass: 1 },
  FOUET: { damping: 30, stiffness: 520, mass: 0.6 },
  JAILLIR: { damping: 12, stiffness: 200, mass: 0.7 },
  CLAQUER: { damping: 18, stiffness: 420, mass: 0.5 },
  POSER: { damping: 20, stiffness: 170, mass: 1 },
  GLISSER: { damping: 26, stiffness: 260, mass: 0.8 },
} as const);
export type NomRessort = keyof typeof RESSORTS;

/** Ressort 0 → 1 `i` images après son départ (0 avant). */
export function ressort(nom: NomRessort, i: number): number {
  if (i <= 0) return 0;
  return spring({ frame: i, fps: FPS, config: RESSORTS[nom] });
}

export const borne = (v: number, a = 0, b = 1): number => Math.min(b, Math.max(a, v));
export const melange = (a: number, b: number, k: number): number => a + (b - a) * k;

/** Progression 0 → 1 en `n` images à partir de l'image `i0`. */
export function courbe(i: number, i0: number, n: number, easing: (x: number) => number = (x) => x): number {
  return interpolate(i, [i0, i0 + n], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
}
export const aspiration = Easing.in(Easing.cubic);
export const douce = Easing.inOut(Easing.cubic);

/** Secousse amortie de l'ÉLÉMENT (jamais de la prise). */
export function secousse(k: number, amplitude: number): number {
  if (k < 0 || k > 12) return 0;
  return amplitude * Math.exp(-k / 3) * Math.sin((2 * Math.PI * k) / 3);
}

/** Micro-vie au repos : oscillation lente (période 2,4 s = 72 images), jamais immobile. */
export const flotte = (i: number, phase = 0): number => Math.sin(((i + phase) / 72) * 2 * Math.PI);

/** Ombre douce en 3 couches (box-shadow), lumière du haut ; `proche` > 1 = objet plus proche (plan P2). */
export function ombres(W: number, proche = 1): string {
  const k = proche;
  return [
    `0 ${0.004 * W * k}px ${0.01 * W}px ${alpha(NUANCES.encre, 0.2)}`,
    `0 ${0.018 * W * k}px ${0.045 * W * k}px ${alpha(NUANCES.encre, 0.24)}`,
    `0 ${0.045 * W * k}px ${0.11 * W * k}px ${alpha(NUANCES.encre, 0.16)}`,
  ].join(", ");
}

/** La même ombre en `filter: drop-shadow` (formes découpées : le flou y est un écart-type, donc la moitié). */
export function ombresFiltre(W: number, proche = 1): string {
  const k = proche;
  return [
    `drop-shadow(0 ${0.004 * W * k}px ${0.005 * W}px ${alpha(NUANCES.encre, 0.2)})`,
    `drop-shadow(0 ${0.018 * W * k}px ${0.022 * W * k}px ${alpha(NUANCES.encre, 0.24)})`,
    `drop-shadow(0 ${0.045 * W * k}px ${0.055 * W * k}px ${alpha(NUANCES.encre, 0.16)})`,
  ].join(" ");
}

/** Vignette intérieure (dégradé radial encre 18 % dans les coins) + gloss de lumière en haut : décolle la vidéo du bord. */
export function Vignette({ gloss = true }: { gloss?: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, ${alpha(NUANCES.encre, 0.18)} 100%)` }} />
      {gloss ? <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: "38%", background: `linear-gradient(180deg, ${alpha(NUANCES.ivoire, 0.16)} 0%, rgba(0,0,0,0) 100%)` }} /> : null}
    </div>
  );
}

/** Liseré intérieur ivoire (55 %, 0,003 L) et reflet de 0,0025 L en haut. `rayon` = rayon des coins (CSS). */
export function Lisere({ W, rayon }: { W: number; rayon: string | number }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: rayon,
        pointerEvents: "none",
        boxShadow: `inset 0 0 0 ${Math.max(2, 0.003 * W)}px ${alpha(NUANCES.ivoire, 0.55)}, inset 0 ${Math.max(2, 0.0025 * W)}px 0 ${alpha(NUANCES.ivoire, 0.35)}`,
      }}
    />
  );
}

/** Reflet qui passe : bande diagonale ivoire (0,25 L, inclinée à 20°) qui traverse la forme en `n` images, une seule fois. */
export function Glint({ i, i0, n = 10, W, largeur }: { i: number; i0: number; n?: number; W: number; largeur: number }) {
  if (i < i0 || i > i0 + n) return null;
  const p = courbe(i, i0, n, douce);
  const bw = 0.25 * W;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: "-35%",
          height: "170%",
          width: bw,
          left: -bw * 1.2 + p * (largeur + bw * 2.4),
          transform: "rotate(20deg)",
          background: `linear-gradient(90deg, rgba(0,0,0,0) 0%, ${alpha(NUANCES.ivoire, 0.34)} 50%, rgba(0,0,0,0) 100%)`,
        }}
      />
    </div>
  );
}

/** Vidéo en « cover », muette, SANS ZOOM ni mouvement ; démarre à `debut` (s) à l'image `depuisImage` de la source. */
export function VideoCover({ src, debut, largeur, hauteur, depuisImage = 0, style }: { src: string; debut: number; largeur: number; hauteur: number; depuisImage?: number; style?: CSSProperties }) {
  return (
    <Sequence from={Math.round(debut * FPS)} layout="none">
      <OffthreadVideo src={src} muted startFrom={depuisImage} style={{ width: largeur, height: hauteur, objectFit: "cover", display: "block", ...style }} />
    </Sequence>
  );
}

/**
 * Flou directionnel bon marché (standard § D.5) : `feGaussianBlur stdDeviation="sx sy"` dans un conteneur que l'appelant
 * place (et tourne) dans la direction du mouvement. Inactif (aucun filtre) quand le flou est négligeable.
 */
export function FlouDir({ sx, sy = 0, style, children }: { sx: number; sy?: number; style?: CSSProperties; children: ReactNode }) {
  const id = `fd${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const actif = sx > 0.4 || sy > 0.4;
  return (
    <>
      {actif ? (
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <filter id={id} x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={`${sx} ${sy}`} />
          </filter>
        </svg>
      ) : null}
      <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", ...style, filter: [actif ? `url(#${id})` : "", style?.filter ?? ""].filter(Boolean).join(" ") || undefined }}>{children}</div>
    </>
  );
}

/** Largeur (px) d'une puce v3 : texte + marges, pour la placer sans la couper. */
export function largeurPuce(texte: string, taille: number): number {
  return largeurTexte(texte, taille, 0.04 * taille) + taille * 1.5;
}
export const hauteurPuce = (taille: number): number => taille * 1.9;

/**
 * PUCE v3 (§ E.2) : dégradé orange chaud → profond, coins de 0,22 em, reflet en haut, ombre douce en 2 couches, SANS contour.
 * Entrée : échelle de 0,4 à 1 avec `JAILLIR` et mise au point en 3 images. `x`, `y` = coin haut-gauche (px).
 * `decalage` (px) : glissement P2 (parallaxe ×1,35 : la puce « arrive après » son support et le dépasse).
 */
export function Puce({
  texte,
  W,
  i,
  i0,
  iSortie,
  x,
  y,
  taille,
  inclinaison = -2,
  variante = "orange",
  decalage = { x: 0, y: 0 },
  origine = "50% 50%",
}: {
  texte: string;
  W: number;
  i: number;
  i0: number;
  iSortie?: number;
  x: number;
  y: number;
  taille: number;
  inclinaison?: number;
  variante?: "orange" | "encre";
  decalage?: { x: number; y: number };
  origine?: string;
}) {
  if (i < i0) return null;
  const p = ressort("JAILLIR", i - i0);
  const sort = iSortie === undefined ? 0 : courbe(i, iSortie, 4, aspiration);
  if (sort >= 1) return null;
  const echelle = (0.4 + 0.6 * p) * (1 - 0.6 * sort);
  const net = courbe(i, i0, 3);
  const flou = (1 - net) * 0.006 * W;
  const k = 1 - borne(p, 0, 1.2);
  const l = largeurPuce(texte, taille);
  const h = hauteurPuce(taille);
  const fond = variante === "orange" ? degradeOrange : `linear-gradient(180deg, ${alpha(NUANCES.encreDouce, 0.82)} 0%, ${alpha(NUANCES.encre, 0.86)} 100%)`;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: l,
        height: h,
        borderRadius: taille * 0.42,
        background: fond,
        color: NUANCES.ivoire,
        fontFamily: POLICES.titre,
        fontSize: taille,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: net,
        filter: flou > 0.05 ? `blur(${flou}px)` : undefined,
        transformOrigin: origine,
        transform: `translate(${decalage.x * k * 1.35}px, ${decalage.y * k * 1.35}px) rotate(${inclinaison}deg) scale(${echelle})`,
        boxShadow: [
          `0 ${0.008 * W}px ${0.022 * W}px ${alpha(NUANCES.encre, 0.3)}`,
          `0 ${0.002 * W}px ${0.005 * W}px ${alpha(NUANCES.encre, 0.28)}`,
          `inset 0 ${Math.max(2, 0.0022 * W)}px 0 ${alpha(NUANCES.ivoire, 0.38)}`,
        ].join(", "),
      }}
    >
      {texte}
    </div>
  );
}

/** Un bruitage : [image relative à `debut`, fichier de `sons/` sans extension, volume]. Aucune musique. */
export type Bruit = [number, string, number];

/** Bruitages d'un élément (fichiers de `compositions/interface-claire/sons/`, copiés dans `<public>/sons/`), mixés par `<Audio>`. */
export function Bruitages({ debut, liste }: { debut: number; liste: Bruit[] }) {
  return (
    <>
      {liste.map(([k, nom, volume], n) => (
        <Sequence key={`${nom}-${n}`} from={Math.round(debut * FPS) + k} durationInFrames={60} layout="none">
          <Audio src={staticFile(`sons/${nom}.wav`)} volume={volume} />
        </Sequence>
      ))}
    </>
  );
}

/** Phrase d'exemple commune à tous les lots (mot fort = plaque orange du VRAI moteur `SousTitres`). */
const MOTS_PHRASE: MotSousTitre[] = [
  { w: "Vos", a: 0 },
  { w: "devis", a: 0.3, fort: true },
  { w: "partent", a: 0.6 },
  { w: "tout", a: 0.95 },
  { w: "seuls", a: 1.2, fort: true },
  { w: "pendant", a: 1.65 },
  { w: "que", a: 1.95 },
  { w: "vous", a: 2.1 },
  { w: "êtes", a: 2.3 },
  { w: "sur", a: 2.55 },
  { w: "le", a: 2.7 },
  { w: "chantier", a: 2.85, fort: true },
];
const DECOUPE = [[0, 2], [2, 5], [5, 8], [8, 12]];
export const DUREE_PHRASE = 3.8;

/** Groupes de sous-titres de la phrase « Vos devis partent tout seuls pendant que vous êtes sur le chantier. » débutant à `t0` (s). */
export function groupesPhrase(t0: number): GroupeSousTitre[] {
  return DECOUPE.map(([d, f], k) => {
    const mots = MOTS_PHRASE.slice(d, f).map((m) => ({ ...m, a: m.a + t0 }));
    const suivant = DECOUPE[k + 1];
    return { mots, fin: suivant ? MOTS_PHRASE[suivant[0]].a + t0 : t0 + DUREE_PHRASE };
  });
}

/** Sous-titres du lot B : en haut (0,075 H, au-dessus des cheveux) car les éléments du lot occupent le bas et les côtés. */
export function SousTitresLotB({ t, groupes, W, H }: { t: number; groupes: GroupeSousTitre[]; W: number; H: number }) {
  return <SousTitres t={t} groupes={groupes} y={0.075 * H} largeurImage={W} hauteurImage={H} />;
}
