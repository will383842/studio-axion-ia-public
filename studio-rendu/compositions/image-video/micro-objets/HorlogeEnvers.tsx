import React from "react";
/** Micro-objet « horloge à l'envers » : le cadran se dessine, les aiguilles tournent à l'envers (deux heures rendues), une flèche orange montre le sens. */
import { microObjet } from "../../../../src/briques/schema-motion/micro-objets";
import { Cadre } from "./Cadre";
import { arc, couleursMicro, entre, progres, seDessine, surCercle, va, type ProprietesMicroObjet } from "./commun";

export function HorlogeEnvers(p: ProprietesMicroObjet) {
  const c = couleursMicro(p.fond);
  const { t } = p;
  const tour = va(progres(t, 0.35, 1.1));
  const minute = -720 * tour;
  const heure = entre(120, 60, tour);
  const [mx, my] = surCercle(120, 128, 60, minute);
  const [hx, hy] = surCercle(120, 128, 40, heure);
  const fleche = progres(t, 0.3, 0.45);
  const [px, py] = surCercle(120, 128, 104, 250);
  return (
    <Cadre {...p} dureeS={microObjet("horloge-envers").dureeS}>
      <circle cx={120} cy={128} r={84} fill={c.papier} {...seDessine(progres(t, 0.02, 0.35))} />
      {[0, 90, 180, 270].map((a) => {
        const [x0, y0] = surCercle(120, 128, 70, a);
        const [x1, y1] = surCercle(120, 128, 60, a);
        return <path key={a} d={`M${x0} ${y0}L${x1} ${y1}`} strokeWidth={6} opacity={progres(t, 0.2, 0.15)} />;
      })}
      <path d={`M120 128L${hx} ${hy}`} strokeWidth={11} />
      <path d={`M120 128L${mx} ${my}`} strokeWidth={8} stroke={c.accent} />
      <circle cx={120} cy={128} r={9} fill={c.accent} stroke="none" />
      <path d={arc(120, 128, 104, 340, 250)} stroke={c.accent} strokeWidth={8} {...seDessine(fleche)} />
      <path d={`M${px + 4} ${py - 16}L${px} ${py}L${px + 16} ${py + 6}`} stroke={c.accent} strokeWidth={8} opacity={fleche >= 1 ? 1 : 0} />
    </Cadre>
  );
}
