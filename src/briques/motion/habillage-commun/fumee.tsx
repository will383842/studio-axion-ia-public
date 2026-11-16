/**
 * FUMÉE (N-09, C11-H4) : 2 à 3 nappes lentes dont la forme (centre, rayons) vient de `bruitFractal`. Rien ne la dessine
 * encore. PUR : aucun hook, aucun Remotion, aucun alias d'import, aucun hasard non déterministe, aucun filtre de flou
 * (dégradés seulement, AM-05). Même graine et même image = même balisage. Ivoire sur fond noir, noir sur fond ivoire.
 * Jamais sur la zone du visage si elle est fournie. Attend la mesure AM-05 ; ne va jamais sur un rendu qui reçoit
 * déjà le grain FFmpeg.
 */
import type { ReactElement } from "react";
import { CHARTE_AXION, avecOpacite, type FondAxion } from "../../jetons-motion";
import { bruitFractal } from "./bruit";

/** Drapeaux de coût et de compatibilité (modèle de `fonds.tsx`). */
export const FUMEE = { attendMesure: true, incompatibleGrainFfmpeg: true } as const;

/** Opacité maximale d'une nappe (constante, ≤ 0,12). */
export const FUMEE_OPACITE_MAX = 0.12;
/** Nombre de nappes (2 à 3). */
export const FUMEE_NAPPES = 3;
/** Vitesse de dérive du bruit, en cellules par seconde (lente). */
const DERIVE_PAR_SEC = 0.06;

/** Zone à ne jamais voiler, en % de l'image. */
export interface ZoneInterdite {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface Nappe {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface FumeeProps {
  image: number;
  fps: number;
  largeur: number;
  hauteur: number;
  fond: FondAxion;
  graine: number;
  /** Multiplicateur d'opacité, borné à [0, 1] puis plafonné par `FUMEE_OPACITE_MAX`. */
  opacite?: number;
  /** Zone du visage, si connue : la fumée n'y entre pas. */
  zoneVisage?: ZoneInterdite;
}

const borne = (x: number, min: number, max: number) => (Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : min);

/** Nappes à l'image donnée : centres et rayons lus dans le bruit fractal, en % de l'image. */
export function nappesFumee(image: number, fps: number, graine: number): Nappe[] {
  const f = Number.isFinite(fps) && fps > 0 ? fps : 25;
  const t = (Number.isFinite(image) ? Math.max(0, image) : 0) / f;
  const d = t * DERIVE_PAR_SEC;
  const nappes: Nappe[] = [];
  for (let i = 0; i < FUMEE_NAPPES; i++) {
    const g = graine + i * 977;
    nappes.push({
      cx: +(10 + 80 * bruitFractal(d + i * 3.1, 0.5, g, 3)).toFixed(3),
      cy: +(10 + 80 * bruitFractal(0.5, d + i * 3.1, g + 1, 3)).toFixed(3),
      rx: +(35 + 30 * bruitFractal(d, i + 0.5, g + 2, 2)).toFixed(3),
      ry: +(25 + 25 * bruitFractal(i + 0.5, d, g + 3, 2)).toFixed(3),
    });
  }
  return nappes;
}

/** Calque de fumée, étendu à l'image entière, sans événement souris. */
export function Fumee(props: FumeeProps): ReactElement {
  const { image, fps, largeur, hauteur, fond, graine, zoneVisage } = props;
  const couleur = fond === "noir" ? CHARTE_AXION.ivoire : CHARTE_AXION.noir;
  const opacite = Math.min(FUMEE_OPACITE_MAX, FUMEE_OPACITE_MAX * borne(props.opacite ?? 1, 0, 1));
  const nappes = nappesFumee(image, fps, graine);
  const z = zoneVisage;
  const trou =
    z && largeur > 0 && hauteur > 0
      ? `path(evenodd, "M0 0H${largeur}V${hauteur}H0Z M${+((z.x0 * largeur) / 100).toFixed(2)} ${+((z.y0 * hauteur) / 100).toFixed(2)}V${+((z.y1 * hauteur) / 100).toFixed(2)}H${+((z.x1 * largeur) / 100).toFixed(2)}V${+((z.y0 * hauteur) / 100).toFixed(2)}Z")`
      : undefined;
  return (
    <div
      data-fumee=""
      data-graine={graine}
      data-opacite-max={opacite}
      style={{ position: "absolute", left: 0, top: 0, width: largeur, height: hauteur, pointerEvents: "none", overflow: "hidden", clipPath: trou }}
    >
      {nappes.map((n, i) => (
        <div
          key={i}
          data-nappe=""
          data-cx={n.cx}
          data-cy={n.cy}
          style={{
            position: "absolute",
            inset: 0,
            opacity: opacite,
            background: `radial-gradient(ellipse ${n.rx}% ${n.ry}% at ${n.cx}% ${n.cy}%, ${avecOpacite(couleur, 1)} 0%, ${avecOpacite(couleur, 0)} 100%)`,
          }}
        />
      ))}
    </div>
  );
}
