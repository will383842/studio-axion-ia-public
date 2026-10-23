import { useRef } from "react";
import { chargerPoliceArchivoBlack, chargerPoliceJetBrainsMono } from "../polices";
import { COMPOSANTS_MINI } from "../mini";
import type { CarteSpec } from "./types";
import { useControleDebordement } from "./controle-debordement";
import { COULEURS, POLICE_CORPS, POLICE_TITRE, TAILLES } from "./constantes";

interface Proprietes {
  carte: CarteSpec;
  /** Rang de la carte dans la page (à partir de 1). */
  rang: number;
  /** Côté (px) du mini-visuel. */
  miniTaille: number;
  /** Carte large (page à une colonne) : mini-visuel à gauche, titre et texte à droite. */
  enLigne?: boolean;
}

/** Carte de la page dense : mini-visuel éventuel, titre en Archivo Black, corps en JetBrains Mono. Textes du spec seulement. */
export function Carte({ carte, rang, miniTaille, enLigne = false }: Proprietes) {
  chargerPoliceArchivoBlack();
  chargerPoliceJetBrainsMono();
  const cadre = useRef<HTMLDivElement>(null);
  // Le cadre coupe ce qui dépasse (`overflow: hidden`) : le rendu échoue plutôt que de couper le texte.
  useControleDebordement(cadre, carte.titre, "la carte", [carte.titre, carte.corps, carte.mini]);
  const Mini = carte.mini ? COMPOSANTS_MINI[carte.mini] : null;
  const miniature = Mini && (
    <div style={{ flexShrink: 0, width: miniTaille, height: miniTaille }}>
      <Mini taille={miniTaille} rang={rang} />
    </div>
  );
  const titre = <div style={{ fontFamily: POLICE_TITRE, fontSize: TAILLES.carteTitre, lineHeight: 1.1, color: COULEURS.encre }}>{carte.titre}</div>;
  const corps = <div style={{ fontFamily: POLICE_CORPS, fontWeight: 500, fontSize: TAILLES.corps, lineHeight: 1.3, color: COULEURS.encre }}>{carte.corps}</div>;
  return (
    <div
      ref={cadre}
      style={{
        boxSizing: "border-box",
        height: "100%",
        padding: 26,
        borderRadius: 28,
        background: COULEURS.pale,
        border: `4px solid ${COULEURS.encre}`,
        display: "flex",
        flexDirection: enLigne ? "row" : "column",
        alignItems: enLigne ? "center" : undefined,
        justifyContent: enLigne ? undefined : "center",
        gap: enLigne ? 28 : 14,
        overflow: "hidden",
      }}
    >
      {enLigne ? (
        <>
          {miniature}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {titre}
            {corps}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {miniature}
            {titre}
          </div>
          {corps}
        </>
      )}
    </div>
  );
}
