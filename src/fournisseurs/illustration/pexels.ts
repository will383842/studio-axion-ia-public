/**
 * PEXELS — vidéos gratuites (licence Pexels : usage commercial permis, attribution non obligatoire, pas de revente
 * en l'état, personnes reconnaissables jamais dans une situation défavorable). Lot A2 (M5).
 * Point d'accès : `GET https://api.pexels.com/videos/search?query=…&orientation=portrait` (en-tête `Authorization`).
 * Seuls les fichiers VERTICAUX sont gardés (jamais un 16:9 recadré) ; rien n'est recopié ici (voir `reel.ts`).
 */
import type { Licence } from "@/domaine/types";
import { ErreurIllustration } from "./depot";

export const LICENCE_PEXELS: Licence = { type: "libre", usageCommercial: true, reseaux: [], source: "Pexels", creditObligatoire: undefined };

/** Un résultat de banque avant recopie : les adresses sont celles de la banque. */
export interface CandidatBanque {
  idExterne: string;
  source: "pexels" | "pixabay";
  urlVideo: string;
  urlVignette: string;
  dureeSec: number;
  largeur: number;
  hauteur: number;
  licence: Licence;
  description: string;
  /** Page d'origine (preuve de la licence). */
  page: string;
  auteur?: string;
}

interface FichierPexels {
  quality?: string;
  file_type?: string;
  width?: number;
  height?: number;
  link?: string;
}
interface VideoPexels {
  id: number;
  width: number;
  height: number;
  duration: number;
  url: string;
  image: string;
  user?: { name?: string };
  video_files?: FichierPexels[];
}

/** Le meilleur fichier vertical d'une vidéo : MP4, le plus proche de 1080 de large sans le dépasser de beaucoup. */
export function meilleurFichierVertical(fichiers: FichierPexels[]): FichierPexels | undefined {
  return fichiers
    .filter((f) => f.link && (f.file_type ?? "video/mp4") === "video/mp4" && (f.height ?? 0) > (f.width ?? 0))
    .sort((a, b) => Math.abs((a.width ?? 0) - 1080) - Math.abs((b.width ?? 0) - 1080))[0];
}

/** Description lisible tirée de l'adresse de la page (« …/video/parking-ticket-on-a-car-123/ » → « parking ticket on a car »). */
export function descriptionDepuisPage(url: string): string {
  const m = /\/video\/([a-z0-9-]+?)-?\d*\/?$/i.exec(url);
  return m ? m[1].replace(/-/g, " ").trim() : "";
}

/** Lecture PURE d'une réponse Pexels (testée sur une réponse enregistrée). */
export function lireReponsePexels(json: unknown): CandidatBanque[] {
  const videos = ((json as { videos?: VideoPexels[] })?.videos ?? []) as VideoPexels[];
  const sortie: CandidatBanque[] = [];
  for (const v of videos) {
    const f = meilleurFichierVertical(v.video_files ?? []);
    if (!f?.link) continue;
    sortie.push({
      idExterne: String(v.id),
      source: "pexels",
      urlVideo: f.link,
      urlVignette: v.image,
      dureeSec: v.duration,
      largeur: f.width ?? v.width,
      hauteur: f.height ?? v.height,
      licence: { ...LICENCE_PEXELS, creditObligatoire: undefined },
      description: descriptionDepuisPage(v.url),
      page: v.url,
      auteur: v.user?.name,
    });
  }
  return sortie;
}

export async function chercherPexels(cle: string, requete: string, parPage = 12): Promise<CandidatBanque[]> {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(requete)}&orientation=portrait&size=medium&per_page=${parPage}`;
  let r: Response;
  try {
    r = await fetch(url, { headers: { Authorization: cle }, signal: AbortSignal.timeout(20_000) });
  } catch (e) {
    console.warn(`[illustrations] Pexels ne répond pas : ${(e as Error).message}`);
    throw new ErreurIllustration({ code: "indisponible", reessayable: true, message: "Pexels ne répond pas." });
  }
  if (r.status === 429) throw new ErreurIllustration({ code: "quota", reessayable: true, message: "Pexels : trop de recherches pour l'heure." });
  if (r.status === 401 || r.status === 403) throw new ErreurIllustration({ code: "refuse", reessayable: false, message: "Pexels refuse la clé." });
  if (!r.ok) {
    console.warn(`[illustrations] Pexels : réponse ${r.status}`);
    throw new ErreurIllustration({ code: "indisponible", reessayable: true, message: "Pexels ne répond pas correctement pour l'instant." });
  }
  return lireReponsePexels(await r.json());
}
