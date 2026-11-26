/**
 * S-13-g-v21q — réglage de l'image vers vidéo « prête, avec remarques » (ÉTEINT : seul `true` exact allume, geste de
 * Williams dans les réglages). Allumé, le moteur passe l'option `preteAvecRemarques` de S-13-f à la fabrication : même
 * dépense (porte payée une fois), seul change le sort d'une vidéo dont les défauts tardifs sont tous reclassables.
 * Lu à la DEMANDE par `moteurs/montage-image-video/index.ts` (`avancer`) ; une lecture en échec vaut « éteint ».
 */
import { lireParametre } from "./_commun";

export const PARAM_PRETE_AVEC_REMARQUES_IV = "imageVideo.preteAvecRemarques";

export async function preteAvecRemarquesIVActive(): Promise<boolean> {
  return (await lireParametre<unknown>(PARAM_PRETE_AVEC_REMARQUES_IV, false).catch(() => false)) === true;
}
