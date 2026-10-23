import React from "react";
/** Micro-objet « escalier » : quatre marches montent l'une après l'autre (la dernière en orange), une étoile surgit au sommet et scintille. */
import { microObjet } from "../../../../src/briques/schema-motion/micro-objets";
import { Cadre } from "./Cadre";
import { couleursMicro, progres, rebond, surCercle, type ProprietesMicroObjet } from "./commun";

const SOL = 214;
const LARGEUR = 46;

function etoile(cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const [x, y] = surCercle(cx, cy, i % 2 === 0 ? r : r * 0.45, i * 36);
    points.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `M${points.join("L")}Z`;
}

export function Escalier(p: ProprietesMicroObjet) {
  const c = couleursMicro(p.fond);
  const { t } = p;
  const pop = progres(t, 1.05, 0.3);
  const eclat = progres(t, 1.2, 0.4);
  const sx = 28 + 3 * LARGEUR + LARGEUR / 2;
  const sy = SOL - 4 * 40 - 28;
  return (
    <Cadre {...p} dureeS={microObjet("escalier").dureeS}>
      <path d={`M16 ${SOL}H224`} stroke={c.piste} />
      {[0, 1, 2, 3].map((i) => {
        const x = progres(t, 0.1 + 0.2 * i, 0.28);
        const h = 40 * (i + 1);
        const s = x > 0 ? rebond(x) : 0;
        const derniere = i === 3;
        return (
          <g key={i} transform={`translate(0 ${SOL}) scale(1 ${s}) translate(0 ${-SOL})`} opacity={x > 0 ? 1 : 0}>
            <rect x={28 + i * LARGEUR} y={SOL - h} width={LARGEUR} height={h} rx={6} fill={derniere ? c.accent : c.papier} stroke={derniere ? c.accent : c.trait} />
          </g>
        );
      })}
      {pop > 0 ? (
        <g transform={`translate(${sx} ${sy}) rotate(${(1 - pop) * -72}) scale(${rebond(pop)}) translate(${-sx} ${-sy})`}>
          <path d={etoile(sx, sy, 24)} fill={c.accent} stroke={c.accent} strokeWidth={6} />
        </g>
      ) : null}
      {eclat > 0 && eclat < 1
        ? [0, 90, 180, 270].map((a) => {
            const [x0, y0] = surCercle(sx, sy, 32 + 14 * eclat, a + 45);
            const [x1, y1] = surCercle(sx, sy, 42 + 18 * eclat, a + 45);
            return <path key={a} d={`M${x0} ${y0}L${x1} ${y1}`} stroke={c.accent} strokeWidth={6} opacity={1 - eclat} />;
          })
        : null}
    </Cadre>
  );
}
