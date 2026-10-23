/**
 * PIXABAY — vidéos gratuites (licence Pixabay : usage commercial permis, sans attribution ; pas de revente en
 * l'état). Lot A2 (M5). Point d'accès : `GET https://pixabay.com/api/videos/?key=…&q=…` (la clé est dans l'adresse :
 * elle n'est jamais écrite dans un journal). Pixabay n'a pas de filtre « portrait » pour les vidéos : le tri
 * vertical est fait ici, sur chaque taille proposée (100 résultats lus : les verticales y sont rares, ≈ 1 à 6 %).
 */
import type { Licence } from "@/domaine/types";
import { ErreurIllustration } from "./depot";
import type { CandidatBanque } from "./pexels";

export const LICENCE_PIXABAY: Licence = { type: "libre", usageCommercial: true, reseaux: [], source: "Pixabay" };

interface TaillePixabay {
  url?: string;
  width?: number;
  height?: number;
  thumbnail?: string;
}
interface VideoPixabay {
  id: number;
  pageURL: string;
  tags?: string;
  duration: number;
  user?: string;
  videos?: Partial<Record<"large" | "medium" | "small" | "tiny", TaillePixabay>>;
}

/** Lecture PURE d'une réponse Pixabay : seules les vidéos verticales sont gardées (la taille la plus proche de 1080). */
export function lireReponsePixabay(json: unknown): CandidatBanque[] {
  const hits = ((json as { hits?: VideoPixabay[] })?.hits ?? []) as VideoPixabay[];
  const sortie: CandidatBanque[] = [];
  for (const h of hits) {
    const tailles = Object.values(h.videos ?? {}).filter((t): t is TaillePixabay => !!t?.url && (t.height ?? 0) > (t.width ?? 0));
    const t = tailles.sort((a, b) => Math.abs((a.width ?? 0) - 1080) - Math.abs((b.width ?? 0) - 1080))[0];
    if (!t?.url) continue;
    const vignette = h.videos?.medium?.thumbnail ?? h.videos?.small?.thumbnail ?? t.thumbnail ?? "";
    sortie.push({
      idExterne: String(h.id),
      source: "pixabay",
      urlVideo: t.url,
      urlVignette: vignette,
      dureeSec: h.duration,
      largeur: t.width ?? 0,
      hauteur: t.height ?? 0,
      licence: { ...LICENCE_PIXABAY },
      description: (h.tags ?? "").replace(/\s*,\s*/g, ", "),
      page: h.pageURL,
      auteur: h.user,
    });
  }
  return sortie;
}

export async function chercherPixabay(cle: string, requete: string, parPage = 100): Promise<CandidatBanque[]> {
  const url = `https://pixabay.com/api/videos/?key=${encodeURIComponent(cle)}&q=${encodeURIComponent(requete.slice(0, 100))}&per_page=${Math.max(3, parPage)}&safesearch=true&video_type=film`;
  let r: Response;
  try {
    r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new ErreurIllustration({ code: "indisponible", reessayable: true, message: "Pixabay ne répond pas." });
  }
  if (r.status === 429) throw new ErreurIllustration({ code: "quota", reessayable: true, message: "Pixabay : trop de recherches pour l'heure." });
  if (!r.ok) console.warn(`[illustrations] Pixabay : réponse ${r.status}`);
  if (r.status === 400 || r.status === 401 || r.status === 403) throw new ErreurIllustration({ code: "refuse", reessayable: false, message: "Pixabay refuse la demande." });
  if (!r.ok) throw new ErreurIllustration({ code: "indisponible", reessayable: true, message: "Pixabay ne répond pas correctement pour l'instant." });
  return lireReponsePixabay(await r.json());
}
