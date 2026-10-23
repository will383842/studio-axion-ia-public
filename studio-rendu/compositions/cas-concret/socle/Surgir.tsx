/** Enveloppe d'une pastille ou d'une coche qui surgit avec un rebond. */
import type { ReactNode } from "react";
import { planSurgir } from "../plans/commun";

export function Surgir({ x, rotation = 0, children }: { x: number; rotation?: number; children: ReactNode }) {
  const s = planSurgir(x, rotation);
  return <div style={{ opacity: s.opacite, transform: `scale(${s.echelle}) rotate(${s.rotation}deg)` }}>{children}</div>;
}
