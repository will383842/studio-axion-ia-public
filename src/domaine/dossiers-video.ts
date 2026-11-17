/**
 * G13-12 (W-N, 16/11) : les scènes en cache de la vidéo partent avec elle.
 * Dossiers du stockage propres à UNE vidéo, effacés avec elle (suppression définitive). PUR.
 * La GARDE est volontairement étroite : un seul identifiant, la barre finale (l'id voisin `v-012` n'est pas `v-01/`),
 * jamais un préfixe vide, ni la racine d'un environnement. Hors de cette forme, rien n'est listé ni effacé.
 * Décision de Williams (17/11) : « rien d'automatique, la corbeille ne touche à rien ». Les scènes ne sont donc visées QUE
 * si l'appelant allume `{ scenes: true }` (seul `true` exact, éteint par défaut = comportement de master : 5 dossiers). Le nettoyage
 * automatique de la corbeille au bout de 30 jours (sans session) n'allume jamais ce réglage ; seul le chemin de suppression définitive avec session le pourra.
 */
export const DOSSIERS_PROPRES_VIDEO = ["audio-maitre", "videos", "facecam-animee", "image-video", "fiches-scenes", "scenes"] as const;

/** Réglage éteint par défaut : seul `true` strict ajoute les scènes (toute autre valeur : comme master). */
export type OptionsDossiers = { scenes?: unknown };

/** Les dossiers visés : les 5 d'avant, plus `scenes` seulement si `options.scenes === true`. */
export function dossiersVises(options?: OptionsDossiers): readonly string[] {
  return options?.scenes === true ? DOSSIERS_PROPRES_VIDEO : DOSSIERS_PROPRES_VIDEO.filter((d) => d !== "scenes");
}

const GARDE = /^studio\/(prod|dev)\/(audio-maitre|videos|facecam-animee|image-video|fiches-scenes|scenes)\/[A-Za-z0-9_-]+\/$/;

export function dossierPropreValide(prefixe: string): boolean {
  return GARDE.test(prefixe);
}

/** Les dossiers d'une vidéo pour un environnement (5, ou 6 avec `{ scenes: true }`) ; lève si l'id sort de la convention (alors rien n'est effacé). */
export function prefixesDeVideo(env: "prod" | "dev", videoId: string, options?: OptionsDossiers): string[] {
  const prefixes = dossiersVises(options).map((d) => `studio/${env}/${d}/${videoId}/`);
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
export function cleDeCetteVideo(cle: string, videoId: string, options?: OptionsDossiers): boolean {
  if (cleProtegee(cle) || cle.includes("..") || cle.includes("//")) return false;
  const m = /^studio\/(prod|dev)\/([^/]+)\/([^/]+)\/./.exec(cle);
  return !!m && dossiersVises(options).includes(m[2]) && m[3] === videoId && dossierPropreValide(`studio/${m[1]}/${m[2]}/${m[3]}/`);
}
