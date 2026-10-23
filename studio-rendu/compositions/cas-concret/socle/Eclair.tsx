/** Éclair orange d'un moment clé (événement `eclair` de l'écran). */
import { AbsoluteFill } from "remotion";
import { planEclair } from "../plans/commun";

export function Eclair({ t, debut }: { t: number; debut: number | null }) {
  const e = planEclair(t, debut);
  if (e.opacite <= 0) return null;
  return <AbsoluteFill style={{ background: e.couleur, opacity: e.opacite, pointerEvents: "none" }} />;
}
