/** PETITS OBJETS — tracé SVG pur (aucun hook, aucun filtre). Tracé par `pathLength={1}` et `strokeDashoffset={1 - t}`. Imports relatifs seulement. */
import type { JSX } from "react";
import type { FondAxion } from "../../jetons-motion";
import { couleurDuTon } from "./tons";
import type { TonObjet } from "./contrat";

export interface ProprietesTrace {
  d: string;
  /** Avancement du tracé, 0..1. */
  t: number;
  ton: TonObjet;
  fond: FondAxion;
  epaisseur?: number;
}

export function TraceSvg({ d, t, ton, fond, epaisseur = 6 }: ProprietesTrace): JSX.Element {
  const k = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  return (
    <path
      d={d}
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - k}
      stroke={couleurDuTon(ton, fond)}
      strokeWidth={epaisseur}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}

/* Copies (non importées) de `cheminCercle` / `cheminFleche` de MotionCaptureAnnotee : le dessin pur ne dépend pas du rendu. */
function pointCercle(x: number, y: number, l: number, h: number, graine: number, k: number) {
  const rx = (l / 2) * 1.12 + 6;
  const ry = (h / 2) * 1.22 + 6;
  const a = ((-110 + k * 385) * Math.PI) / 180;
  const f = 1 + 0.035 * Math.sin(k * 64 * 0.45 + graine) + k * 0.05;
  return { x: x + l / 2 + Math.cos(a) * rx * f, y: y + h / 2 + Math.sin(a) * ry * f };
}

export function cheminCercleObjet(x: number, y: number, l: number, h: number, graine = 0): string {
  const pts: string[] = [];
  for (let i = 0; i <= 64; i++) {
    const p = pointCercle(x, y, l, h, graine, i / 64);
    pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }
  return `M ${pts.join(" L ")}`;
}

export function cheminFlecheObjet(x: number, y: number, l: number, h: number, W: number, H: number) {
  const cx = x + l / 2;
  const basse = y + h / 2 > H * 0.6;
  const fin = { x: cx + l * 0.18, y: basse ? y - 10 : y + h + 10 };
  const debut = { x: Math.min(W - 30, Math.max(30, fin.x + W * 0.22)), y: basse ? Math.max(20, y - H * 0.22) : Math.min(H - 20, y + h + H * 0.22) };
  const controle = { x: debut.x + (fin.x - debut.x) * 0.1, y: fin.y + (debut.y - fin.y) * 0.15 };
  const angle = Math.atan2(fin.y - controle.y, fin.x - controle.x);
  return { d: `M ${debut.x.toFixed(1)} ${debut.y.toFixed(1)} Q ${controle.x.toFixed(1)} ${controle.y.toFixed(1)} ${fin.x.toFixed(1)} ${fin.y.toFixed(1)}`, fin, angle, debut };
}
