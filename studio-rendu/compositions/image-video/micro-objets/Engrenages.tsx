import React from "react";
/** Micro-objet « engrenages » : le grand engrenage se dessine, le petit (orange) vient s'y emboîter, puis les deux tournent ensemble, de plus en plus vite jusqu'à un régime calme. */
import { microObjet } from "../../../../src/briques/schema-motion/micro-objets";
import { Cadre } from "./Cadre";
import { contourEngrenage, couleursMicro, doux, entre, progres, seDessine, type ProprietesMicroObjet } from "./commun";

const A = { x: 96, y: 136, r: 64, dents: 10 };
const B = { x: 172, y: 78, r: 42, dents: 7 };
const PROFONDEUR = 14;

/** Angle (degrés) du grand engrenage : démarre à 0,45 s, accélère puis tourne à 110°/s. */
function angleA(t: number): number {
  const tau = Math.max(0, t - 0.45);
  return 110 * (tau - (1 - Math.exp(-3 * tau)) / 3);
}

export function Engrenages(p: ProprietesMicroObjet) {
  const c = couleursMicro(p.fond);
  const { t } = p;
  const a = angleA(t);
  const b = (-a * A.dents) / B.dents + 180 / B.dents;
  const arrivee = doux(progres(t, 0.15, 0.35));
  return (
    <Cadre {...p} dureeS={microObjet("engrenages").dureeS}>
      <g transform={`rotate(${a} ${A.x} ${A.y})`}>
        <path d={contourEngrenage(A.x, A.y, A.r, A.dents, PROFONDEUR)} fill={c.papier} {...seDessine(progres(t, 0.02, 0.35))} />
        <circle cx={A.x} cy={A.y} r={18} />
      </g>
      <g transform={`translate(${entre(50, 0, arrivee)} ${entre(-50, 0, arrivee)})`} opacity={arrivee}>
        <g transform={`rotate(${b} ${B.x} ${B.y})`} stroke={c.accent}>
          <path d={contourEngrenage(B.x, B.y, B.r, B.dents, PROFONDEUR)} fill={c.accent} />
          <circle cx={B.x} cy={B.y} r={12} fill={c.papier} />
        </g>
      </g>
    </Cadre>
  );
}
