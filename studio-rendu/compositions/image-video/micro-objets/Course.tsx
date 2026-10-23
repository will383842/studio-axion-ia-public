import React from "react";
/** Micro-objet « course de flèches » : deux flèches partent, la noire mène, puis l'orange accélère, la double et franchit la ligne d'arrivée la première. */
import { microObjet } from "../../../../src/briques/schema-motion/micro-objets";
import { Cadre } from "./Cadre";
import { couleursMicro, entre, progres, va, type ProprietesMicroObjet } from "./commun";

const DEPART = 34;
const ARRIVEE = 200;

function Fleche({ pointe, y, couleur, epaisseur }: { pointe: number; y: number; couleur: string; epaisseur: number }) {
  const queue = Math.max(DEPART, pointe - 76);
  return (
    <g stroke={couleur} strokeWidth={epaisseur}>
      <path d={`M${queue} ${y}H${pointe}`} />
      <path d={`M${pointe - 18} ${y - 16}L${pointe} ${y}L${pointe - 18} ${y + 16}`} />
    </g>
  );
}

export function Course(p: ProprietesMicroObjet) {
  const c = couleursMicro(p.fond);
  const { t } = p;
  const x = progres(t, 0.2, 1.15);
  const noire = entre(DEPART + 20, 178, va(x));
  const orange = entre(DEPART + 20, 222, Math.pow(x, 2.1));
  const passe = orange > ARRIVEE;
  const vitesse = progres(t, 0.75, 0.2) * (1 - progres(t, 1.3, 0.3));
  return (
    <Cadre {...p} dureeS={microObjet("course").dureeS}>
      <path d={`M${DEPART} 120H${ARRIVEE + 16}`} stroke={c.piste} strokeWidth={5} strokeDasharray="12 14" />
      <path d={`M${ARRIVEE} 40V200`} stroke={passe ? c.accent : c.trait} strokeWidth={7} strokeDasharray="16 10" />
      <Fleche pointe={noire} y={162} couleur={c.trait} epaisseur={10} />
      <Fleche pointe={orange} y={80} couleur={c.accent} epaisseur={13} />
      {[64, 80, 96].map((y, i) => (
        <path key={y} d={`M${orange - 96 - 10 * (i % 2)} ${y}h${-22}`} stroke={c.accent} strokeWidth={6} opacity={vitesse * (orange > DEPART + 110 ? 1 : 0)} />
      ))}
    </Cadre>
  );
}
