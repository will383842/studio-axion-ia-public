/**
 * CLÉ DE RANGEMENT de la fiche de scènes sur le stockage, selon la convention existante
 * `studio/{env}/{type}/{entiteId}/{fichierId}.{ext}` (`src/fournisseurs/r2/stockage.ts`, `cleDeDepot`).
 * Fonction pure ; refuse un identifiant qui sortirait de son dossier.
 */

export type EnvStockage = "prod" | "dev";

/** Type de rangement des fiches de scènes. */
export const TYPE_RANGEMENT_FICHE = "fiches-scenes";

const SEGMENT_SUR = /^[A-Za-z0-9_-]{1,120}$/;

/** `studio/<env>/fiches-scenes/<videoId>/<versionId>.json`. Lève une erreur si un identifiant n'est pas sûr. */
export function cleFicheScenes(env: EnvStockage, videoId: string, versionId: string): string {
  if (env !== "prod" && env !== "dev") throw new Error(`Clé de fiche de scènes : environnement « ${String(env)} » inconnu.`);
  for (const [nom, valeur] of [["vidéo", videoId], ["version", versionId]] as const) {
    if (!SEGMENT_SUR.test(valeur)) {
      throw new Error(`Clé de fiche de scènes : identifiant de ${nom} « ${valeur} » refusé (lettres, chiffres, tiret ou soulignement seulement).`);
    }
  }
  return `studio/${env}/${TYPE_RANGEMENT_FICHE}/${videoId}/${versionId}.json`;
}
