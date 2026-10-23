/**
 * MINI-VIDÉOS — RECHERCHE DIRECTE dans les banques GRATUITES Pexels et Pixabay (passe 3, revue passe 2 point 2).
 *
 * Le fournisseur d'illustrations du studio ne lit qu'une page de vidéos VERTICALES : trop peu pour trouver une action
 * littérale qui bouge. Ici, pour une requête et un numéro de page :
 *  - Pexels : vidéos verticales PUIS toutes orientations (une vidéo paysage 1920×1080 recadrée 4:5 garde 864 px et montre
 *    souvent mieux l'action), 15 par appel ;
 *  - Pixabay : 30 par appel ;
 *  - la version retenue d'une vidéo est la plus PETITE dont le cadre 4:5 garde au moins 720 px (téléchargement léger).
 * Licences : Pexels License et Pixabay Content License (gratuites, usage commercial, sans attribution obligatoire) ;
 * la page et l'auteur sont gardés pour le rapport. La clé est injectée et ne sort jamais d'ici (ni journal, ni rapport) :
 * une erreur ne porte que le code de réponse.
 */
import { COTE_COURT_MIN_VIDEO, formatMiniVideo, type CandidatImage } from "./choisir";

export const PAR_PAGE_PEXELS = 15;
export const PAR_PAGE_PIXABAY = 30;
/** Pages lues par requête (revue passe 2 : « 2 à 3 pages de résultats »). */
export const PAGES_PAR_REQUETE = 3;

export type Recuperer = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface ClesBanques {
  pexels?: string;
  pixabay?: string;
}

const coteUtile = (w: number, h: number) => formatMiniVideo({ largeur: w, hauteur: h })?.coteCourt ?? 0;

/** La version la plus PETITE dont le cadre 4:5 garde au moins 720 px de large (sinon la plus grande disponible). */
export function plusPetiteSuffisante<T extends { url?: string; largeur: number; hauteur: number }>(fichiers: T[]): T | undefined {
  const ok = fichiers.filter((f) => f.url && f.largeur > 0 && f.hauteur > 0);
  const assez = ok.filter((f) => coteUtile(f.largeur, f.hauteur) >= COTE_COURT_MIN_VIDEO).sort((a, b) => a.largeur * a.hauteur - b.largeur * b.hauteur);
  return assez[0] ?? [...ok].sort((a, b) => b.largeur * b.hauteur - a.largeur * a.hauteur)[0];
}

/** Description lisible tirée de l'adresse Pexels (« …/video/man-fixing-a-sink-123/ » → « man fixing a sink »). */
export const descriptionPexels = (url?: string) => (/\/video\/([a-z0-9-]+?)-?\d*\/?$/i.exec(url ?? "")?.[1] ?? "").replace(/-/g, " ").trim();

async function lireJson(recuperer: Recuperer, url: string, init?: { headers?: Record<string, string> }): Promise<unknown> {
  const r = await recuperer(url, init);
  if (!r.ok) throw new Error(`banque : réponse ${r.status}`);
  return r.json();
}

interface VideoPexels {
  id: number;
  url?: string;
  image?: string;
  duration?: number;
  user?: { name?: string };
  video_files?: { link?: string; width?: number; height?: number; file_type?: string }[];
}

/** Une page de vidéos Pexels (verticales puis toutes orientations), sans doublon. */
export async function videosPexels(cle: string | undefined, requete: string, page: number, recuperer: Recuperer): Promise<CandidatImage[]> {
  if (!cle || !requete.trim()) return [];
  const sortie: CandidatImage[] = [];
  for (const orientation of ["portrait", ""]) {
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(requete)}&per_page=${PAR_PAGE_PEXELS}&page=${page}&size=medium${orientation ? `&orientation=${orientation}` : ""}`;
    const j = (await lireJson(recuperer, url, { headers: { Authorization: cle } })) as { videos?: VideoPexels[] };
    for (const v of j.videos ?? []) {
      const f = plusPetiteSuffisante((v.video_files ?? []).filter((x) => (x.file_type ?? "video/mp4") === "video/mp4").map((x) => ({ url: x.link, largeur: x.width ?? 0, hauteur: x.height ?? 0 })));
      if (!f?.url || sortie.some((s) => s.id === String(v.id))) continue;
      sortie.push({ source: "pexels", id: String(v.id), genre: "video", cle: f.url, vignette: v.image, largeur: f.largeur, hauteur: f.hauteur, dureeSec: v.duration, description: descriptionPexels(v.url), licence: { usageCommercial: true, nom: "Pexels License" }, page: v.url, auteur: v.user?.name });
    }
  }
  return sortie;
}

interface VideoPixabay {
  id: number;
  pageURL?: string;
  tags?: string;
  duration?: number;
  user?: string;
  videos?: Record<string, { url?: string; width?: number; height?: number; thumbnail?: string }>;
}

/** Une page de vidéos Pixabay. */
export async function videosPixabay(cle: string | undefined, requete: string, page: number, recuperer: Recuperer): Promise<CandidatImage[]> {
  if (!cle || !requete.trim()) return [];
  const url = `https://pixabay.com/api/videos/?key=${encodeURIComponent(cle)}&q=${encodeURIComponent(requete.slice(0, 100))}&per_page=${PAR_PAGE_PIXABAY}&page=${page}&safesearch=true`;
  let j: { hits?: VideoPixabay[] };
  try {
    j = (await lireJson(recuperer, url)) as { hits?: VideoPixabay[] };
  } catch (e) {
    // Pixabay répond 400 au-delà de la dernière page : ce n'est pas une panne.
    if (page > 1 && /400/.test((e as Error).message)) return [];
    throw e;
  }
  return (j.hits ?? []).flatMap((h): CandidatImage[] => {
    const f = plusPetiteSuffisante(Object.values(h.videos ?? {}).map((t) => ({ url: t?.url, largeur: t?.width ?? 0, hauteur: t?.height ?? 0 })));
    if (!f?.url) return [];
    return [{ source: "pixabay", id: String(h.id), genre: "video", cle: f.url, vignette: h.videos?.medium?.thumbnail ?? h.videos?.small?.thumbnail, largeur: f.largeur, hauteur: f.hauteur, dureeSec: h.duration, description: (h.tags ?? "").replace(/\s*,\s*/g, " "), licence: { usageCommercial: true, nom: "Pixabay Content License" }, page: h.pageURL, auteur: h.user }];
  });
}

/** La recherche de vidéos des deux banques, prête pour `OptionsAdaptateur.chercherVideos`. */
export function chercheurVideosBanques(cles: ClesBanques, recuperer: Recuperer) {
  return async (source: "pexels" | "pixabay", requete: string, page: number): Promise<CandidatImage[]> =>
    source === "pexels" ? videosPexels(cles.pexels, requete, page, recuperer) : videosPixabay(cles.pixabay, requete, page, recuperer);
}
