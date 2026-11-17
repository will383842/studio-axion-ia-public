/** C11-T6b-b : monté nulle part ; prise floutée, planche et inscription = C11-T6b-c. « Étape N » qui monte au tiers haut. Image reçue en propriété (aucun accès à l’horloge Remotion), aucun fond, aucun filtre. */
import React from "react";
import { PALETTE, PILE_CSS } from "../../../../src/briques/charte/axion-2026";
import {
  ETAPE_HAUTEUR_PCT,
  ETAPE_LARGEUR_PCT,
  ETAPE_X_PCT,
  TAILLES_TEXTE,
  etapeMontante,
} from "../../../../src/briques/motion/titres-couverture/etapes";
import { chargerPolicesMotion } from "../motion/polices";

export type ParametresEtapeMontante = {
  numero: number;
  libelle: string;
  debutImage: number;
  ips: number;
  /** Image courante, fournie par l'appelant. */
  image: number;
  couleurTexte?: string;
  couleurFond?: string;
};

export const EtapeMontante: React.FC<ParametresEtapeMontante> = ({
  numero,
  libelle,
  debutImage,
  ips,
  image,
  couleurTexte = PALETTE.ivoire,
  couleurFond = PALETTE.noir,
}) => {
  // L'erreur de la règle pure sur une entrée invalide passe telle quelle (pas de repli silencieux).
  const { y, opacite, echelle } = etapeMontante({ numero, libelle, debutImage, ips })(image);
  if (opacite === 0) return null;
  chargerPolicesMotion();
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", containerType: "size" }}>
      <div
        data-etape-montante={numero}
        style={{
          position: "absolute",
          left: `${ETAPE_X_PCT}%`,
          top: `${y}%`,
          width: `${ETAPE_LARGEUR_PCT}%`,
          height: `${ETAPE_HAUTEUR_PCT}%`,
          opacity: opacite,
          transform: `scale(${echelle})`,
          transformOrigin: "center top",
          color: couleurTexte,
          backgroundColor: couleurFond,
          fontFamily: PILE_CSS,
          fontWeight: TAILLES_TEXTE.etape.graisse,
          fontSize: `${TAILLES_TEXTE.etape.taillePctHauteur}cqh`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.4em",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        <span>{`Étape ${numero}`}</span>
        <span>{libelle}</span>
      </div>
    </div>
  );
};
