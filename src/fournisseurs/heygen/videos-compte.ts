/**
 * VIDÉOS DU COMPTE HEYGEN (lot R7, décision de Will du 03/10) : Will fait ses vidéos avec son double DANS
 * L'APPLICATION HEYGEN ; le studio les LIT (gratuit), puis en télécharge une pour la finition (sous-titres, son,
 * miniature, calage). Aucun appel payant ici : seulement des lectures.
 *
 * Documentation relue le 03/10/2026 (developers.heygen.com, lecture seule, aucun appel) :
 *  - `GET /v3/videos` (reference/list-videos) : « Returns a paginated list of all videos in the account » ; `limit`
 *    (1 à 100, défaut 10), `token` (curseur), filtres `folder_id`, `title`. Chaque élément : id, title, status
 *    (pending · processing · completed · failed), created_at, completed_at, duration, thumbnail_url, video_url ;
 *  - `GET /v3/videos/{video_id}` (reference/get-video) : `video_url` = « Presigned URL to download the video file »
 *    (durée de validité NON documentée : elle est relue juste avant chaque téléchargement), `video_page_url`.
 * La documentation ne dit pas explicitement si les vidéos faites dans l'application web figurent dans la liste
 * (« all videos in the account » le laisse penser) : à vérifier au premier essai avec la clé ; le dépôt manuel du
 * fichier téléchargé depuis HeyGen sert de secours.
 */
import type { ClientHeygen } from "./client";
import { copierEnFlux, plafondVideoHeygen, resoudreDns, type Resoudre } from "./telechargement";

export interface VideoHeygenBrute {
  id?: string;
  video_id?: string;
  title?: string | null;
  status?: string;
  created_at?: number | string | null;
  completed_at?: number | string | null;
  duration?: number | null;
  thumbnail_url?: string | null;
  video_url?: string | null;
}

/** Une vidéo du compte, en mots simples pour Will. */
export interface VideoDuCompte {
  idExterne: string;
  titre: string;
  /** Date de création (ISO). */
  creeLe?: string;
  dureeSec?: number;
  /** Image d'aperçu (adresse HeyGen). */
  vignette?: string;
  /** Terminée chez HeyGen : peut être rattachée. Sinon `raison` dit pourquoi. */
  terminee: boolean;
  raison?: string;
}

/** Instant HeyGen (secondes Unix, millisecondes ou texte ISO) → ISO ; absent ou illisible → undefined. */
export function instantIso(x: number | string | null | undefined): string | undefined {
  if (x === null || x === undefined || x === "") return undefined;
  const n = typeof x === "number" ? x : Number(x);
  const ms = Number.isFinite(n) ? (n < 1e12 ? n * 1000 : n) : Date.parse(String(x));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
}

/** Vidéo brute → vidéo du compte (PUR, testé). */
export function videoDepuisBrute(v: VideoHeygenBrute): VideoDuCompte {
  const id = v.id ?? v.video_id ?? "";
  const base: VideoDuCompte = {
    idExterne: id,
    titre: (v.title ?? "").trim() || "Vidéo sans titre",
    ...(instantIso(v.created_at) ? { creeLe: instantIso(v.created_at) } : {}),
    ...(typeof v.duration === "number" && v.duration > 0 ? { dureeSec: Math.round(v.duration * 10) / 10 } : {}),
    ...(v.thumbnail_url && /^https:\/\//.test(v.thumbnail_url) ? { vignette: v.thumbnail_url } : {}),
    terminee: false,
  };
  if (v.status === "completed") return { ...base, terminee: true };
  if (v.status === "failed") return { ...base, raison: "HeyGen n'a pas réussi cette vidéo." };
  return { ...base, raison: "HeyGen la termine encore : revenez dans un moment." };
}

/** Les vidéos du compte, les plus récentes d'abord (`GET /v3/videos`, gratuit), au plus `limite`. */
export async function listerVideosDuCompte(client: ClientHeygen, limite = 30): Promise<VideoDuCompte[]> {
  const sortie: VideoDuCompte[] = [];
  let jeton: string | undefined;
  for (let page = 0; page < 5 && sortie.length < limite; page++) {
    const q = new URLSearchParams({ limit: String(Math.min(100, limite - sortie.length)) });
    if (jeton) q.set("token", jeton);
    const r = await client.requeteEntiere<{ data?: VideoHeygenBrute[] | { videos?: VideoHeygenBrute[] }; has_more?: boolean; next_token?: string | null }>("GET", `/v3/videos?${q}`);
    const liste = Array.isArray(r.data) ? r.data : (r.data?.videos ?? []);
    sortie.push(...liste.filter((v) => v?.id || v?.video_id).map(videoDepuisBrute));
    if (!r.has_more || !r.next_token) break;
    jeton = r.next_token;
  }
  return sortie.sort((a, b) => (b.creeLe ?? "").localeCompare(a.creeLe ?? "")).slice(0, limite);
}

/** Accès en LECTURE aux vidéos du compte HeyGen (aucun appel payant). */
export interface VideosHeygen {
  lister(limite?: number): Promise<VideoDuCompte[]>;
  /** Détail d'une vidéo avec son adresse de téléchargement (relue à chaque fois : sa validité n'est pas documentée). */
  lire(idExterne: string): Promise<VideoDuCompte & { adresse?: string }>;
  /**
   * Copie la vidéo de HeyGen vers une adresse de dépôt signée du stockage, en flux, avec les gardes de
   * `telechargement.ts` (hôtes HeyGen seulement, redirections revalidées, taille annoncée ≤ `plafond`) ; renvoie la
   * taille réellement relayée.
   */
  copier(adresse: string, depot: string, mime: string): Promise<number>;
  /** Taille maximale d'une vidéo téléchargée (octets, `HEYGEN_VIDEO_MAX_MO`). */
  plafond: number;
}

export function creerVideosHeygen(client: ClientHeygen, appeler: typeof fetch = fetch, o: { resoudre?: Resoudre; plafond?: number } = {}): VideosHeygen {
  const plafond = o.plafond ?? plafondVideoHeygen();
  return {
    plafond,
    lister: (limite) => listerVideosDuCompte(client, limite),
    async lire(idExterne) {
      const v = await client.requete<VideoHeygenBrute>("GET", `/v3/videos/${encodeURIComponent(idExterne)}`);
      const lue = videoDepuisBrute({ id: idExterne, ...v });
      return { ...lue, ...(v?.video_url && /^https:\/\//.test(v.video_url) ? { adresse: v.video_url } : {}) };
    },
    copier: (adresse, depot, mime) => copierEnFlux(adresse, depot, mime, { appeler, resoudre: o.resoudre ?? resoudreDns, plafond }),
  };
}
