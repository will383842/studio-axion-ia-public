/** Mode carte (C11-T7) : pièce neuve, éteinte, importée par aucun fichier existant. Ne fait que dessiner la géométrie. */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { geometrieCarteGroupe, POLICE_CARTE, type ParametresCarte } from "../../../src/briques/sous-titres/mode-carte";
import { chargerPolices, FAMILLES } from "./polices";

export const CarteGroupe: React.FC<ParametresCarte> = (p) => {
  chargerPolices([POLICE_CARTE]);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const g = geometrieCarteGroupe(p, width, height, frame / fps);
  if (!g) return null;
  return (
    <div
      style={{
        position: "absolute", left: g.cadre.x, top: g.cadre.y, width: g.cadre.largeur, height: g.cadre.hauteur,
        background: g.couleurs.fond, color: g.couleurs.texte, opacity: g.opacite, pointerEvents: "none",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center",
        fontFamily: `"${FAMILLES[POLICE_CARTE]}", sans-serif`, fontSize: g.taillePolice, lineHeight: g.interligne,
      }}
    >
      {g.lignes.map((l, i) => (
        <div key={i} style={{ whiteSpace: "nowrap" }}>{l}</div>
      ))}
    </div>
  );
};
