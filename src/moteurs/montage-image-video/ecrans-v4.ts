/**
 * Écrans v4 du format (brique `ecrans-motion` du cas concret, LECTURE SEULE) : ce qu'un écran sait montrer. PUR.
 *
 * Seule source de la règle, lue par la mise en scène (L11, qui découpe un écran trop chargé AVANT de le poser) et par
 * le rendu (`ecransIrrendables`, dernier filet avant l'envoi : `IV_RENDU`).
 */
import { controlerProprietes, proprietesEcrans, type EcranCale, type ProprietesEcran } from "@/briques/ecrans-motion";
import { ECRAN_IV, MISE_EN_PAGE_IV } from "@/briques/schema-motion/types";
import { dessinAuDessusDesSousTitres, proprietesPleineImage } from "./emprunts";

/**
 * Zone d'un écran v4 en 9:16 (% de 1080 × 1920) : marque à y 143, côtés 40 px, bas = bas de la zone utile (y 1114), AU-DESSUS de la
 * bande des sous-titres (y 1152 → 1286). 23/10/2026, v-6e4a06b9c718 à 18,6 s : la zone « pleine image » du cas concret descendait à
 * y 1590 et l'unité « % » (y 1090 → 1330) recouvrait le sous-titre (même défaut pour tout écran chiffre, question ou accroche).
 */
const H916 = MISE_EN_PAGE_IV["9:16"].hauteur;
export const ZONE_ECRAN_IV_9X16 = Object.freeze({ haut: (143 / H916) * 100, droite: (40 / 1080) * 100, bas: (1 - MISE_EN_PAGE_IV["9:16"].zoneUtile.bas) * 100, gauche: (40 / 1080) * 100 });

/** Propriétés d'un écran v4 en 9:16 (PUR) : seule source, lue par le contrôle L11 et par le rendu. Le fil des étapes reste celui du cas concret. */
export function proprietesEcranIV916(ecran: EcranCale): ProprietesEcran {
  const fil = proprietesPleineImage({ ecrans: [ecran], captures: {} })[0].basFil;
  const brutes = proprietesEcrans({ ecrans: [ecran], captures: {}, zoneProtegee: { ...ZONE_ECRAN_IV_9X16 }, bandeSousTitres: 0, largeur: ECRAN_IV.largeur, hauteur: H916 });
  return dessinAuDessusDesSousTitres(brutes).map((e) => ({ ...e, basFil: fil }))[0];
}

/** Lignes qu'un écran v4 sait montrer, par type (brique `ecrans-motion`, `geometrie.ts`). */
export const LIGNES_MAX_ECRAN_IV: Readonly<Record<string, number>> = Object.freeze({ titre: 2, question: 2, accroche: 3 });

/** Défauts d'un écran v4 : trop de lignes pour son type, puis le contrôle de la brique (textes qui ne tiennent pas). */
export function defautsEcranV4IV(ecran: EcranCale): { lignes: number; max?: number; defauts: string[] } {
  const p = proprietesEcranIV916(ecran);
  const lignes = "lignes" in p && Array.isArray(p.lignes) ? p.lignes.length : 0;
  const max = LIGNES_MAX_ECRAN_IV[p.type];
  const defauts = controlerProprietes(p);
  if (max !== undefined && lignes > max) defauts.unshift(`${p.type} de ${lignes} ligne(s), ${max} au plus`);
  return { lignes, ...(max !== undefined ? { max } : {}), defauts };
}

/** Vrai si l'écran se rend tel quel. */
export const ecranV4Tient = (ecran: EcranCale): boolean => defautsEcranV4IV(ecran).defauts.length === 0;
