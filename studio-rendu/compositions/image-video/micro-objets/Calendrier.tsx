import React from "react";
/** Micro-objet « calendrier » : l'ancienne page se soulève et part, les jours apparaissent, le premier s'entoure en orange puis se coche en vert. */
import { microObjet } from "../../../../src/briques/schema-motion/micro-objets";
import { Cadre } from "./Cadre";
import { couleursMicro, progres, rebond, seDessine, type ProprietesMicroObjet } from "./commun";

const X0 = 60;
const Y0 = 118;
const PAS = 32;

export function Calendrier(p: ProprietesMicroObjet) {
  const c = couleursMicro(p.fond);
  const { t } = p;
  const page = progres(t, 0.15, 0.3);
  const cercle = progres(t, 0.75, 0.35);
  const coche = progres(t, 1.1, 0.3);
  return (
    <Cadre {...p} dureeS={microObjet("calendrier").dureeS}>
      <rect x={26} y={52} width={188} height={164} rx={18} fill={c.papier} />
      <path d="M26 92H214" />
      <path d="M70 36V66M170 36V66" />
      {[0, 1, 2].map((ligne) =>
        [0, 1, 2, 3, 4].map((col) => {
          const i = ligne * 5 + col;
          const v = progres(t, 0.35 + 0.02 * i, 0.15);
          return <rect key={i} x={X0 + col * PAS - 9} y={Y0 + ligne * PAS - 9} width={18} height={18} rx={5} fill={i === 0 && cercle > 0 ? c.accent : c.piste} stroke="none" opacity={v} />;
        }),
      )}
      <circle cx={X0} cy={Y0} r={19} stroke={c.accent} strokeWidth={7} {...seDessine(cercle)} />
      {coche > 0 ? (
        <g transform={`translate(${X0 + 18} ${Y0 - 20}) scale(${rebond(coche)})`}>
          <circle r={16} fill={c.vert} stroke="none" />
          <path d="M-7 0l5 5 9-10" stroke={c.blanc} strokeWidth={5} />
        </g>
      ) : null}
      {page < 1 ? (
        <g transform={`translate(0 52) scale(1 ${1 - page}) translate(0 -52)`} opacity={1 - page * 0.6}>
          <rect x={26} y={52} width={188} height={164} rx={18} fill={c.papier} />
          <path d="M60 130H180M60 162H150" stroke={c.piste} />
        </g>
      ) : null}
    </Cadre>
  );
}
