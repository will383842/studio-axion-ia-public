/**
 * Écrans v4 du format (brique `ecrans-motion` du cas concret, LECTURE SEULE) : ce qu'un écran sait montrer. PUR.
 *
 * Seule source de la règle, lue par la mise en scène (L11, qui découpe un écran trop chargé AVANT de le poser) et par
 * le rendu (`ecransIrrendables`, dernier filet avant l'envoi : `IV_RENDU`).
 */
import { controlerProprietes, type EcranCale } from "@/briques/ecrans-motion";
import { proprietesPleineImage } from "./emprunts";

/** Lignes qu'un écran v4 sait montrer, par type (brique `ecrans-motion`, `geometrie.ts`). */
export const LIGNES_MAX_ECRAN_IV: Readonly<Record<string, number>> = Object.freeze({ titre: 2, question: 2, accroche: 3 });

/** Défauts d'un écran v4 : trop de lignes pour son type, puis le contrôle de la brique (textes qui ne tiennent pas). */
export function defautsEcranV4IV(ecran: EcranCale): { lignes: number; max?: number; defauts: string[] } {
  const p = proprietesPleineImage({ ecrans: [ecran], captures: {} })[0];
  const lignes = "lignes" in p && Array.isArray(p.lignes) ? p.lignes.length : 0;
  const max = LIGNES_MAX_ECRAN_IV[p.type];
  const defauts = controlerProprietes(p);
  if (max !== undefined && lignes > max) defauts.unshift(`${p.type} de ${lignes} ligne(s), ${max} au plus`);
  return { lignes, ...(max !== undefined ? { max } : {}), defauts };
}

/** Vrai si l'écran se rend tel quel. */
export const ecranV4Tient = (ecran: EcranCale): boolean => defautsEcranV4IV(ecran).defauts.length === 0;
