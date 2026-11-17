/** C11-T6b-b : monté nulle part ; prise floutée, planche et inscription = C11-T6b-c. Pastille de contexte tenue toute la vidéo, hors visage, une ligne. */
import React from "react";
import { PALETTE, PILE_CSS } from "../../../../src/briques/charte/axion-2026";
import { TAILLES_TEXTE, pastilleContexte, type RatioCouverture } from "../../../../src/briques/motion/titres-couverture/etapes";
import { chargerPolicesMotion } from "../motion/polices";

export type ParametresPastilleContexte = {
  texte: string;
  ratio: RatioCouverture;
  couleurTexte?: string;
  couleurFond?: string;
};

export const PastilleContexte: React.FC<ParametresPastilleContexte> = ({
  texte,
  ratio,
  couleurTexte = PALETTE.ivoire,
  couleurFond = PALETTE.noir,
}) => {
  // L'erreur de la règle pure sur une entrée invalide passe telle quelle (pas de repli silencieux).
  const r = pastilleContexte({ texte, ratio });
  chargerPolicesMotion();
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", containerType: "size" }}>
      <div
        data-pastille-contexte=""
        style={{
          position: "absolute",
          left: `${r.x}%`,
          top: `${r.y}%`,
          width: `${r.largeur}%`,
          height: `${r.hauteur}%`,
          borderRadius: 9999,
          color: couleurTexte,
          backgroundColor: couleurFond,
          fontFamily: PILE_CSS,
          fontWeight: TAILLES_TEXTE.pastille.graisse,
          fontSize: `${TAILLES_TEXTE.pastille.taillePctHauteur}cqh`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {texte.trim()}
      </div>
    </div>
  );
};
