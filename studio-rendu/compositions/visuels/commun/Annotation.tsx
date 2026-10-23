import { COULEURS } from "./constantes";

/** Annotation graphique (jamais manuscrite, sans texte) : trait orange épais et net, pour souligner un titre. */
export function Annotation({ largeur, epaisseur = 16, couleur = COULEURS.orange }: { largeur: number; epaisseur?: number; couleur?: string }) {
  return (
    <svg width={largeur} height={epaisseur} viewBox={`0 0 ${largeur} ${epaisseur}`} role="img" aria-hidden>
      <rect x="0" y="0" width={largeur} height={epaisseur} rx={epaisseur / 2} fill={couleur} />
    </svg>
  );
}
