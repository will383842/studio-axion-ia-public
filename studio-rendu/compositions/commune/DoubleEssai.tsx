/**
 * DOUBLE D'ESSAI SIMULÉ (lot M4) : la silhouette seule, sur fond TRANSPARENT, rendue en webm VP9 alpha 1080 × 1920
 * — même forme de fichier que le double HeyGen entraîné avec `matting` (B.3). Sert à essayer le montage complet et à
 * mesurer le décodage d'un webm alpha 1080p par `OffthreadVideo transparent`, sans aucun appel payant.
 */
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Silhouette } from "./Silhouette";

export type ProprietesDoubleEssai = { tenue: string; peau: string; images: number };

export function DoubleEssai({ tenue, peau }: ProprietesDoubleEssai) {
  const image = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <Silhouette tenue={tenue} peau={peau} t={image / fps} />;
}
