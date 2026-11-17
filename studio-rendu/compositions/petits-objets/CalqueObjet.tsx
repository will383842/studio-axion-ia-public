/**
 * CALQUE « PETIT OBJET » : habillage Remotion seulement. Lit l'image courante et la passe à `def.Rendu` (dessin pur).
 * Aucun branchement : rien n'importe ce fichier.
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { DefinitionObjet, TonObjet } from "../../../src/briques/motion/petits-objets/contrat";
import type { FondAxion } from "../../../src/briques/jetons-motion";

export function CalqueObjet<P>({ def, parametres, fond, ton, graine, dureeImages }: { def: DefinitionObjet<P>; parametres: P; fond: FondAxion; ton?: TonObjet; graine: number; dureeImages: number }) {
  const image = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {def.Rendu({ image, fps, dureeImages, fond, ton, graine, parametres })}
    </AbsoluteFill>
  );
}
