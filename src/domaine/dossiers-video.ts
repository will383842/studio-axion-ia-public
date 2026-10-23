/**
 * Dossiers du stockage propres à UNE vidéo, effacés avec elle (suppression définitive). PUR.
 * La GARDE est volontairement étroite : un seul identifiant, la barre finale (l'id voisin `v-012` n'est pas `v-01/`),
 * jamais un préfixe vide, ni la racine d'un environnement. Hors de cette forme, rien n'est listé ni effacé.
 */
export const DOSSIERS_PROPRES_VIDEO = ["audio-maitre", "videos", "facecam-animee", "image-video", "fiches-scenes"] as const;

const GARDE = /^studio\/(prod|dev)\/(audio-maitre|videos|facecam-animee|image-video|fiches-scenes)\/[A-Za-z0-9_-]+\/$/;

export function dossierPropreValide(prefixe: string): boolean {
  return GARDE.test(prefixe);
}

/** Les cinq dossiers d'une vidéo pour un environnement ; lève si l'id sort de la convention (alors rien n'est effacé). */
export function prefixesDeVideo(env: "prod" | "dev", videoId: string): string[] {
  const prefixes = DOSSIERS_PROPRES_VIDEO.map((d) => `studio/${env}/${d}/${videoId}/`);
  for (const p of prefixes) if (!dossierPropreValide(p)) throw new Error(`Identifiant de vidéo hors convention : ${JSON.stringify(videoId)}`);
  return prefixes;
}

/**
 * Clés jamais effacées par une suppression de vidéo, quoi qu'un document en dise : illustrations (même clé pour toutes les
 * vidéos qui prennent le même clip), bibliothèque, décors, public, site.
 */
const CLE_PROTEGEE = /^studio\/(prod|dev)\/(illustrations|elements|decors|public|site)\//;

export function cleProtegee(cle: string): boolean {
  return CLE_PROTEGEE.test(cle);
}

/** Liste blanche des clés lues dans un texte : seulement SOUS un dossier propre de CETTE vidéo (jamais celui d'une autre). */
export function cleDeCetteVideo(cle: string, videoId: string): boolean {
  if (cleProtegee(cle) || cle.includes("..") || cle.includes("//")) return false;
  const m = /^studio\/(prod|dev)\/([^/]+)\/([^/]+)\/./.exec(cle);
  return !!m && (DOSSIERS_PROPRES_VIDEO as readonly string[]).includes(m[2]) && m[3] === videoId && dossierPropreValide(`studio/${m[1]}/${m[2]}/${m[3]}/`);
}
