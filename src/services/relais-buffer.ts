/**
 * Renvoi vers le relais des médias (src/services/relais-medias.ts), qui porte tout le code. Conservé pour que publications.ts
 * et l'ancienne adresse /api/media-buffer/<jeton>/video.mp4 restent intacts, avec les mêmes noms de fonctions.
 * L'ancienne adresse ne sert que la vidéo : tout autre nom y donne 404.
 */
import "server-only";
import { NOM_VIDEO_RELAIS, servirRelaisMedias } from "./relais-medias";

export { NOM_VIDEO_RELAIS, LIMITE_REQUETES_PAR_MINUTE, LIMITE_GET_ENTIERS_PAR_MINUTE, LIMITE_FLUX_SIMULTANES, adressePubliqueStudio, adresseRelaisBuffer, reinitialiserLimitePourEssai } from "./relais-medias";

export function servirRelaisBuffer(methode: "GET" | "HEAD", jeton: string, nom: string, range: string | null, signalClient?: AbortSignal, maintenantMs: number = Date.now()): Promise<Response> {
  return servirRelaisMedias(methode, jeton, nom === NOM_VIDEO_RELAIS ? nom : "", range, signalClient, maintenantMs);
}
