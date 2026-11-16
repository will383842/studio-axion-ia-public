/** Tremblement « à la main » à 8 images/s : valeur tenue sur chaque palier. Pur. */
import { aleaGraine } from "./graine";

export const TREMBLEMENT = { ips: 8, pxMax: 1.5, degresMax: 0.6 } as const;

export interface DecalageTremblement {
  dx: number;
  dy: number;
  angle: number;
}

/** Somme de 2 sinus (fréquences et phases tirées de la graine) ; chaque sinus pèse la moitié de l'amplitude maximale. */
function bruit(graine: number, canal: number, palier: number): number {
  const f1 = 0.7 + aleaGraine(graine, canal * 4) * 1.3;
  const f2 = 1.7 + aleaGraine(graine, canal * 4 + 1) * 2.3;
  const p1 = aleaGraine(graine, canal * 4 + 2) * 2 * Math.PI;
  const p2 = aleaGraine(graine, canal * 4 + 3) * 2 * Math.PI;
  return (Math.sin(palier * f1 + p1) + Math.sin(palier * f2 + p2)) / 2;
}

export function tremblement(graine: number, image: number, fps: number): DecalageTremblement {
  const palier = Math.floor((image * TREMBLEMENT.ips) / fps);
  return {
    dx: bruit(graine, 0, palier) * TREMBLEMENT.pxMax,
    dy: bruit(graine, 1, palier) * TREMBLEMENT.pxMax,
    angle: bruit(graine, 2, palier) * TREMBLEMENT.degresMax,
  };
}
