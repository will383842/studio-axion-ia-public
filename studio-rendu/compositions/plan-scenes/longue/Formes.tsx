/** Les formes de la vidéo longue, dessinées au trait (SVG), tracées progressivement avec `evolvePath`, puis animées selon leur nature. */
import { evolvePath } from "@remotion/paths";
import type { ReactNode } from "react";
import type { FormeLongue } from "../../../../src/moteurs/montage-video-longue/storyboard-types";

const cercle = (cx: number, cy: number, r: number) => `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;

/** Cloche : le premier chemin est la cloche, le second le battant (ils se balancent ensemble). */
const CLOCHE = "M 50 14 C 32 14 28 34 28 50 C 28 64 22 70 18 76 H 82 C 78 70 72 64 72 50 C 72 34 68 14 50 14 Z";

const CHEMINS: Record<FormeLongue, string[]> = {
  cercle: [cercle(50, 50, 42)],
  cible: [cercle(50, 50, 42), cercle(50, 50, 26), cercle(50, 50, 9), "M 50 2 L 50 16", "M 50 98 L 50 84", "M 2 50 L 16 50", "M 98 50 L 84 50"],
  horloge: [cercle(50, 50, 42), "M 50 14 L 50 20", "M 86 50 L 80 50", "M 50 86 L 50 80", "M 14 50 L 20 50"],
  calendrier: ["M 14 24 H 86 A 4 4 0 0 1 90 28 V 86 A 4 4 0 0 1 86 90 H 14 A 4 4 0 0 1 10 86 V 28 A 4 4 0 0 1 14 24 Z", "M 10 44 H 90", "M 30 10 V 32", "M 70 10 V 32", "M 28 60 H 36", "M 46 60 H 54", "M 64 60 H 72", "M 28 74 H 36", "M 46 74 H 54"],
  alerte: ["M 50 10 L 92 84 H 8 Z", "M 50 36 V 58", "M 50 70 V 71"],
  coche: [cercle(50, 50, 42), "M 28 52 L 44 68 L 74 34"],
  fleche: ["M 10 78 L 38 50 L 54 64 L 88 26", "M 62 26 H 88 V 52"],
  graphique: ["M 12 10 V 88 H 92", "M 26 88 V 60 H 40 V 88", "M 46 88 V 42 H 60 V 88", "M 66 88 V 24 H 80 V 88"],
  liste: ["M 8 14 H 92 V 86 H 8 Z", "M 20 30 h 12 v 12 h -12 Z", "M 42 36 H 80", "M 20 48 h 12 v 12 h -12 Z", "M 42 54 H 80", "M 20 66 h 12 v 12 h -12 Z", "M 42 72 H 70"],
  tableur: ["M 8 14 H 92 V 86 H 8 Z", "M 8 38 H 92", "M 8 62 H 92", "M 36 14 V 86", "M 64 14 V 86"],
  cloche: [CLOCHE, "M 42 84 a 8 8 0 0 0 16 0", "M 50 6 V 14"],
  bouclier: ["M 50 8 L 84 20 V 48 C 84 70 68 84 50 92 C 32 84 16 70 16 48 V 20 Z", "M 34 50 L 46 62 L 68 36"],
};

/** Parcours de la flèche (points), pour le point qui avance. */
const PARCOURS_FLECHE: [number, number][] = [
  [10, 78],
  [38, 50],
  [54, 64],
  [88, 26],
];
function surParcours(pts: [number, number][], u: number): [number, number] {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = seg.reduce((a, b) => a + b, 0);
  let reste = u * total;
  for (let i = 0; i < seg.length; i++) {
    if (reste <= seg[i]) {
      const k = reste / seg[i];
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
    }
    reste -= seg[i];
  }
  return pts[pts.length - 1];
}

const onde = (t: number, periode: number, dephasage = 0) => 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / periode + dephasage);

export function Forme({ forme, trace, couleur, epaisseur, t, largeur }: { forme: FormeLongue; trace: number; couleur: string; epaisseur: number; t: number; largeur: number }) {
  const chemins = CHEMINS[forme];
  const n = chemins.length;
  const e = (epaisseur * 100) / Math.max(1, largeur);
  const fini = trace > 0.9;
  // Mouvement continu de l'ensemble : léger balancement et respiration ; chaque forme s'anime en plus selon sa nature.
  const angle = forme === "cloche" ? 0 : 3 * Math.sin(t * 0.9);
  const echelle = 1 + 0.04 * Math.sin(t * 1.7 + 1);
  const cloche = forme === "cloche" ? `rotate(${16 * Math.sin(t * 3.2)} 50 8)` : undefined;
  const dessiner = (d: string, i: number) => {
    // Les chemins se tracent l'un après l'autre (chevauchement partiel), le premier d'abord.
    const part = Math.min(1, Math.max(0, trace * (n + 1.5) - i) / 1.5);
    if (part <= 0) return null;
    const { strokeDasharray, strokeDashoffset } = evolvePath(Math.min(1, part), d);
    let transform: string | undefined;
    let opacity = 1;
    // Histogramme : les barres montent et descendent en décalé.
    if (forme === "graphique" && i > 0) transform = `translate(0 88) scale(1 ${0.72 + 0.4 * onde(t, 2.4, i * 1.6)}) translate(0 -88)`;
    // Point d'exclamation : clignote doucement.
    if (forme === "alerte" && i > 0) opacity = 0.25 + 0.75 * onde(t, 1.8, i);
    // Cible : les anneaux intérieurs pulsent.
    if (forme === "cible" && (i === 1 || i === 2)) transform = `translate(50 50) scale(${0.82 + 0.3 * onde(t, 1.6, i * 1.1)}) translate(-50 -50)`;
    // Coche et bouclier : le signe pulse.
    if ((forme === "coche" || forme === "bouclier") && i === 1) transform = `translate(50 52) scale(${0.88 + 0.2 * onde(t, 1.6)}) translate(-50 -52)`;
    // Tableur : les lignes de grille respirent.
    if (forme === "tableur" && i > 0) opacity = 0.55 + 0.45 * onde(t, 2.2, i * 0.9);
    return <path key={i} d={d} transform={transform} opacity={opacity} fill="none" stroke={couleur} strokeWidth={e} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />;
  };
  let extra: ReactNode = null;
  if (forme === "horloge" && fini)
    extra = (
      <g stroke={couleur} strokeWidth={e} strokeLinecap="round">
        <line x1="50" y1="50" x2="50" y2="24" transform={`rotate(${(t * 90) % 360} 50 50)`} />
        <line x1="50" y1="50" x2="50" y2="34" transform={`rotate(${(t * 8) % 360} 50 50)`} />
      </g>
    );
  if (forme === "cercle" && fini) extra = <circle cx="50" cy="50" r={30 + 6 * onde(t, 2)} fill="none" stroke={couleur} strokeWidth={e} opacity={0.25 + 0.4 * onde(t, 2)} />;
  if (forme === "fleche" && fini) {
    // Trois points qui avancent le long de la flèche.
    extra = (
      <g fill={couleur}>
        {[0, 1 / 3, 2 / 3].map((k) => {
          const u = (t * 0.45 + k) % 1;
          const [x, y] = surParcours(PARCOURS_FLECHE, u);
          return <circle key={k} cx={x} cy={y} r={e * (0.9 + 0.5 * Math.sin(Math.PI * u))} />;
        })}
      </g>
    );
  }
  if (forme === "liste" && fini) {
    // Les cases se cochent l'une après l'autre, en boucle.
    const k = Math.floor((t * 0.9) % 4);
    extra = (
      <g fill="none" stroke={couleur} strokeWidth={e} strokeLinecap="round" strokeLinejoin="round">
        {[0, 1, 2].filter((r) => r < k).map((r) => (
          <path key={r} d={`M 22 ${36 + r * 18} L 26 ${40 + r * 18} L 32 ${31 + r * 18}`} />
        ))}
      </g>
    );
  }
  if (forme === "tableur" && fini) {
    const c = Math.floor(t * 1.6) % 9;
    extra = <rect x={8 + (c % 3) * 28 + 1.5} y={14 + Math.floor(c / 3) * 24 + 1.5} width={25} height={21} rx={2} fill={couleur} opacity={0.18 + 0.12 * Math.sin(t * 6)} />;
  }
  if (forme === "cloche" && fini) {
    extra = (
      <g fill="none" stroke={couleur} strokeWidth={e} strokeLinecap="round" opacity={0.3 + 0.7 * onde(t, 1.6)}>
        <path d="M 86 30 q 6 10 0 20" />
        <path d="M 94 24 q 10 16 0 32" />
        <path d="M 14 30 q -6 10 0 20" />
        <path d="M 6 24 q -10 16 0 32" />
      </g>
    );
  }
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ overflow: "visible", display: "block" }}>
      <g transform={`rotate(${angle} 50 50) translate(50 50) scale(${echelle}) translate(-50 -50)`}>
        {cloche ? (
          <g transform={cloche}>{chemins.map(dessiner)}</g>
        ) : (
          chemins.map(dessiner)
        )}
        {extra}
      </g>
    </svg>
  );
}
