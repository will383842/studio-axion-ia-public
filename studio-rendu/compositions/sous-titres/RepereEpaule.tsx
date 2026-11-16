/** Repère rond près de l'épaule (C2-U18) : pièce neuve, éteinte, importée par aucun fichier existant. */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { geometrieRepere, POLICE_REPERE, type ParametresRepere } from "../../../src/briques/sous-titres/repere-epaule";
import { chargerPolices, FAMILLES } from "./polices";

export const RepereEpaule: React.FC<ParametresRepere> = (p) => {
  chargerPolices([POLICE_REPERE]);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const g = geometrieRepere(p, width, height, frame / fps);
  if (!g) return null;
  const { cercle: c, etiquette: e, couleurs } = g;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: g.opacite, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute", left: c.cx - c.r, top: c.cy - c.r, width: 2 * c.r, height: 2 * c.r,
          borderRadius: "50%", background: couleurs.fond, transform: `scale(${g.echelle})`,
        }}
      />
      <div
        style={{
          position: "absolute", left: e.x, top: e.y, width: e.largeur, height: e.hauteur, borderRadius: e.hauteur / 2,
          background: couleurs.fond, color: couleurs.texte, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: `"${FAMILLES[POLICE_REPERE]}", sans-serif`, fontSize: e.taillePolice, whiteSpace: "nowrap",
          transform: `scale(${g.echelle})`,
        }}
      >
        {e.texte}
      </div>
    </div>
  );
};
