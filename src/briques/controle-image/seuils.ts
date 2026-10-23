/** Seuils par défaut du contrôle de l'image finale (plan 02 § 12) et outils de libellé. PUR. */
import type { SeuilsControleImage } from "./types";

export const SEUILS_CONTROLE_IMAGE: Readonly<SeuilsControleImage> = Object.freeze({
  volumeCible: -14,
  volumeTolerance: 1,
  creteMax: -1.5,
  dureeMaxSec: 90,
  tailleTexteMin: 0.03,
  contrasteTexteMin: 7,
  contrasteMarqueMin: 3,
  accrocheMotsMax: 8,
  // Valeur prudente, égale à la bande de la charte vidéo (3 lignes de légende à 3 % + interlignage).
  bandeSousTitres: 0.14,
});

/** Nombre écrit à la française : virgule décimale, vrai signe moins. */
export function nombre(n: number, decimales = 1): string {
  const t = n.toFixed(decimales).replace(".", ",");
  return n < 0 ? `−${t.slice(1)}` : t;
}

/** Pourcentage écrit à la française (0,03 → « 3 % »). */
export function pourcent(fraction: number): string {
  const p = Math.round(fraction * 1000) / 10;
  return `${String(p).replace(".", ",")} %`;
}
