import React from "react";
/**
 * TRA-B · raccord d'objet (maquette TraB1/TraB2) : la coche verte d'une carte grossit jusqu'à couvrir l'écran qui part
 * (sortie ; si la carte n'était pas cochée, la coche s'y pose d'abord) ; l'écran qui arrive s'ouvre depuis ce vert, par
 * un cercle qui s'agrandit au centre, la coche blanche s'effaçant (entrée). À la jointure, l'écran est vert des deux
 * côtés (sous la marque). Aucun JSX au niveau module.
 */
import { AbsoluteFill } from "remotion";
import { COULEURS_DUO } from "../../../../../src/briques/habillage/charte-duo";
import { teinte } from "../../../cas-concret/plans/commun";

const C = COULEURS_DUO;

function Coche({ x, y, taille, opacite = 1 }: { x: number; y: number; taille: number; opacite?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" style={{ position: "absolute", left: x - taille / 2, top: y - taille / 2, opacity: opacite }} fill="none" stroke={C.blanc} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

const loin = (x: number, y: number, l: number, h: number) => Math.max(...[[0, 0], [l, 0], [0, h], [l, h]].map(([a, b]) => Math.hypot(a - x, b - y))) + 20;

export function Raccord({ sens, avance, haut, hauteur, largeur, x = largeur / 2, y = hauteur / 2, r = 46, posee = false }: { sens: "sortie" | "entree"; avance: number; haut: number; hauteur: number; largeur: number; x?: number; y?: number; r?: number; posee?: boolean }) {
  if (sens === "sortie") {
    // Si la coche se pose : elle surgit pendant le premier quart, puis grossit.
    const pose = posee ? Math.min(1, avance / 0.25) : 1;
    const u = posee ? Math.max(0, (avance - 0.25) / 0.75) : avance;
    const rayon = r * pose + (loin(x, y, largeur, hauteur) - r) * u * u;
    return (
      <AbsoluteFill style={{ clipPath: `inset(${haut}px 0 0 0)` }}>
        <div style={{ position: "absolute", left: x - rayon, top: y - rayon, width: 2 * rayon, height: 2 * rayon, borderRadius: "50%", background: C.vert, boxShadow: `0 30px 70px ${teinte(C.vert, 0.25)}` }} />
        <Coche x={x} y={y} taille={Math.min(320, rayon * 1.1)} />
      </AbsoluteFill>
    );
  }
  const cx = largeur / 2;
  const cy = hauteur * 0.45;
  const trou = loin(cx, cy, largeur, hauteur) * (1 - (1 - avance) * (1 - avance));
  const masque = `radial-gradient(circle at ${cx}px ${cy}px, transparent ${trou}px, #000 ${trou + 1}px)`;
  return (
    <AbsoluteFill style={{ clipPath: `inset(${haut}px 0 0 0)` }}>
      <AbsoluteFill style={{ background: C.vert, maskImage: masque, WebkitMaskImage: masque }} />
      <Coche x={cx} y={cy} taille={320 * (1 - 0.4 * avance)} opacite={1 - avance} />
    </AbsoluteFill>
  );
}
