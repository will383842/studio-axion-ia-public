import React from "react";
/** Micro-objet « courbe qui monte » : les axes se tracent, la courbe orange grimpe jusqu'en haut, la pointe arrive en dernier, l'aire se teinte et reste haut. */
import { microObjet } from "../../../../src/briques/schema-motion/micro-objets";
import { Cadre } from "./Cadre";
import { couleursMicro, progres, seDessine, teinte, type ProprietesMicroObjet } from "./commun";

const COURBE = "M40 186L82 152L116 166L154 108L198 54";

export function GrapheMonte(p: ProprietesMicroObjet) {
  const c = couleursMicro(p.fond);
  const { t } = p;
  const trace = progres(t, 0.3, 0.8);
  const pointe = progres(t, 1.05, 0.2);
  return (
    <Cadre {...p} dureeS={microObjet("graphe-monte").dureeS}>
      <path d={`${COURBE}V206H40Z`} fill={teinte(c.accent, 0.16)} stroke="none" opacity={progres(t, 1.0, 0.4)} />
      <path d="M28 30V206H216" {...seDessine(progres(t, 0.02, 0.3))} />
      <path d={COURBE} stroke={c.accent} strokeWidth={12} {...seDessine(trace)} />
      <path d="M176 52L198 54L196 76" stroke={c.accent} strokeWidth={12} opacity={pointe} />
      {[82, 116, 154].map((x, i) => (
        <circle key={x} cx={x} cy={[152, 166, 108][i]} r={7} fill={c.papier} stroke={c.accent} strokeWidth={6} opacity={trace > (i + 1) / 4.2 ? 1 : 0} />
      ))}
    </Cadre>
  );
}
