import type { MesureVoix } from "@/briques/voix-maitre/reference";

/**
 * Référence de la voix d'Image → vidéo SEULEMENT. 20/10/2026 (« oui, 158 Hz ») : la v4 ENTIÈRE (158,4 Hz). 23/10/2026
 * (décision de Will : « cette voix me convient ») : l'ancienne voix n'existe plus chez HeyGen, la référence est recalibrée
 * sur la NOUVELLE voix (DJI_44_20261021_204103) : prise 2 retenue de v-6e4a06b9c718, mesure « video-finie » v3, arrondie.
 * Les tolérances (`TOLERANCES_VOIX`) ne changent pas. Avocat, tableau et cas concret gardent `REFERENCE_V4`. PUR, importable par un écran.
 */
export const REFERENCE_V4_IV: Readonly<MesureVoix> = Object.freeze({
  hauteurHz: 188.2,
  variationHz: 42.3,
  energie: 0.133,
  dynamique: 0.525,
  rythmePicsParSec: 5.03,
  partieParole: 0.7,
});
