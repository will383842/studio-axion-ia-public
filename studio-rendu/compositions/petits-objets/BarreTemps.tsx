/**
 * BARRE DE TEMPS FINE : habillage Remotion seulement. Lit l'image courante, dessine `barreTemps` (pur).
 * Aucun branchement : rien n'importe ce fichier (non inscrit, éteint).
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { barreTemps, type MargesBoutons } from "../../../src/briques/motion/petits-objets/barre-temps";
import type { FondAxion } from "../../../src/briques/jetons-motion";

export function BarreTemps({ zone, fond, dureeImages }: { zone: MargesBoutons; fond: FondAxion; dureeImages?: number }) {
  const image = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const b = barreTemps({ image, dureeImages: dureeImages ?? durationInFrames, zone, fond });
  if (b.boite.largeur <= 0) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: `${b.rail.boite.x}%`,
          top: `${b.rail.boite.y}%`,
          width: `${b.rail.boite.largeur}%`,
          height: `${b.rail.boite.hauteur}%`,
          background: b.rail.couleur,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `${b.boite.x}%`,
          top: `${b.boite.y}%`,
          width: `${b.boite.largeur}%`,
          height: `${b.boite.hauteur}%`,
          background: b.couleur,
        }}
      />
    </AbsoluteFill>
  );
}
