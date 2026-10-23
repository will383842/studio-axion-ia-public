import React from "react";
/** Micro-objet « post-it qui se rangent » : trois post-it en vrac, de travers, glissent chacun dans sa colonne et se redressent. */
import { microObjet } from "../../../../src/briques/schema-motion/micro-objets";
import { Cadre } from "./Cadre";
import { couleursMicro, entre, progres, rebond, teinte, va, type ProprietesMicroObjet } from "./commun";

/** Départ en vrac (centre, rotation) puis arrivée en colonne, pour chacun des trois post-it. */
const VRAC = [
  { x: 76, y: 150, r: -18 },
  { x: 128, y: 92, r: 14 },
  { x: 168, y: 168, r: -7 },
];

export function PostIt(p: ProprietesMicroObjet) {
  const c = couleursMicro(p.fond);
  const { t } = p;
  const colonnes = progres(t, 0.15, 0.3);
  const fonds = [c.accent, c.papier, teinte(c.accent, 0.35)];
  const traits = [c.accent, c.trait, c.accent];
  return (
    <Cadre {...p} dureeS={microObjet("post-it").dureeS}>
      {[84, 156].map((x) => (
        <path key={x} d={`M${x} 40V214`} stroke={c.piste} strokeWidth={5} strokeDasharray="10 12" opacity={colonnes} />
      ))}
      {VRAC.map((v, i) => {
        const pop = progres(t, 0.05 + 0.08 * i, 0.25);
        const range = va(progres(t, 0.5 + 0.14 * i, 0.55));
        const x = entre(v.x, 48 + 72 * i, range);
        const y = entre(v.y, 118, range);
        const r = entre(v.r, 0, range);
        const s = pop < 1 ? 0.5 + 0.5 * rebond(pop) : 1;
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} opacity={Math.min(1, pop * 3)}>
            <path d="M-28 -28H28V14L14 28H-28Z" fill={fonds[i]} stroke={traits[i]} strokeWidth={6} />
            <path d="M14 28V14H28" stroke={traits[i]} strokeWidth={6} />
            <path d="M-16 -10H16M-16 6H6" stroke={i === 1 ? c.trait : c.blanc} strokeWidth={6} />
          </g>
        );
      })}
    </Cadre>
  );
}
