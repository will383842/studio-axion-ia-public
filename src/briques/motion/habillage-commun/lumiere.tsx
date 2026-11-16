/**
 * LUMIÈRES DESSINÉES EN CODE (C6-H6) : fuite de lumière, reflet balayé, lueur de texte, halo de carte.
 * PUR : aucun hook, aucun Remotion, aucun import par alias (lu par le rendu), aucun hasard, aucun filtre de flou
 * (coût de rendu, AM-05) : tout est dégradé et ombre. Chaque image se calcule depuis le seul numéro d'image.
 * Rien ne les dessine encore. C6-H3 n'utilisera que `RefletBalayage`, confiné à la boîte. Jamais devant le visage.
 * Orange seulement sur fond noir (terracotta sur ivoire) ; ivoire en `screen` sur fond ivoire ne se voit pas : voulu.
 */
import type { CSSProperties, ReactElement } from "react";
import { CHARTE_AXION, accentSur, avecOpacite, type FondAxion } from "../../jetons-motion";
import { courbe } from "../courbes";

export type CoteFuite = "gauche" | "droite" | "haut";

/** Durée bornée d'une fuite, en secondes (0,6 à 1,2 s). */
export const FUITE_DUREE_MIN_SEC = 0.6;
export const FUITE_DUREE_MAX_SEC = 1.2;
/** Angle du reflet, en degrés. */
export const ANGLE_REFLET = 18;
/** Plafonds de la lueur de texte et du halo. */
export const LUEUR_OMBRES_MAX = 3;
export const LUEUR_RAYON_MAX_PX = 18;
export const HALO_RAYON_MAX_PX = 48;
const RAYONS_LUEUR = [4, 10, LUEUR_RAYON_MAX_PX] as const;
const ALPHAS_LUEUR = [0.9, 0.6, 0.35] as const;

export interface ParametresFuite {
  fps: number;
  dureeImages: number;
  fond: FondAxion;
  cote: CoteFuite;
  eviterVisage?: boolean;
}

/** Une nappe : ellipse (centre et rayons en % de l'image), couleur, force. Alpha linéaire du centre au bord. */
export interface Nappe {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  couleur: string;
  force: number;
}

const borne = (x: number, min = 0, max = 1) => (Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : min);

/** Durée réelle en images : `dureeImages` ramené dans [0,6·fps ; 1,2·fps]. */
export function dureeFuiteImages(dureeImages: number, fps: number): number {
  const f = Number.isFinite(fps) && fps > 0 ? fps : 25;
  const d = Number.isFinite(dureeImages) ? dureeImages : 0;
  return Math.round(Math.min(FUITE_DUREE_MAX_SEC * f, Math.max(FUITE_DUREE_MIN_SEC * f, d)));
}

/** Nappes d'une fuite. Avec `eviterVisage`, les rayons restent hors de `ZONE_VISAGE` (22 % à 78 % en x, 14 % à 56 % en y). */
export function nappesFuite(p: Pick<ParametresFuite, "fond" | "cote" | "eviterVisage">): Nappe[] {
  const accent = accentSur(p.fond, "orange");
  const sur = !!p.eviterVisage;
  const L = sur ? 1 : 1.8; // rayons plus larges quand le visage n'est pas en jeu
  if (p.cote === "haut") {
    const ry = sur ? 11 : 22;
    return [
      { cx: 30, cy: 0, rx: 30 * L, ry, couleur: accent, force: 0.8 },
      { cx: 62, cy: 0, rx: 26 * L, ry: ry * 0.8, couleur: CHARTE_AXION.ivoire, force: 0.6 },
      { cx: 85, cy: 0, rx: 20 * L, ry: ry * 0.7, couleur: accent, force: 0.5 },
    ];
  }
  const g = p.cote === "gauche";
  const bord = g ? 0 : 100;
  const rx = sur ? 19 : 34;
  return [
    { cx: bord, cy: 30, rx, ry: 30 * L, couleur: accent, force: 0.8 },
    { cx: bord, cy: 62, rx: rx * 0.85, ry: 26 * L, couleur: CHARTE_AXION.ivoire, force: 0.6 },
    { cx: bord, cy: 88, rx: rx * 0.7, ry: 20 * L, couleur: accent, force: 0.5 },
  ];
}

/** Enveloppe 0 → 1 → 0 sur la durée (0 hors de [0, durée[). */
function enveloppe(image: number, duree: number): number {
  if (!(image >= 0) || image >= duree) return 0;
  return Math.sin(Math.PI * courbe("douce")(image / duree));
}

/** Alpha d'une nappe au point (% de l'image) : linéaire du centre (1) au bord de l'ellipse (0). */
function alphaNappe(n: Nappe, x: number, y: number): number {
  const d = Math.hypot((x - n.cx) / n.rx, (y - n.cy) / n.ry);
  return d >= 1 ? 0 : 1 - d;
}

/** Intensité (0-1) de la fuite en un point en % de l'image : même calcul que le dessin (somme des nappes, bornée). */
export function intensiteFuite(xPct: number, yPct: number, image: number, params: ParametresFuite): number {
  const e = enveloppe(image, dureeFuiteImages(params.dureeImages, params.fps));
  if (e <= 0) return 0;
  let s = 0;
  for (const n of nappesFuite(params)) s += n.force * e * alphaNappe(n, xPct, yPct);
  return borne(s);
}

export interface FuiteLumiereProps extends Omit<ParametresFuite, "eviterVisage"> {
  image: number;
  largeur: number;
  hauteur: number;
  eviterVisage?: boolean;
}

/** Fuite de lumière sur un bord, une seule fois, mélange `screen`. Rien avant l'image 0, rien après la fin. */
export function FuiteLumiere(props: FuiteLumiereProps): ReactElement | null {
  const { image, largeur, hauteur } = props;
  const e = enveloppe(image, dureeFuiteImages(props.dureeImages, props.fps));
  if (e <= 0) return null;
  const nappes = nappesFuite(props);
  return (
    <div
      data-lumiere="fuite"
      style={{ position: "absolute", left: 0, top: 0, width: largeur, height: hauteur, pointerEvents: "none", overflow: "hidden", mixBlendMode: "screen" }}
    >
      {nappes.map((n, i) => (
        <div
          key={i}
          data-nappe=""
          data-cx={n.cx}
          data-cy={n.cy}
          data-rx={n.rx}
          data-ry={n.ry}
          data-opacite={+(n.force * e).toFixed(4)}
          style={{
            position: "absolute",
            inset: 0,
            opacity: +(n.force * e).toFixed(4),
            background: `radial-gradient(ellipse ${n.rx}% ${n.ry}% at ${n.cx}% ${n.cy}%, ${avecOpacite(n.couleur, 1)} 0%, ${avecOpacite(n.couleur, 0)} 100%)`,
          }}
        />
      ))}
    </div>
  );
}

export interface RefletBalayageProps {
  image: number;
  dureeImages: number;
  boite: { largeur: number; hauteur: number };
  fond: FondAxion;
}

/** Position du reflet à l'avancement `k` (0-1) : centre en x (px) et demi-étendue horizontale de la bande inclinée. */
export function positionBalayage(k: number, boite: { largeur: number; hauteur: number }): { centreX: number; demiEtendue: number; largeurBande: number } {
  const a = (ANGLE_REFLET * Math.PI) / 180;
  const largeurBande = boite.largeur * 0.3;
  const hautBande = boite.hauteur * 2;
  const demiEtendue = (largeurBande * Math.cos(a) + hautBande * Math.sin(a)) / 2 + 1;
  const kk = courbe("glisse")(borne(k));
  const centreX = -demiEtendue + kk * (boite.largeur + 2 * demiEtendue);
  return { centreX, demiEtendue, largeurBande };
}

/** Bande claire à 18° qui traverse la boîte une fois, confinée à la boîte (`overflow: hidden`). */
export function RefletBalayage({ image, dureeImages, boite, fond }: RefletBalayageProps): ReactElement {
  const duree = Math.max(1, Number.isFinite(dureeImages) ? dureeImages : 1);
  const k = borne(image / duree);
  const { centreX, largeurBande } = positionBalayage(k, boite);
  const clair = fond === "noir" ? CHARTE_AXION.ivoire : CHARTE_AXION.gris;
  return (
    <div
      data-lumiere="reflet"
      style={{ position: "relative", overflow: "hidden", width: boite.largeur, height: boite.hauteur, pointerEvents: "none" }}
    >
      <div
        data-bande=""
        style={{
          position: "absolute",
          left: centreX - largeurBande / 2,
          top: -boite.hauteur / 2,
          width: largeurBande,
          height: boite.hauteur * 2,
          transform: `rotate(${ANGLE_REFLET}deg)`,
          background: `linear-gradient(90deg, ${avecOpacite(clair, 0)} 0%, ${avecOpacite(clair, fond === "noir" ? 0.28 : 0.6)} 50%, ${avecOpacite(clair, 0)} 100%)`,
        }}
      />
    </div>
  );
}

const estHex = (c: string) => /^#[0-9a-f]{6}$/i.test(c);
const teinte = (c: string, a: number) => (estHex(c) ? avecOpacite(c, a) : c);

/** Lueur de texte (`text-shadow`) : force bornée à [0, 1], au plus 3 ombres, rayon max 18 px. Force 0 : `"none"`. */
export function lueurTexte(couleur: string, force: number): string {
  const f = borne(force);
  if (f <= 0) return "none";
  const n = f <= 1 / 3 ? 1 : f <= 2 / 3 ? 2 : LUEUR_OMBRES_MAX;
  const ombres: string[] = [];
  for (let i = 0; i < n; i++) ombres.push(`0 0 ${RAYONS_LUEUR[i]}px ${teinte(couleur, +(f * ALPHAS_LUEUR[i]).toFixed(3))}`);
  return ombres.join(", ");
}

/** Lueur douce autour d'une carte, par `box-shadow` multiples (aucun filtre de flou). Plafonnée ; force 0 : `"none"`. */
export function halo(boite: { largeur: number; hauteur: number }, couleur: string, force: number): CSSProperties {
  const f = borne(force);
  if (f <= 0) return { boxShadow: "none" };
  const base = Math.min(HALO_RAYON_MAX_PX, Math.max(8, Math.min(boite.largeur, boite.hauteur) * 0.12));
  const ombres = [0.35, 0.7, 1].map((m, i) => `0 0 ${Math.round(base * m)}px ${Math.round(base * m * 0.25)}px ${teinte(couleur, +(f * [0.5, 0.3, 0.15][i]).toFixed(3))}`);
  return { boxShadow: ombres.join(", ") };
}

