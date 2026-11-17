/**
 * PASTILLE « RÉALISÉ AVEC L'IA » : habillage Remotion seulement (Manrope). Dessine `pastilleIA` (pur) pendant 2 s.
 * Aucun branchement : rien n'importe ce fichier (non inscrit, éteint). Aucun interrupteur créé ici.
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import {
  pastilleIA,
  pastilleVisible,
  TAILLE_TEXTE_PASTILLE_IA,
  type EntreesMentionIA,
  type MargesBoutonsIA,
} from "../../../src/briques/habillage/mention-ia";
import { CHARTE_AXION, FAMILLE_CSS_AXION } from "../../../src/briques/jetons-motion";

export function MentionIA({ entrees, autorise, zone }: { entrees: EntreesMentionIA; autorise: unknown; zone: MargesBoutonsIA }) {
  const image = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const p = pastilleIA({ entrees, autorise, zone });
  if (!p || !pastilleVisible(p, image, fps)) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: `${p.boite.x}%`,
          top: `${p.boite.y}%`,
          width: `${p.boite.largeur}%`,
          height: `${p.boite.hauteur}%`,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
        }}
      >
        <span
          style={{
            fontFamily: FAMILLE_CSS_AXION,
            fontWeight: 600,
            fontSize: Math.round(height * TAILLE_TEXTE_PASTILLE_IA),
            color: CHARTE_AXION.ivoire,
            background: CHARTE_AXION.noir,
            padding: "0.15em 0.6em",
            borderRadius: 999,
            whiteSpace: "nowrap",
          }}
        >
          {p.texte}
        </span>
      </div>
    </AbsoluteFill>
  );
}
