import React from "react";
/** Micro-objet « tirelire » : deux croix (erreurs, temps perdu) s'effacent, puis une pièce tombe dans la fente ; la tirelire s'écrase un instant. */
import { microObjet } from "../../../../src/briques/schema-motion/micro-objets";
import { Cadre } from "./Cadre";
import { couleursMicro, entre, progres, rebond, type ProprietesMicroObjet } from "./commun";

export function Tirelire(p: ProprietesMicroObjet) {
  const c = couleursMicro(p.fond);
  const { t } = p;
  const chute = progres(t, 0.75, 0.45);
  const yPiece = entre(14, 92, chute * chute);
  const entree = progres(t, 1.2, 0.18);
  const choc = progres(t, 1.2, 0.35);
  const ecrase = choc > 0 && choc < 1 ? 1 - 0.07 * Math.sin(choc * Math.PI) : 1;
  return (
    <Cadre {...p} dureeS={microObjet("tirelire").dureeS}>
      {[
        { x: 52, y: 44 },
        { x: 190, y: 52 },
      ].map((k, i) => {
        const pose = progres(t, 0.08 + 0.1 * i, 0.2);
        const efface = progres(t, 0.45 + 0.1 * i, 0.25);
        const s = (pose < 1 ? rebond(pose) : 1) * (1 - efface);
        return (
          <g key={i} transform={`translate(${k.x} ${k.y}) rotate(${efface * 90}) scale(${Math.max(0, s)})`} stroke={c.accent} strokeWidth={9}>
            <path d="M-14 -14L14 14M14 -14L-14 14" />
          </g>
        );
      })}
      {entree < 1 ? (
        <g transform={`translate(120 ${yPiece}) scale(${entre(1, 0.35, chute)} ${1 - entree})`} opacity={Math.min(1, chute * 5)}>
          <circle r={22} fill={c.accent} stroke={c.accent} strokeWidth={6} />
          <circle r={11} stroke={c.blanc} strokeWidth={5} />
        </g>
      ) : null}
      <g transform={`translate(120 214) scale(${2 - ecrase} ${ecrase}) translate(-120 -214)`}>
        <ellipse cx={120} cy={152} rx={78} ry={56} fill={c.papier} />
        <path d="M196 136h12v30h-12" fill={c.papier} />
        <path d="M144 100l16-24 10 30" fill={c.papier} />
        <path d="M84 204v12M156 204v12" />
        <path d="M42 140c-14 0-18-14-6-18" strokeWidth={7} />
        <circle cx={170} cy={140} r={5} fill={c.trait} stroke="none" />
        <path d="M100 102H140" strokeWidth={11} />
      </g>
    </Cadre>
  );
}
