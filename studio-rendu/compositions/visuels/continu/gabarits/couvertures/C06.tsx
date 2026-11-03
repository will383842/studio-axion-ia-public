/** C06 Manifeste et plaques : phrase-manifeste en Instrument Serif italique sur fond pêche, trois plaques empilées en perspective. */
import { useId } from "react";
import { alpha, CHARTE_CONTINU as C, degrade } from "../../../../../../src/briques/visuels/charte-carrousel";
import { Etincelle, police, Pose, POLICE_SERIF, Tuile } from "../../commun/Primitives";
import type { ProprietesPlaquette } from "../../types";
import { Cadre, typo, ZoneTexte } from "./commun";

/** Une plaque : losange du dessus, face gauche, face droite (maquette `plate`). */
function Plaque({ cx, y, w, h, t, dessus, gauche, droite }: { cx: number; y: number; w: number; h: number; t: number; dessus: string; gauche: string; droite: string }) {
  const pts = (...p: number[][]) => p.map(([x, yy]) => `${x},${yy}`).join(" ");
  return (
    <>
      <polygon points={pts([cx, y], [cx + w, y + h], [cx, y + 2 * h], [cx - w, y + h])} fill={dessus} />
      <polygon points={pts([cx - w, y + h], [cx, y + 2 * h], [cx, y + 2 * h + t], [cx - w, y + h + t])} fill={gauche} />
      <polygon points={pts([cx, y + 2 * h], [cx + w, y + h], [cx + w, y + h + t], [cx, y + 2 * h + t])} fill={droite} />
    </>
  );
}

function Plaques({ taille }: { taille: number }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const faces = (clair: string, dose: number) => `color-mix(in srgb, ${clair} ${dose}%, ${C.rouille})`;
  return (
    <div style={{ position: "relative", width: taille, height: taille }}>
      <svg width={taille} height={taille} viewBox="0 0 700 700" aria-hidden style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={`p${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={C.ecume} />
            <stop offset="1" stopColor={C.peau} />
          </linearGradient>
          <linearGradient id={`k${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={C.brun} />
            <stop offset="1" stopColor={C.brunNuit} />
          </linearGradient>
          <linearGradient id={`o${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={C.orangeLumiere} />
            <stop offset="1" stopColor={C.orange} />
          </linearGradient>
          <filter id={`f${id}`} x="-30%" y="-30%" width="160%" height="170%">
            <feDropShadow dx="0" dy="26" stdDeviation="22" floodColor={C.rouille} floodOpacity={0.34} />
          </filter>
        </defs>
        <g filter={`url(#f${id})`}>
          <Plaque cx={350} y={430} w={300} h={150} t={44} dessus={`url(#p${id})`} gauche={faces(C.peau, 84)} droite={faces(C.peau, 70)} />
          <Plaque cx={350} y={320} w={300} h={150} t={44} dessus={`url(#k${id})`} gauche={C.brunNuit} droite={C.nuit} />
          <Plaque cx={350} y={210} w={300} h={150} t={44} dessus={`url(#o${id})`} gauche={C.orangeBrule} droite={C.rouille} />
        </g>
      </svg>
      <Pose x={taille * 0.4} y={taille * 0.2}>
        <Tuile icone="spark" taille={Math.round(taille * 0.2)} variante="w" />
      </Pose>
    </div>
  );
}

export function C06({ page, hauteur }: ProprietesPlaquette) {
  // Fond pêche (`.pl`), fondu sur les 140 derniers px : la couture 1/2 passe du pêche au crème sans arête.
  const fond = <div style={{ position: "absolute", inset: 0, background: degrade(90, [C.peche, `${C.peche} 87%`, alpha(C.peche, 0)]) }} />;
  return (
    <Cadre hauteur={hauteur} fond={fond}>
      <Pose x={430} y={760}>
        <Plaques taille={700} />
      </Pose>
      <Pose x={110} y={1000}>
        <Etincelle taille={60} />
      </Pose>
      <Pose x={200} y={900}>
        <Etincelle taille={28} couleur={C.encre} />
      </Pose>
      <ZoneTexte>
        <div style={{ ...police(400, 134, 0.98, POLICE_SERIF, true), letterSpacing: "-0.02em", marginTop: 20, color: C.encre }}>
          {typo(String(page.titre))} <span style={{ color: C.orange }}>{typo(String(page.accent))}</span>
        </div>
      </ZoneTexte>
    </Cadre>
  );
}
