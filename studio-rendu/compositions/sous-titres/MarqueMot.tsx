/** Variantes de la plaque d'un mot (C11-T3) : pièce neuve, éteinte, importée par aucun fichier existant. Couleurs reçues en propriété. */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { NomPolice } from "../../../src/briques/sous-titres/mesure";
import { geometrieMarque, type MarqueMot as Marque } from "../../../src/briques/sous-titres/marques-mot";
import type { GeometriePave } from "../../../src/briques/sous-titres/pave";
import { chargerPolices, FAMILLES } from "./polices";

export type ParametresMarqueMot = {
  marque: Marque;
  /** Géométrie de base à l'instant t (s depuis le début du mot), fournie par l'appelant ; `null` avant le mot. */
  baseA: (t: number) => GeometriePave | null;
  taillePx: number;
  debutS: number;
  texte: string;
  graine: string;
  couleurs: { fond: string; texte: string };
  police: NomPolice;
};

export const MarqueMot: React.FC<ParametresMarqueMot> = ({ marque, baseA, taillePx, debutS, texte, graine, couleurs, police }) => {
  chargerPolices([police]);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps - debutS;
  const g = geometrieMarque(marque, baseA(t), taillePx, graine);
  if (!g) return null;
  const b = g.base;
  const contour = g.contourSeul === true;
  const transform = `rotate(${b.inclinaisonDeg}deg) scale(${b.echelle})`;
  const centre = `${b.x + b.largeur / 2}px ${b.y + b.hauteur / 2}px`;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: b.opacite }}>
      {g.chemin ? (
        <svg width="100%" height="100%" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <path d={g.chemin} fill={couleurs.fond} style={{ transform, transformOrigin: centre }} />
        </svg>
      ) : (
        <div
          style={{
            position: "absolute", left: b.x, top: b.y + (g.decalageYPx ?? 0), width: b.largeur, height: b.hauteur,
            borderRadius: b.rayon, transform, transformOrigin: "center",
            background: contour ? "transparent" : couleurs.fond,
            border: contour ? `${Math.max(2, taillePx * 0.05)}px solid ${couleurs.fond}` : undefined,
            boxSizing: "border-box",
          }}
        />
      )}
      <div
        style={{
          position: "absolute", left: b.x, top: b.y, width: b.largeur, height: b.hauteur,
          display: "flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap",
          color: contour ? "transparent" : couleurs.texte,
          WebkitTextStroke: contour ? `${Math.max(1.5, taillePx * 0.03)}px ${couleurs.fond}` : undefined,
          fontFamily: `"${FAMILLES[police]}", sans-serif`, fontSize: taillePx,
        }}
      >
        {texte}
      </div>
    </div>
  );
};
