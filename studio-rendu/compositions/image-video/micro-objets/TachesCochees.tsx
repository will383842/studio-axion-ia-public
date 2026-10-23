import React from "react";
/** Micro-objet « tâches qui se cochent » : trois tâches identiques glissent, puis se cochent seules en cascade (coches vertes). */
import { microObjet } from "../../../../src/briques/schema-motion/micro-objets";
import { Cadre } from "./Cadre";
import { couleursMicro, doux, progres, rebond, seDessine, type ProprietesMicroObjet } from "./commun";

export function TachesCochees(p: ProprietesMicroObjet) {
  const c = couleursMicro(p.fond);
  const { t } = p;
  return (
    <Cadre {...p} dureeS={microObjet("taches-cochees").dureeS}>
      {[0, 1, 2].map((i) => {
        const y = 56 + i * 64;
        const entree = doux(progres(t, 0.05 + 0.1 * i, 0.3));
        const coche = progres(t, 0.55 + 0.22 * i, 0.3);
        const s = coche > 0 ? 0.6 + 0.4 * rebond(coche) : 1;
        return (
          <g key={i} transform={`translate(${(1 - entree) * 50} 0)`} opacity={entree}>
            <rect x={28} y={y - 24} width={48} height={48} rx={12} fill={c.papier} />
            {coche > 0 ? (
              <g transform={`translate(52 ${y}) scale(${s}) translate(-52 ${-y})`}>
                <rect x={28} y={y - 24} width={48} height={48} rx={12} fill={c.vert} stroke={c.vert} />
                <path d={`M39 ${y + 1}l9 9 17-19`} stroke={c.blanc} strokeWidth={8} {...seDessine(coche * 1.4)} />
              </g>
            ) : null}
            <path d={`M98 ${y - 8}H206`} stroke={coche >= 1 ? c.piste : c.trait} />
            <path d={`M98 ${y + 12}H164`} stroke={c.piste} strokeWidth={7} />
          </g>
        );
      })}
    </Cadre>
  );
}
