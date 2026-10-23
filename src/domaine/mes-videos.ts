/**
 * TEST-UI-REEL U9 (CORRECTEUR UI2) : compteurs des onglets de Mes vidéos, d'UNE seule règle. « Toutes » et l'onglet de
 * chaque format comptent toutes les vidéos non archivées, brouillons compris (avant : « Toutes 0 » et « Type avocat 0 »
 * avec deux brouillons type avocat). « Brouillons » en est une partie ; « Archivées » est à part. Chaque onglet montre
 * exactement ce qu'il compte.
 */
export interface CompteursMesVideos {
  toutes: number;
  brouillons: number;
  /** Archivées simples : les vidéos à la corbeille n'en font pas partie. */
  archivees: number;
  /** Vidéos à la corbeille (supprimées 30 jours après leur mise de côté, restaurables avant). */
  corbeille: number;
  /** Vidéos non archivées dont le format n'est plus dans le registre (onglet « Autres »). */
  autres: number;
  parFormat: Record<string, number>;
}

/** UNE règle pour la barre latérale, les onglets et la page d'un format : tout compte sauf l'archivée. */
export function compteDansFormat(v: { statut: string }): boolean {
  return v.statut !== "archivee";
}

/** Vidéos non archivées dont le format est absent du registre. */
export function videosAutres<V extends { statut: string; format: { id: string } }>(videos: V[], formatIds: string[]): V[] {
  const connus = new Set(formatIds);
  return videos.filter((v) => compteDansFormat(v) && !connus.has(v.format.id));
}

export function compteursMesVideos(videos: { statut: string; corbeilleLe?: string; format: { id: string } }[], formatIds: string[] = []): CompteursMesVideos {
  const parFormat: Record<string, number> = Object.fromEntries(formatIds.map((id) => [id, 0]));
  let toutes = 0;
  let brouillons = 0;
  let archivees = 0;
  let corbeille = 0;
  let autres = 0;
  const connus = new Set(formatIds);
  for (const v of videos) {
    if (!compteDansFormat(v)) {
      if (v.corbeilleLe) corbeille++;
      else archivees++;
      continue;
    }
    toutes++;
    if (!connus.has(v.format.id)) autres++;
    if (v.statut === "brouillon") brouillons++;
    parFormat[v.format.id] = (parFormat[v.format.id] ?? 0) + 1;
  }
  return { toutes, brouillons, archivees, corbeille, autres, parFormat };
}

/** Vidéos de l'onglet « Toutes » : toutes, sauf les archivées (brouillons compris, comme le compteur). */
export function videosDeToutes<V extends { statut: string }>(videos: V[]): V[] {
  return videos.filter(compteDansFormat);
}
