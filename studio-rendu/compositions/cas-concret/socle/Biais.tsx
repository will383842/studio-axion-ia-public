/** Enveloppe d'un objet : entrée (« entrer ») puis biais 3D lent (« biais »). */
import type { ReactNode } from "react";
import type { BoitePx } from "../../../../src/briques/ecrans-motion";
import { planBiais, planEntreeObjet } from "../plans/commun";

export function Biais({ boite, entree, tVideo, rotY, rotX, children }: { boite: BoitePx; entree: number; tVideo: number; rotY?: number; rotX?: number; children: ReactNode }) {
  const e = planEntreeObjet(entree);
  const b = planBiais(tVideo, rotY, rotX);
  return (
    <div style={{ position: "absolute", left: boite.x, top: boite.y, width: boite.largeur, height: boite.hauteur, opacity: e.opacite, transform: `translateY(${e.decalageY}px) scale(${e.echelle}) perspective(${b.perspective}px) rotateY(${b.rotY}deg) rotateX(${b.rotX}deg)` }}>
      {children}
    </div>
  );
}
