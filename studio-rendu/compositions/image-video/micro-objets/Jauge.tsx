import React from "react";
/** Micro-objet « jauge qui monte » : le cadran se dessine, l'arc orange se remplit et l'aiguille monte jusqu'au plein (léger dépassement). */
import { microObjet } from "../../../../src/briques/schema-motion/micro-objets";
import { Cadre } from "./Cadre";
import { arc, couleursMicro, entre, progres, rebond, seDessine, surCercle, type ProprietesMicroObjet } from "./commun";

const DEBUT = -120;
const FIN = 120;

export function Jauge(p: ProprietesMicroObjet) {
  const c = couleursMicro(p.fond);
  const { t } = p;
  const monte = progres(t, 0.3, 0.95);
  const valeur = entre(0.08, 0.88, monte > 0 ? rebond(monte) : 0);
  const angle = entre(DEBUT, FIN, valeur);
  const [ax, ay] = surCercle(120, 146, 64, angle);
  return (
    <Cadre {...p} dureeS={microObjet("jauge").dureeS}>
      <path d={arc(120, 146, 88, DEBUT, FIN)} stroke={c.piste} strokeWidth={20} {...seDessine(progres(t, 0.02, 0.3))} />
      <path d={arc(120, 146, 88, DEBUT, angle)} stroke={c.accent} strokeWidth={20} />
      {[-120, -60, 0, 60, 120].map((a) => {
        const [x0, y0] = surCercle(120, 146, 64, a);
        const [x1, y1] = surCercle(120, 146, 56, a);
        return <path key={a} d={`M${x0} ${y0}L${x1} ${y1}`} strokeWidth={5} opacity={progres(t, 0.15, 0.15)} />;
      })}
      <path d={`M120 146L${ax} ${ay}`} strokeWidth={9} />
      <circle cx={120} cy={146} r={13} fill={c.papier} />
      <path d="M86 206H154" stroke={c.piste} strokeWidth={8} />
    </Cadre>
  );
}
