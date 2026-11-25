/** Les huit formes de la vidéo longue, dessinées au trait (SVG), tracées progressivement avec `evolvePath`. */
import { evolvePath } from "@remotion/paths";
import type { FormeLongue } from "../../../../src/moteurs/montage-video-longue/storyboard-types";

const cercle = (cx: number, cy: number, r: number) => `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;

const CHEMINS: Record<FormeLongue, string[]> = {
  cercle: [cercle(50, 50, 42)],
  cible: [cercle(50, 50, 42), cercle(50, 50, 26), cercle(50, 50, 9), "M 50 2 L 50 16", "M 50 98 L 50 84", "M 2 50 L 16 50", "M 98 50 L 84 50"],
  horloge: [cercle(50, 50, 42), "M 50 14 L 50 20", "M 86 50 L 80 50", "M 50 86 L 50 80", "M 14 50 L 20 50"],
  calendrier: ["M 14 24 H 86 A 4 4 0 0 1 90 28 V 86 A 4 4 0 0 1 86 90 H 14 A 4 4 0 0 1 10 86 V 28 A 4 4 0 0 1 14 24 Z", "M 10 44 H 90", "M 30 10 V 32", "M 70 10 V 32", "M 28 60 H 36", "M 46 60 H 54", "M 64 60 H 72", "M 28 74 H 36", "M 46 74 H 54"],
  alerte: ["M 50 10 L 92 84 H 8 Z", "M 50 36 V 58", "M 50 70 V 71"],
  coche: [cercle(50, 50, 42), "M 28 52 L 44 68 L 74 34"],
  fleche: ["M 10 78 L 38 50 L 54 64 L 88 26", "M 62 26 H 88 V 52"],
  graphique: ["M 12 10 V 88 H 92", "M 26 88 V 60 H 40 V 88", "M 46 88 V 42 H 60 V 88", "M 66 88 V 24 H 80 V 88"],
};

export function Forme({ forme, trace, couleur, epaisseur, t, largeur }: { forme: FormeLongue; trace: number; couleur: string; epaisseur: number; t: number; largeur: number }) {
  const chemins = CHEMINS[forme];
  const n = chemins.length;
  const e = (epaisseur * 100) / Math.max(1, largeur);
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ overflow: "visible", display: "block" }}>
      {chemins.map((d, i) => {
        // Les chemins se tracent l'un après l'autre (chevauchement partiel), le premier d'abord.
        const part = Math.min(1, Math.max(0, trace * (n + 1.5) - i) / 1.5);
        if (part <= 0) return null;
        const { strokeDasharray, strokeDashoffset } = evolvePath(Math.min(1, part), d);
        return <path key={i} d={d} fill="none" stroke={couleur} strokeWidth={e} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />;
      })}
      {forme === "horloge" && trace > 0.8 && (
        <g stroke={couleur} strokeWidth={e} strokeLinecap="round">
          <line x1="50" y1="50" x2="50" y2="26" transform={`rotate(${(t * 60) % 360} 50 50)`} />
          <line x1="50" y1="50" x2="50" y2="34" transform={`rotate(${(t * 5) % 360} 50 50)`} />
        </g>
      )}
      {forme === "cercle" && trace > 0.9 && <circle cx={50 + 42 * Math.cos(t * 1.4 - Math.PI / 2)} cy={50 + 42 * Math.sin(t * 1.4 - Math.PI / 2)} r={e * 1.3} fill={couleur} />}
      {forme === "alerte" && trace > 0.9 && <circle cx="50" cy="56" r={34 + 4 * Math.sin(t * 4)} fill="none" stroke={couleur} strokeWidth={e / 3} opacity={0.35} />}
    </svg>
  );
}
