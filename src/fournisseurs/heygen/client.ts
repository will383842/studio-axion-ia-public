/**
 * CLIENT HTTP HEYGEN COMMUN (lot A1, M0b ; réutilisé tel quel par le lot B1 pour les Looks — jamais recopié).
 *
 * - En-tête `x-api-key` (la clé ne quitte jamais le serveur, n'est jamais écrite dans un journal ni dans une réponse) ;
 * - délai maximal par requête ;
 * - erreurs TYPÉES (`ErreurFournisseur`) : `quota` (crédits API épuisés), `refuse` (clé refusée, demande invalide),
 *   `indisponible` (réseau, 429, 5xx : réessayable).
 * Documentation : https://developers.heygen.com (API v3 ; `GET /v3/voices`, `POST /v3/voices/speech`, `GET /v3/users/me`).
 */
import type { ErreurFournisseur } from "../types";

export const ADRESSE_HEYGEN = "https://api.heygen.com";
export const DELAI_HEYGEN_MS = 60_000;

type Fetch = typeof fetch;

/** Erreur d'un appel HeyGen : porte l'erreur typée du contrat et son caractère réessayable. */
export class ErreurHeygen extends Error {
  /**
   * Lot R7e (fusion R8) : HeyGen a refusé la demande « sans fond » (avatar créé sans détourage). Classé ici, depuis le
   * code et le texte de HeyGen, parce que ce texte ne passe JAMAIS dans le message (il peut recopier la clé reçue).
   */
  constructor(
    public readonly erreur: ErreurFournisseur,
    public readonly sansFondImpossible = false,
  ) {
    super(erreur.message);
    this.name = "ErreurHeygen";
  }
  get code() {
    return this.erreur.code;
  }
  get reessayable() {
    return this.erreur.reessayable;
  }
}

export interface ClientHeygen {
  /** Requête JSON ; renvoie le champ `data` de la réponse (ou la réponse entière s'il n'y en a pas). */
  requete<T>(methode: "GET" | "POST", chemin: string, corps?: unknown, entetes?: Record<string, string>): Promise<T>;
  /** Requête JSON ; renvoie la réponse ENTIÈRE (listes paginées : `data`, `has_more`, `next_token`). */
  requeteEntiere<T>(methode: "GET" | "POST", chemin: string, corps?: unknown): Promise<T>;
  /** Télécharge un fichier produit par HeyGen (son, vidéo) : octets et type. */
  telecharger(adresse: string): Promise<{ octets: Uint8Array; mime: string }>;
}

/** Codes d'erreur HeyGen qui veulent dire « plus de crédits » (relevés dans la documentation et les réponses). */
const CODES_QUOTA = /quota|credit|balance|insufficient|payment|wallet/i;

/** Refus d'une demande « sans fond » (webm transparent) : avatar créé sans détourage chez HeyGen. */
// Vérif A2 (10/10) : « webm » seul ne suffit plus (un refus qui cite « mp4/webm » pour une autre raison faisait passer
// la vidéo en fond uni à tort) ; il faut le détourage, la transparence, ou un webm « non pris en charge ».
export const SANS_FOND_IMPOSSIBLE = /matting|transparen|(?:not\s+support\w*|unsupported)\b[^.]*\bwebm|\bwebm\b[^.]*(?:not\s+support\w*|unsupported)/i;

/**
 * ESSAI RÉEL n° 2 (05/10) : le texte de HeyGen (quel paramètre est refusé) va en console serveur SEULEMENT, tronqué et
 * MASQUÉ : toute suite de 20 caractères alphanumériques ou plus (clé, jeton, signature) devient « … ». Il ne passe
 * jamais dans le message pour Will.
 */
export function detailMasque(detail: string): string {
  return detail.replace(/[A-Za-z0-9_\-+/=]{20,}/g, "…").replace(/\s+/g, " ").slice(0, 300);
}

/** Traduit une réponse en erreur typée (messages pour Will : vouvoiement, sans jargon). */
export function erreurDepuisReponse(statut: number, corps: { error?: { code?: string; message?: string } | string | null; message?: string } | null): ErreurHeygen {
  const err = typeof corps?.error === "object" && corps.error ? corps.error : null;
  const code = err?.code ?? "";
  const detail = err?.message ?? (typeof corps?.error === "string" ? corps.error : corps?.message) ?? "";
  // E2E-1 n° 9 (03/10) : 429 = « trop de demandes », même si le message parle de « quota » (limite de débit) :
  // indisponible passager, jamais « crédit épuisé » (une recharge n'y changerait rien).
  // Le code HTTP et le code d'erreur de HeyGen vont en console serveur seulement (garde-ecran). Jamais le texte
  // brut : HeyGen y recopie parfois la clé reçue.
  console.warn(`[heygen] réponse ${statut}${code ? ` (${code.slice(0, 60)})` : ""}${detail ? ` — ${detailMasque(detail)}` : ""}`);
  if (statut === 429) {
    return new ErreurHeygen({ code: "indisponible", reessayable: true, message: "HeyGen reçoit trop de demandes. Nouvel essai dans un instant." });
  }
  if (statut === 402 || CODES_QUOTA.test(code) || CODES_QUOTA.test(detail)) {
    return new ErreurHeygen({ code: "quota", reessayable: false, message: "Les crédits HeyGen sont épuisés : rechargez le compte HeyGen, puis réessayez." });
  }
  if (statut === 401 || statut === 403) {
    return new ErreurHeygen({ code: "refuse", reessayable: false, message: "HeyGen refuse la connexion : vérifiez la clé dans Réglages > Connexions." });
  }
  if (statut === 429 || statut >= 500) {
    return new ErreurHeygen({ code: "indisponible", reessayable: true, message: "HeyGen est momentanément indisponible. Nouvel essai dans un instant." });
  }
  if (statut === 404) return new ErreurHeygen({ code: "refuse", reessayable: false, message: "HeyGen ne trouve pas cet élément (voix ou fichier supprimé chez HeyGen ?)." });
  return new ErreurHeygen({ code: "refuse", reessayable: false, message: "HeyGen a refusé la demande." }, SANS_FOND_IMPOSSIBLE.test(code) || SANS_FOND_IMPOSSIBLE.test(detail));
}

export function creerClientHeygen(options: { cle: string; fetch?: Fetch; adresse?: string; delaiMs?: number }): ClientHeygen {
  const appeler = options.fetch ?? fetch;
  const base = (options.adresse ?? ADRESSE_HEYGEN).replace(/\/+$/, "");
  const delai = options.delaiMs ?? DELAI_HEYGEN_MS;

  async function envoyer(url: string, init: RequestInit): Promise<Response> {
    try {
      return await appeler(url, { ...init, signal: AbortSignal.timeout(delai) });
    } catch (e) {
      throw new ErreurHeygen({ code: "indisponible", reessayable: true, message: `HeyGen ne répond pas (${(e as Error).name === "TimeoutError" ? "délai dépassé" : "réseau"}).` });
    }
  }

  // `entetes` (lot B1) : en-têtes en plus, ex. `Idempotency-Key` (une création rejouée sous 24 h n'est pas repayée).
  async function json(methode: "GET" | "POST", chemin: string, corps?: unknown, entetes?: Record<string, string>): Promise<Record<string, unknown>> {
    const r = await envoyer(`${base}${chemin}`, {
      method: methode,
      headers: { ...(entetes ?? {}), "x-api-key": options.cle, accept: "application/json", ...(corps === undefined ? {} : { "content-type": "application/json" }) },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
    const texte = await r.text();
    let lu: Record<string, unknown> | null = null;
    try {
      lu = texte ? (JSON.parse(texte) as Record<string, unknown>) : null;
    } catch {
      lu = null;
    }
    if (!r.ok || (lu && lu.error && typeof lu.error === "object")) throw erreurDepuisReponse(r.ok ? 400 : r.status, lu as Parameters<typeof erreurDepuisReponse>[1]);
    return lu ?? {};
  }

  return {
    async requete<T>(methode: "GET" | "POST", chemin: string, corps?: unknown, entetes?: Record<string, string>): Promise<T> {
      const lu = await json(methode, chemin, corps, entetes);
      return ("data" in lu ? lu.data : lu) as T;
    },
    async requeteEntiere<T>(methode: "GET" | "POST", chemin: string, corps?: unknown): Promise<T> {
      return (await json(methode, chemin, corps)) as T;
    },
    async telecharger(adresse: string) {
      const r = await envoyer(adresse, { method: "GET" });
      if (!r.ok) throw erreurDepuisReponse(r.status, null);
      const octets = new Uint8Array(await r.arrayBuffer());
      // Le contenu prime sur l'extension et l'en-tête : HeyGen sert aujourd'hui du MP3 sous une adresse « .wav ».
      return { octets, mime: mimeDepuisOctets(octets) ?? (r.headers.get("content-type")?.split(";")[0] || mimeDepuisAdresse(adresse)) };
    },
  };
}

/** Type d'un fichier son d'après son extension (HeyGen renvoie aujourd'hui du WAV, la documentation parle de MP3). */
export function mimeDepuisAdresse(adresse: string): string {
  const ext = /\.([a-z0-9]{2,4})(?:[?#]|$)/i.exec(adresse)?.[1]?.toLowerCase();
  return ext === "wav" ? "audio/wav" : ext === "mp4" ? "video/mp4" : ext === "webm" ? "video/webm" : ext === "m4a" ? "audio/mp4" : "audio/mpeg";
}

/** Type d'un fichier son d'après ses premiers octets (MP3 : « ID3 » ou trame 0xFFEx ; WAV : « RIFF…WAVE »). */
export function mimeDepuisOctets(o: Uint8Array): string | null {
  if (o.length >= 12 && o[0] === 0x52 && o[1] === 0x49 && o[2] === 0x46 && o[3] === 0x46 && o[8] === 0x57 && o[9] === 0x41) return "audio/wav";
  if (o.length >= 3 && o[0] === 0x49 && o[1] === 0x44 && o[2] === 0x33) return "audio/mpeg";
  if (o.length >= 2 && o[0] === 0xff && (o[1] & 0xe0) === 0xe0) return "audio/mpeg";
  return null;
}

/** Extension d'un fichier son d'après son type. */
export function extensionDepuisMime(mime: string): string {
  return mime.includes("wav") ? "wav" : mime.includes("mp4") ? "m4a" : mime.includes("webm") ? "webm" : "mp3";
}
