/**
 * Raccord par forme (X1-06) : une forme pleine de la charte se transforme en une autre (cercle↔cercle, carré↔carte) par
 * `interpolatePath`. ÉTEINT : aucune composition ne l'enregistre, rien ne l'importe. Rien si le plan montre un visage ou si
 * la paire n'est pas compatible. Aucun hasard, aucune horloge : même image = même chemin. Aucun son.
 */
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { interpolatePath } from "@remotion/paths";
import { adoucir, progression } from "../../../../src/briques/jetons-motion";
import { choisirRaccordForme, type EntreeRaccordForme } from "../../../../src/briques/motion/habillage-commun/raccord-forme";

export type ProprietesRaccordForme = EntreeRaccordForme & { debut?: number; duree?: number };

export function RaccordForme({ debut = 0, duree = 14, ...entree }: ProprietesRaccordForme) {
  const frame = useCurrentFrame();
  // Jamais devant un visage : `choisirRaccordForme` rend null quand `avecVisage` est vrai.
  if (entree.avecVisage) return null;
  const raccord = choisirRaccordForme(entree);
  if (!raccord) return null;
  const t = progression(frame, debut, duree, adoucir);
  const d = interpolatePath(t, raccord.cheminDe, raccord.cheminVers);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={entree.boite.largeur} height={entree.boite.hauteur} viewBox={`0 0 ${entree.boite.largeur} ${entree.boite.hauteur}`}>
        <path d={d} fill={raccord.couleur} />
      </svg>
    </AbsoluteFill>
  );
}
