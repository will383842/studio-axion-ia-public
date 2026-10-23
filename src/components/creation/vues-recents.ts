/** Harmonisation H8c : adaptateur pur des vidéos récentes d'un format vers `RecentsGenerateur`. */
import { STATUTS_VIDEO } from "@/domaine/libelles";
import type { VueVideoCarte } from "@/services/vues";
import type { RecentGenerateur } from "./RecentsGenerateur";

export function versRecentsVideos(videos: Pick<VueVideoCarte, "id" | "titre" | "statut" | "modifieLe">[]): RecentGenerateur[] {
  return videos.map((v) => ({
    id: v.id,
    href: `/videos/${encodeURIComponent(v.id)}`,
    titre: v.titre.trim() || "Sans titre",
    etat: STATUTS_VIDEO[v.statut].libelle,
    // Dernière modification : c'est l'ordre de `listerVideos` (tri « recentes »).
    date: v.modifieLe,
    icone: "video",
  }));
}
