/**
 * Renvoi vers le relais des médias (src/services/relais-medias.ts), qui porte tout le code. Conservé pour que publications.ts
 * et l'ancienne adresse /api/media-buffer/<jeton>/video.mp4 restent intacts, avec les mêmes noms de fonctions.
 * L'ancienne adresse ne sert que la vidéo : tout autre nom y donne 404.
 *
 * ENCORE VIVANT (fiche L7-31) : l'adresse est encore émise par `urlVideoPourBuffer` (publications.ts) pour l'envoi actuel,
 * Zernio compris, et des jetons déjà donnés au diffuseur valent jusqu'à 30 jours. Ne rien supprimer ici ni dans la route
 * /api/media-buffer, le jeton (src/lib/jeton-media-buffer.ts) ou la liste blanche de src/proxy.ts. Le test
 * tests/l7-31-relais-media-vivant.test.ts garde ces points. La suppression (fiche L7-31b) attend les trois conditions :
 *  (a) `urlVideoPourBuffer` donne /api/medias-publics/... (fiche à part, accord de la session Zernio et essai réel) ;
 *  (b) 30 jours depuis le dernier jeton /api/media-buffer émis ;
 *  (c) la reprise des posts BF-01 est tranchée.
 */
import "server-only";
import { NOM_VIDEO_RELAIS, servirRelaisMedias } from "./relais-medias";

export { NOM_VIDEO_RELAIS, LIMITE_REQUETES_PAR_MINUTE, LIMITE_GET_ENTIERS_PAR_MINUTE, LIMITE_FLUX_SIMULTANES, adressePubliqueStudio, adresseRelaisBuffer, reinitialiserLimitePourEssai } from "./relais-medias";

export function servirRelaisBuffer(methode: "GET" | "HEAD", jeton: string, nom: string, range: string | null, signalClient?: AbortSignal, maintenantMs: number = Date.now()): Promise<Response> {
  return servirRelaisMedias(methode, jeton, nom === NOM_VIDEO_RELAIS ? nom : "", range, signalClient, maintenantMs);
}
