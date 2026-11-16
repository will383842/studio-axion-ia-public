/** PETITS OBJETS — phases d'un objet (tracé à l'entrée, tenue, sortie en 6 images). PUR : jamais d'exception, toujours dans [0, 1]. */
import { DUREES, FPS_MOTION } from "../jetons";
import { progres } from "../courbes";

export const IMAGES_SORTIE = 6;
export const IMAGES_ENTREE = Math.round(DUREES.entree * FPS_MOTION);

export interface PhaseObjet {
  /** Avancement du tracé, 0..1. */
  trace: number;
  /** Opacité, 0..1. */
  opacite: number;
}

const borne01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** `image` compte depuis le début de l'objet ; `dureeImages` est sa durée totale. 0 avant, tenue à 1, 0 à la dernière image. */
export function phaseObjet(image: number, dureeImages: number): PhaseObjet {
  if (!Number.isFinite(image) || !Number.isFinite(dureeImages) || image < 0 || image >= dureeImages) return { trace: 0, opacite: 0 };
  const trace = borne01(progres(image / FPS_MOTION, 0, DUREES.entree));
  const opacite = borne01((dureeImages - 1 - image) / IMAGES_SORTIE);
  return { trace, opacite };
}
