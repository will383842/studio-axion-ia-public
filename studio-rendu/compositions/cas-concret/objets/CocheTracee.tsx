/** L7 · coche qui se dessine (trait court puis long) dans le rond qui la porte ; `trace` de 0 à 1. */
import { POINTS_COCHE } from "../plans/anim-objets";

export function CocheTracee({ trace, couleur, epaisseur, diametre }: { trace: number; couleur: string; epaisseur: number; diametre: number }) {
  return (
    <svg viewBox="0 0 100 100" style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", overflow: "visible" }}>
      <polyline points={POINTS_COCHE} fill="none" stroke={couleur} strokeWidth={(epaisseur / Math.max(1, diametre)) * 100} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - trace} />
    </svg>
  );
}
