/**
 * Réglage « Vidéo longue » (videoLongue.actif) : éteint par défaut, seul le booléen exact `true` allume.
 * Clé importée de video-longue-branchements (jamais recopiée). Serveur seulement, aucun appel payant.
 * Le lecteur du branchement (`actif` des ports) lit la même clé avec la même règle : un `"true"` ou un `1` reste éteint.
 */
import "server-only";
import { ecrireParametre, lireParametre } from "./_commun";
import { PARAM_VIDEO_LONGUE_ACTIF } from "./video-longue-branchements";

export async function lireVideoLongueActif(): Promise<boolean> {
  try {
    return (await lireParametre<unknown>(PARAM_VIDEO_LONGUE_ACTIF, false)) === true;
  } catch {
    return false;
  }
}

export async function ecrireVideoLongueActif(actif: boolean): Promise<void> {
  if (actif !== true && actif !== false) throw new TypeError("videoLongue.actif : un booléen est attendu.");
  await ecrireParametre(PARAM_VIDEO_LONGUE_ACTIF, actif);
}
