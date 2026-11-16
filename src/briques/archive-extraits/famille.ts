/**
 * Archive des vidéos livrées (C3-UT-3.4) : famille d'une vidéo (elle, sa mère, ses filles, ses sœurs, même script).
 * Pur. Nommée `familleDeVideo` : `familleDe` existe déjà dans `src/domaine/journal-echecs`.
 */
import type { Id, Video } from "@/domaine/types";

function mereDe(v: Video): Id | undefined {
  return v.sourceVideoId ?? (v.entrees?.declinaison as { mereVideoId?: Id } | undefined)?.mereVideoId ?? undefined;
}

export function familleDeVideo(video: Video, toutes: Video[]): string[] {
  const mere = mereDe(video);
  const ids = new Set<string>([video.id]);
  if (mere) ids.add(mere);
  for (const v of toutes) {
    if (v.id === video.id) continue;
    const mereV = mereDe(v);
    const fille = mereV === video.id;
    const soeur = (!!mere && mereV === mere) || (!!video.varianteId && v.varianteId === video.varianteId);
    const memeScript = !!video.scriptId && v.scriptId === video.scriptId;
    if (fille || soeur || memeScript) ids.add(v.id);
  }
  return [...ids].sort();
}
