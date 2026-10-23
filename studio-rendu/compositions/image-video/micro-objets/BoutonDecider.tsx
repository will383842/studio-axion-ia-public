import React from "react";
/** Micro-objet « bouton décider » : les données (pile) et l'IA (étincelle) se rejoignent, un bouton se forme, le curseur clique, la coche verte s'y dessine. */
import { microObjet } from "../../../../src/briques/schema-motion/micro-objets";
import { Cadre } from "./Cadre";
import { couleursMicro, entre, progres, rebond, seDessine, va, type ProprietesMicroObjet } from "./commun";

export function BoutonDecider(p: ProprietesMicroObjet) {
  const c = couleursMicro(p.fond);
  const { t } = p;
  const rejoint = va(progres(t, 0.25, 0.45));
  const fond1 = 1 - progres(t, 0.6, 0.12);
  const bouton = progres(t, 0.62, 0.3);
  const curseur = va(progres(t, 0.8, 0.35));
  const clic = progres(t, 1.15, 0.22);
  const appui = clic > 0 && clic < 1 ? 1 - 0.08 * Math.sin(clic * Math.PI) : 1;
  const coche = progres(t, 1.25, 0.3);
  const xd = entre(54, 120, rejoint);
  const xi = entre(186, 120, rejoint);
  return (
    <Cadre {...p} dureeS={microObjet("bouton-decider").dureeS}>
      <g opacity={fond1} transform={`translate(${xd} 70) scale(${entre(1, 0.4, rejoint)})`}>
        <ellipse cx={0} cy={-22} rx={30} ry={10} fill={c.papier} />
        <path d="M-30 -22V22c0 6 14 10 30 10s30-4 30-10V-22M-30 0c0 6 14 10 30 10s30-4 30-10" />
      </g>
      <g opacity={fond1} transform={`translate(${xi} 70) scale(${entre(1, 0.4, rejoint)})`}>
        <path d="M6 -36L-20 6h20l-6 30 26-42H0l6-30Z" fill={c.accent} stroke={c.accent} strokeWidth={6} />
      </g>
      {bouton > 0 ? (
        <g transform={`translate(120 150) scale(${(bouton < 1 ? rebond(bouton) : 1) * appui})`}>
          <rect x={-74} y={-30} width={148} height={60} rx={30} fill={coche > 0 ? c.accent : c.papier} stroke={coche > 0 ? c.accent : c.trait} />
          <path d="M-18 2l12 12 26-28" stroke={coche > 0 ? c.blanc : c.piste} strokeWidth={9} {...(coche > 0 ? seDessine(coche * 1.3) : {})} />
        </g>
      ) : null}
      {clic > 0 && clic < 1 ? <circle cx={168} cy={162} r={entre(10, 46, clic)} stroke={c.accent} strokeWidth={5} opacity={1 - clic} /> : null}
      {curseur > 0 ? (
        <g transform={`translate(${entre(236, 168, curseur)} ${entre(236, 162, curseur)}) scale(${appui})`}>
          <path d="M0 0V40l10-9 8 16 8-4-8-15h14Z" fill={c.blanc} stroke={c.encre} strokeWidth={4} />
        </g>
      ) : null}
    </Cadre>
  );
}
