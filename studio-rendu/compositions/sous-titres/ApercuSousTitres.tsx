/**
 * APERÇU DE CONTRÔLE des sous-titres (captures du lot M2, rendu `still`) : le calque sur un fond (noir, image
 * claire, photo de démonstration), avec, au besoin, une SIMULATION DE DEUTÉRANOPIE (matrice de Machado 2009,
 * sévérité 1) pour vérifier que l'orange reste distinct du crème.
 */
import { AbsoluteFill, Img } from "remotion";
import { CalqueSousTitres, type ProprietesCalque } from "./CalqueSousTitres";

export type ProprietesApercu = ProprietesCalque & {
  /** Couleur de fond, ou image (adresse ou `data:`). */
  fond: { couleur?: string; image?: string };
  deuteranopie?: boolean;
  /** Légende de la capture (en haut, hors zone vidéo), facultative. */
  legende?: string;
};

const MATRICE_DEUTERANOPIE = "0.367322 0.860646 -0.227968 0 0  0.280085 0.672501 0.047413 0 0  -0.011820 0.042940 0.968881 0 0  0 0 0 1 0";

export function ApercuSousTitres({ fond, deuteranopie, legende, ...calque }: ProprietesApercu) {
  return (
    <AbsoluteFill style={{ backgroundColor: fond.couleur ?? "#000" }}>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <filter id="deuteranopie" colorInterpolationFilters="linearRGB">
          <feColorMatrix type="matrix" values={MATRICE_DEUTERANOPIE} />
        </filter>
      </svg>
      <AbsoluteFill style={{ filter: deuteranopie ? "url(#deuteranopie)" : undefined }}>
        {fond.image && <Img src={fond.image} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        <CalqueSousTitres {...calque} />
      </AbsoluteFill>
      {legende && (
        <div style={{ position: "absolute", left: 24, top: 24, padding: "8px 16px", borderRadius: 12, background: "rgba(0,0,0,0.55)", color: "#fff", fontFamily: "sans-serif", fontSize: 30, fontWeight: 700 }}>
          {legende}
        </div>
      )}
    </AbsoluteFill>
  );
}
