import type { Id, SourcePublication } from "./types";

/**
 * Source d'une sortie : exactement un identifiant de vidéo OU de visuel.
 * Fonction pure : lève si les deux sont donnés, ou si aucun ne l'est.
 */
export function sourceDeSortie(s: { videoId?: Id; visuelId?: Id }): SourcePublication {
  if (s.videoId && !s.visuelId) return { famille: "video", videoId: s.videoId };
  if (s.visuelId && !s.videoId) return { famille: "visuel", visuelId: s.visuelId };
  throw new Error("Sortie sans source unique : il faut exactement un identifiant de vidéo ou de visuel.");
}
