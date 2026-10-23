/** Harmonisation H3 : adaptateur pur des récents de la face caméra animée vers `RecentsGenerateur`. */
import type { RecentGenerateur } from "@/components/creation/RecentsGenerateur";
import { phrasePaye } from "./cout";

const ETAPES: Record<string, string> = { transcription: "vos mots", coupes: "les coupes", "mise-en-scene": "la mise en scène", videos: "les vidéos d'illustration", rendu: "le montage", prete: "prête" };

export interface DerniereFacecamAnimee {
  videoId: string;
  titre: string;
  statut: string;
  etape?: string;
  phrase?: string;
  payeCentimesEur: number;
}

export function versRecentsFacecamAnimee(videos: DerniereFacecamAnimee[]): RecentGenerateur[] {
  return videos.map((v) => ({
    id: v.videoId,
    href: `/videos/${encodeURIComponent(v.videoId)}`,
    titre: v.titre,
    etat: v.phrase ?? (v.etape ? ETAPES[v.etape] : v.statut),
    detail: phrasePaye(v.payeCentimesEur),
    icone: "video",
  }));
}
