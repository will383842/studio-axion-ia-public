import React from "react";
/**
 * Trait de fin (queue de la vidéo, après la dernière parole) : dans la bande des sous-titres, libre, un trait orange se
 * dessine de gauche à droite d'un mouvement régulier sur son rail pâle, puis reste posé (`planQueueFin`, PUR). Le reste
 * de l'image ne bouge pas. Posé au premier plan, hors caméra, par le bloc qui finit la vidéo (`queue` de ses propriétés).
 */
import { COULEURS_DUO } from "../../../src/briques/habillage/charte-duo";
import { planQueueFin, type QueueFinIV } from "../../../src/briques/schema-motion/queue-fin";
import { teinte } from "../cas-concret/plans/commun";

export function QueueFin({ queue, t, largeur, hauteur }: { queue?: QueueFinIV | null; t: number; largeur: number; hauteur: number }) {
  if (!queue) return null;
  // Pixels de l'écran de référence (largeur 1080), mis à l'échelle du cadre.
  const echelle = largeur / 1080;
  const q = planQueueFin(queue, t, { largeur: 1080, hauteur: hauteur / echelle });
  if (!q) return null;
  const rayon = q.hauteur / 2;
  return (
    <div data-queue-fin="" style={{ position: "absolute", left: 0, top: 0, width: 1080, height: hauteur / echelle, transform: `scale(${echelle})`, transformOrigin: "0 0", pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: q.x, top: q.y, width: q.largeur, height: q.hauteur, borderRadius: rayon, background: teinte(COULEURS_DUO.gris, 0.3), opacity: q.rail }} />
      {q.trait > 0 ? <div style={{ position: "absolute", left: q.x, top: q.y, width: q.trait, height: q.hauteur, borderRadius: rayon, background: COULEURS_DUO.orangeVif }} /> : null}
    </div>
  );
}
