/**
 * VRAI CLIENT Google Drive (lot E2) : OAuth 2.0 « application Web » (code + jeton de rafraîchissement, accès hors
 * ligne), API Drive v3 en lecture seule. Jamais appelé dans les tests (double de simulation par défaut, voir `index.ts`).
 */
import { PORTEE_DRIVE, RefusDrive, type FournisseurDrive, type JetonsDrive, type VideoDrive } from "./types";

type Fetch = typeof fetch;

export interface ConfigDrive {
  clientId: string;
  clientSecret: string;
  redirection: string;
  /** Compte proposé d'office sur la page Google (le bon compte, sans chercher). */
  compteAttendu?: string;
}

const AUTORISATION = "https://accounts.google.com/o/oauth2/v2/auth";
const JETON = "https://oauth2.googleapis.com/token";
const REVOCATION = "https://oauth2.googleapis.com/revoke";
const API = "https://www.googleapis.com/drive/v3";
const CHAMPS_VIDEO = "id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,videoMediaMetadata(durationMillis,width,height)";
const DELAI_GOOGLE_MS = 30_000;
/** Une plage de 50 Mo peut prendre du temps sur une ligne lente : délai plus long que les petites requêtes. */
const DELAI_PLAGE_MS = 5 * 60_000;

/** Texte d'une recherche « name contains » sûr (apostrophes et barres obliques échappées). */
export function echapperRecherche(texte: string): string {
  return texte.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function requeteVideos(recherche?: string): string {
  const q = ["mimeType contains 'video/'", "trashed = false"];
  const r = recherche?.trim().slice(0, 100);
  if (r) q.push(`name contains '${echapperRecherche(r)}'`);
  return q.join(" and ");
}

interface FichierApi {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  thumbnailLink?: string;
  videoMediaMetadata?: { durationMillis?: string; width?: number; height?: number };
}

export function versVideo(f: FichierApi): VideoDrive {
  const ms = Number(f.videoMediaMetadata?.durationMillis ?? 0);
  return {
    id: f.id,
    nom: f.name,
    mime: f.mimeType,
    taille: Number(f.size ?? 0),
    dureeSec: Number.isFinite(ms) && ms > 0 ? Math.round(ms / 100) / 10 : 0,
    creeLe: f.createdTime ?? "",
    modifieLe: f.modifiedTime ?? f.createdTime ?? "",
    largeur: f.videoMediaMetadata?.width,
    hauteur: f.videoMediaMetadata?.height,
    vignette: !!f.thumbnailLink,
  };
}

/** Réponse Google en échec → raison lisible (401 : expirée ; 403 : quota ou refus ; 404 : introuvable). */
export async function refusDepuisReponse(r: Response): Promise<RefusDrive> {
  let detail = "";
  try {
    detail = JSON.stringify(await r.json());
  } catch {
    /* corps illisible */
  }
  if (r.status === 400 && /invalid_grant/.test(detail)) return new RefusDrive("expire", "Connexion au Drive expirée.");
  if (r.status === 401) return new RefusDrive("expire", "Connexion au Drive expirée.");
  if (r.status === 403 && /rateLimit|userRateLimitExceeded|quotaExceeded|downloadQuotaExceeded/i.test(detail)) return new RefusDrive("quota", "Google limite les téléchargements pour l'instant.");
  if (r.status === 403) return new RefusDrive("refuse", "Google refuse l'accès à ce fichier.");
  if (r.status === 404) return new RefusDrive("introuvable", "Cette vidéo n'est plus dans le Drive.");
  if (r.status === 429) return new RefusDrive("quota", "Google limite les téléchargements pour l'instant.");
  return new RefusDrive("reseau", "Google Drive ne répond pas.");
}

export function creerDriveHttp(config: ConfigDrive, dependances: { fetch?: Fetch; maintenant?: () => number } = {}): FournisseurDrive {
  const f = dependances.fetch ?? fetch;
  const maintenant = dependances.maintenant ?? Date.now;

  async function appel(url: string, init: RequestInit = {}, delai = DELAI_GOOGLE_MS): Promise<Response> {
    let r: Response;
    try {
      r = await f(url, { ...init, signal: AbortSignal.timeout(delai) });
    } catch {
      throw new RefusDrive("reseau", "Google Drive ne répond pas.");
    }
    if (!r.ok) throw await refusDepuisReponse(r);
    return r;
  }

  async function jetons(corps: Record<string, string>): Promise<JetonsDrive> {
    const r = await appel(JETON, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...corps }).toString() });
    const j = (await r.json()) as { access_token?: string; expires_in?: number; refresh_token?: string; scope?: string };
    if (!j.access_token) throw new RefusDrive("refuse", "Google n'a pas donné l'accès.");
    if (j.scope && !j.scope.split(" ").includes(PORTEE_DRIVE)) throw new RefusDrive("refuse", "L'accès en lecture au Drive n'a pas été accordé.");
    return { acces: j.access_token, expireLe: maintenant() + Math.max(60, j.expires_in ?? 3600) * 1000, rafraichissement: j.refresh_token };
  }

  const entete = (acces: string) => ({ authorization: `Bearer ${acces}` });

  return {
    mode: "reel",
    adresseConnexion(etat) {
      const p = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirection,
        response_type: "code",
        scope: PORTEE_DRIVE,
        access_type: "offline",
        // « consent » : Google redonne un jeton de rafraîchissement à chaque reconnexion.
        prompt: "consent",
        include_granted_scopes: "false",
        state: etat,
      });
      if (config.compteAttendu) p.set("login_hint", config.compteAttendu);
      return `${AUTORISATION}?${p.toString()}`;
    },
    echangerCode(code) {
      return jetons({ code, redirect_uri: config.redirection, grant_type: "authorization_code" });
    },
    rafraichir(rafraichissement) {
      return jetons({ refresh_token: rafraichissement, grant_type: "refresh_token" });
    },
    async compte(acces) {
      const r = await appel(`${API}/about?fields=user(emailAddress)`, { headers: entete(acces) });
      return ((await r.json()) as { user?: { emailAddress?: string } }).user?.emailAddress ?? "";
    },
    async listerVideos(acces, o = {}) {
      const p = new URLSearchParams({
        q: requeteVideos(o.recherche),
        orderBy: "modifiedTime desc",
        pageSize: String(Math.min(50, Math.max(1, o.parPage ?? 24))),
        fields: `nextPageToken,files(${CHAMPS_VIDEO})`,
        spaces: "drive",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
        corpora: "user",
      });
      if (o.suite) p.set("pageToken", o.suite);
      const r = await appel(`${API}/files?${p.toString()}`, { headers: entete(acces) });
      const j = (await r.json()) as { files?: FichierApi[]; nextPageToken?: string };
      return { videos: (j.files ?? []).map(versVideo), suite: j.nextPageToken };
    },
    async infosVideo(acces, id) {
      const r = await appel(`${API}/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(CHAMPS_VIDEO)}&supportsAllDrives=true`, { headers: entete(acces) });
      return versVideo((await r.json()) as FichierApi);
    },
    async lirePlage(acces, id, debut, fin) {
      const r = await appel(`${API}/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true&acknowledgeAbuse=false`, { headers: { ...entete(acces), range: `bytes=${debut}-${fin - 1}` } }, DELAI_PLAGE_MS);
      // 206 attendu ; 200 = Google renvoie tout le fichier (plage ignorée) : on refuse plutôt que de tout charger.
      if (r.status !== 206 && !(r.status === 200 && debut === 0 && Number(r.headers.get("content-length")) === fin)) {
        await r.body?.cancel();
        throw new RefusDrive("reseau", "Google Drive n'a pas envoyé la bonne partie du fichier.");
      }
      const octets = new Uint8Array(await r.arrayBuffer());
      if (octets.length !== fin - debut) throw new RefusDrive("reseau", "Morceau incomplet reçu du Drive.");
      return octets;
    },
    async lireVignette(acces, id) {
      const r = await appel(`${API}/files/${encodeURIComponent(id)}?fields=thumbnailLink&supportsAllDrives=true`, { headers: entete(acces) });
      const lien = ((await r.json()) as { thumbnailLink?: string }).thumbnailLink;
      if (!lien || !/^https:\/\/[a-z0-9.-]+\.(googleusercontent|google)\.com\//.test(lien)) return null;
      const v = await f(lien, { headers: entete(acces), signal: AbortSignal.timeout(DELAI_GOOGLE_MS) }).catch(() => null);
      if (!v?.ok) return null;
      const type = v.headers.get("content-type") ?? "image/jpeg";
      if (!type.startsWith("image/")) return null;
      return { type, octets: new Uint8Array(await v.arrayBuffer()) };
    },
    async revoquer(jeton) {
      await f(`${REVOCATION}?token=${encodeURIComponent(jeton)}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(DELAI_GOOGLE_MS) }).catch(() => undefined);
    },
  };
}
