/**
 * PASTILLE « Étape N/M · libellé » (G5-02) : dessine la géométrie de `pastilleEtape` (pure), fond transparent, Manrope.
 * Inscrite nulle part : éteinte. Couleurs résolues depuis les NOMS de jetons de la charte (aucun hexadécimal ici).
 */
import { AbsoluteFill } from "remotion";
import { GRAISSES, PILE_CSS, SUR_CLAIR } from "../../../src/briques/charte/axion-2026";
import { pastilleEtape, type OptionsPastille } from "../../../src/briques/plan-scenes/tutoriel/pastille-etape";
import { chargerManrope } from "./PlanDeScenes";

export interface ProprietesPastilleEtape {
  etape: number;
  total: number;
  libelle: string;
  largeur: number;
  hauteur: number;
  options?: OptionsPastille;
}

export function PastilleEtape({ etape, total, libelle, largeur, hauteur, options }: ProprietesPastilleEtape) {
  chargerManrope();
  const p = pastilleEtape(etape, total, libelle, { largeur, hauteur }, options);
  if (!p) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: p.x,
          top: p.y,
          width: p.largeur,
          height: p.hauteur,
          borderRadius: p.rayon,
          background: SUR_CLAIR[p.couleurs.fond],
          color: SUR_CLAIR[p.couleurs.texte],
          fontFamily: PILE_CSS,
          fontWeight: GRAISSES.gras,
          fontSize: p.taillePolice,
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {p.texte}
      </div>
    </AbsoluteFill>
  );
}
