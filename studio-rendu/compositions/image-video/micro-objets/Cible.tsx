import React from "react";
/** Micro-objet « cible » : les anneaux se dessinent, la flèche arrive du coin et se plante au centre, vibre, une onde orange part du centre. */
import { microObjet } from "../../../../src/briques/schema-motion/micro-objets";
import { Cadre } from "./Cadre";
import { couleursMicro, entre, progres, seDessine, type ProprietesMicroObjet } from "./commun";

const CX = 110;
const CY = 132;

export function Cible(p: ProprietesMicroObjet) {
  const c = couleursMicro(p.fond);
  const { t } = p;
  const vol = progres(t, 0.5, 0.32);
  const v2 = vol * vol;
  const x = entre(CX + 170, CX, v2);
  const y = entre(CY - 170, CY, v2);
  const apres = Math.max(0, t - 0.82);
  const vibre = vol >= 1 ? Math.sin(apres * 55) * Math.exp(-apres * 7) * 7 : 0;
  const onde = progres(t, 0.82, 0.45);
  return (
    <Cadre {...p} dureeS={microObjet("cible").dureeS}>
      <circle cx={CX} cy={CY} r={88} fill={c.papier} {...seDessine(progres(t, 0.02, 0.25))} />
      <circle cx={CX} cy={CY} r={56} {...seDessine(progres(t, 0.12, 0.22))} />
      <circle cx={CX} cy={CY} r={24} fill={c.accent} stroke={c.accent} opacity={progres(t, 0.25, 0.15)} />
      {onde > 0 && onde < 1 ? <circle cx={CX} cy={CY} r={entre(24, 80, onde)} stroke={c.accent} strokeWidth={6} opacity={1 - onde} /> : null}
      {vol > 0 ? (
        <g transform={`translate(${x} ${y}) rotate(${-45 + vibre})`}>
          <path d="M8 0H112" />
          <path d="M92 0l18 -16M92 0l18 16M108 0l18 -16M108 0l18 16" stroke={c.accent} strokeWidth={7} />
        </g>
      ) : null}
    </Cadre>
  );
}
