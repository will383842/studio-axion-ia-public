/** Mot-clé en pavé (C2-U7b) : pièce neuve, éteinte, importée par aucun fichier existant. Couleurs reçues en propriété. */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { NomPolice } from "../../../src/briques/sous-titres/mesure";
import { geometriePave, type BoitePave } from "../../../src/briques/sous-titres/pave";
import { chargerPolices, FAMILLES } from "./polices";

export type ParametresMotPave = {
  boite: BoitePave;
  taillePx: number;
  debutS: number;
  texte: string;
  couleurs: { fond: string; texte: string };
  police: NomPolice;
};

export const MotPave: React.FC<ParametresMotPave> = ({ boite, taillePx, debutS, texte, couleurs, police }) => {
  chargerPolices([police]);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const g = geometriePave(boite, taillePx, frame / fps - debutS);
  if (!g) return null;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute", left: g.x, top: g.y, width: g.largeur, height: g.hauteur, borderRadius: g.rayon,
          background: couleurs.fond, opacity: g.opacite,
          transform: `rotate(${g.inclinaisonDeg}deg) scale(${g.echelle})`,
        }}
      />
      <div
        style={{
          position: "absolute", left: boite.xPx, top: boite.yPx, width: boite.largeurPx, height: boite.hauteurPx,
          display: "flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap", opacity: g.opacite,
          color: couleurs.texte, fontFamily: `"${FAMILLES[police]}", sans-serif`, fontSize: taillePx,
        }}
      >
        {texte}
      </div>
    </div>
  );
};
