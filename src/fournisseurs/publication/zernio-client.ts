/**
 * Client FONDATEUR Zernio à liste fermée (ADR-0002 D4, ADR-0003 D5, ADR-0004 D6-D7).
 *
 * Toute requête passe par `requete`, dans cet ordre, et chaque refus a lieu AVANT le réseau :
 *   1. arrêt  : interrupteur `zernio.envoi_autorise` (faux = écritures refusées, lectures permises) ;
 *   2. filtre : mots interdits dans tout le corps (récursif + sérialisation) ;
 *   3. chemin : liste fermée D6 (méthode, chemin, forme du corps, publishNow) ;
 *   4. débit  : plafonds locaux (requêtes/min, posts/heure/compte, posts/jour/réseau) ;
 *   5. fetch  : seul appel réseau. 429 rejoué UNE fois après Retry-After ; 5xx ou délai dépassé sur une écriture :
 *      lecture exigée avant toute nouvelle écriture (jamais de renvoi à l'aveugle).
 *
 * La clé d'API vit dans une fermeture : jamais dans un champ de l'objet, un journal, une erreur.
 */
import { createHash } from "node:crypto";
import { ErreurZernio } from "./zernio-erreurs";

/* --- Types ------------------------------------------------------------------------------------------------------- */

export const ZERNIO_URL_DEFAUT = "https://zernio.com/api";

export type MethodeHttp = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Corps binaire d'un téléversement (flux ou octets). */
export type CorpsBinaire = Uint8Array | ReadableStream<Uint8Array>;

/** Fetch injectable (tests : faux fetch qui enregistre les appels). */
export type FetchZernio = (
  url: string,
  init: { method: MethodeHttp; headers: Record<string, string>; body?: string | CorpsBinaire; signal?: AbortSignal; duplex?: "half" },
) => Promise<Response>;

/** Journal : ne reçoit jamais d'en-têtes ni de clé (méthode, chemin sans requête, statut, durée, message). */
export interface JournalZernio {
  info(message: string, donnees?: Record<string, unknown>): void;
  alerte(message: string, donnees?: Record<string, unknown>): void;
}

/** Requête vers l'API Zernio (chemin relatif à la base, commençant par `/v1/`). */
export interface RequeteApiZernio {
  methode: MethodeHttp;
  chemin: string;
  query?: Record<string, string | number | boolean>;
  corps?: unknown;
  /** En-tête Idempotency-Key (`studio-<hex>` ou `imp-<hex>`), POST /v1/posts seulement. */
  idempotence?: string;
  /** En-têtes supplémentaires (refusés si sensibles). */
  entetes?: Record<string, string>;
}

/** Téléversement vers l'adresse rendue par presign (https, même hôte, SANS Authorization). */
export interface RequeteTeleversementZernio {
  methode: "PUT";
  urlTeleversement: string;
  corps: CorpsBinaire;
  contentType: string;
  contentLength: number;
  entetes?: Record<string, string>;
}

export type RequeteZernio = RequeteApiZernio | RequeteTeleversementZernio;

/** Route reconnue par la liste fermée. */
export type RouteZernio =
  | "comptes"
  | "page-facebook"
  | "organisations-linkedin"
  | "createur-tiktok"
  | "limite-instagram"
  | "presign"
  | "televersement"
  | "creer-post"
  | "lire-post"
  | "lister-posts"
  | "promouvoir-post"
  | "remplacer-medias"
  | "analytics";

export interface ReponseZernio<T = unknown> {
  statut: number;
  corps: T;
  route: RouteZernio;
}

export interface CompteZernio {
  _id: string;
  platform: string;
  username?: string;
  displayName?: string;
  isActive?: boolean;
  [cle: string]: unknown;
}

export interface PageFacebookZernio {
  id: string;
  name?: string;
  username?: string;
  [cle: string]: unknown;
}

export interface OrganisationLinkedinZernio {
  id: string;
  name?: string;
  vanityName?: string;
  localizedName?: string;
  [cle: string]: unknown;
}

/** Statuts lus (pas de champ isDraft en lecture). */
export const STATUTS_POST_ZERNIO = ["draft", "pending_approval", "scheduled", "publishing", "published", "partial", "failed", "cancelled"] as const;
export type StatutPostZernio = (typeof STATUTS_POST_ZERNIO)[number];

export interface PlateformePostZernio {
  platform: string;
  accountId: string | { _id: string; [cle: string]: unknown };
  status?: string;
  errorMessage?: string;
  errorCategory?: string;
  errorSource?: string;
  platformPostUrl?: string;
  customContent?: string;
  platformSpecificData?: Record<string, unknown>;
  [cle: string]: unknown;
}

export interface MediaItemZernio {
  type: "image" | "video" | "document" | string;
  url: string;
  title?: string;
  altText?: string;
  [cle: string]: unknown;
}

export interface PostZernio {
  _id: string;
  content?: string;
  status: StatutPostZernio | string;
  scheduledFor?: string;
  timezone?: string;
  platforms: PlateformePostZernio[];
  mediaItems?: MediaItemZernio[];
  metadata?: Record<string, unknown>;
  [cle: string]: unknown;
}

/** Corps de création (POST /v1/posts). Jamais `publishNow`. */
export interface CorpsPostZernio {
  content?: string;
  isDraft?: boolean;
  scheduledFor?: string;
  timezone?: string;
  platforms: PlateformePostZernio[];
  mediaItems?: MediaItemZernio[];
  firstComment?: string;
  metadata?: Record<string, unknown>;
  [cle: string]: unknown;
}

/** Verdict par plateforme (jugé sur `platforms[].status`, jamais sur le seul code HTTP). */
export type IssueCreationZernio = "ok" | "partiel" | "echec";

export interface ResultatCreationZernio {
  statut: number;
  post: PostZernio;
  issue: IssueCreationZernio;
  /** Plateformes en échec (statut `failed`), avec leur message nettoyé. */
  echecs: { platform: string; errorMessage?: string; errorCategory?: string }[];
  /** 200 sur un rejeu de la même Idempotency-Key : post d'origine rendu. */
  rejeu: boolean;
}

export interface TeleversementPrepareZernio {
  uploadUrl: string;
  publicUrl: string;
  key?: string;
  expiresIn?: number;
}

/** Demande de promotion D5 : brouillon → programmé, à la date du journal. */
export interface DemandePromotionZernio {
  postId: string;
  /** Clé du journal du Studio, attendue telle quelle dans `metadata.studioCle`. */
  cleJournal: string;
  /** Date du journal (ISO avec Z, à la seconde, sans fraction). */
  dateJournal: string;
  /** Médias du post : date du téléversement et fonction de nouveau téléversement (si plus de 6 jours). */
  medias?: { televerseLe: string; reteleverser: () => Promise<MediaItemZernio[]> };
}

export type ResultatPromotionZernio =
  | { etat: "programme"; post: PostZernio; mediasRemplaces: boolean }
  /** Date passée ou à moins de 30 min : aucun PUT, « À reprogrammer par vous ». */
  | { etat: "a-reprogrammer"; raison: string }
  /** Garde du GET avant non tenue (statut, origine, clé, mot interdit) : aucun PUT. */
  | { etat: "refuse"; raison: string }
  /** GET après non conforme : « À vérifier », alerte, aucun nouvel essai automatique. */
  | { etat: "a-verifier"; raison: string; post?: PostZernio };

export interface OptionsClientZernio {
  /** Clé ZERNIO_API_KEY : gardée en fermeture, jamais écrite ni journalisée. */
  cle: string;
  /** Réglage `zernio.envoi_autorise` (défaut vrai), relu à CHAQUE requête, avant toute autre vérification. */
  envoiAutorise?: () => boolean | Promise<boolean>;
  fetch?: FetchZernio;
  baseUrl?: string;
  /** Nombre de comptes connectés (60 req/min si ≤ 2, sinon 600) ; mis à jour par `listerComptes`. */
  nombreComptes?: number;
  maintenant?: () => number;
  attendre?: (ms: number) => Promise<void>;
  journal?: JournalZernio;
  /** Délai maximal d'un appel (ms), défaut 30 s. */
  delaiMs?: number;
}

export interface ClientZernio {
  /** Porte unique : arrêt → filtre → chemin → débit → fetch. */
  requete<T = unknown>(req: RequeteZernio): Promise<ReponseZernio<T>>;
  listerComptes(): Promise<CompteZernio[]>;
  pagesFacebook(accountId: string): Promise<PageFacebookZernio[]>;
  organisationsLinkedin(accountId: string): Promise<OrganisationLinkedinZernio[]>;
  infoCreateurTiktok(accountId: string): Promise<Record<string, unknown>>;
  limitePublicationInstagram(accountId: string): Promise<Record<string, unknown>>;
  preparerTeleversement(d: { filename: string; contentType: string; size?: number }): Promise<TeleversementPrepareZernio>;
  televerser(d: { uploadUrl: string; corps: CorpsBinaire; contentType: string; contentLength: number }): Promise<void>;
  creerPost(corps: CorpsPostZernio, idempotence: string): Promise<ResultatCreationZernio>;
  lirePost(postId: string): Promise<PostZernio>;
  listerPosts(query?: Record<string, string | number | boolean>): Promise<PostZernio[]>;
  promouvoir(d: DemandePromotionZernio): Promise<ResultatPromotionZernio>;
  analytics(query?: Record<string, string | number | boolean>): Promise<unknown>;
}

/* --- Constantes ------------------------------------------------------------------------------------------------- */

/** Écart minimal entre le PUT de promotion et la date programmée. */
export const PROMOTION_MARGE_MIN_MS = 30 * 60 * 1000;
/** Au-delà, le média est re-téléversé avant promotion (stockage temporaire Zernio : 7 jours). */
export const MEDIA_AGE_MAX_MS = 6 * 24 * 60 * 60 * 1000;
export const ORIGINES_PROMOUVABLES = ["studio", "import-buffer"] as const;

/* --- Clés d'idempotence (D4) ------------------------------------------------------------------------------------ */

/** `Idempotency-Key` d'un envoi du Studio : `studio-<hex>` à partir de `cleEnvoiPublication`. */
export function enteteIdempotenceStudio(cleHex: string): string {
  void cleHex;
  throw new Error("non implémenté");
}

/** `Idempotency-Key` d'un import Buffer : `imp-<sha256(bufferId:accountId:pageId|organizationUrn)>`. */
export function cleIdempotenceImport(bufferId: string, accountId: string, cible: { pageId: string } | { organizationUrn: string }): string {
  void [bufferId, accountId, cible, createHash];
  throw new Error("non implémenté");
}

/* --- Liste fermée (D6) ------------------------------------------------------------------------------------------- */

export function estEcriture(methode: MethodeHttp): boolean {
  return methode !== "GET";
}

/**
 * Vérifie une requête contre la liste fermée et rend sa route ; lève `ErreurZernio("chemin-refuse")` sinon. PUR.
 * `hotesTeleversement` : hôtes rendus par presign (seuls permis pour `PUT <uploadUrl>`).
 */
export function verifierRequete(req: RequeteZernio, hotesTeleversement: ReadonlySet<string>, maintenant: number): RouteZernio {
  void [req, hotesTeleversement, maintenant];
  throw new ErreurZernio("chemin-refuse", "non implémenté");
}

/* --- Débit ------------------------------------------------------------------------------------------------------- */

export interface OptionsLimiteurDebit {
  nombreComptes: number;
  maintenant: () => number;
}

/** Plafonds locaux : refus AVANT le réseau (`ErreurZernio("debit")` avec `attenteMs`). */
export class LimiteurDebitZernio {
  constructor(private readonly options: OptionsLimiteurDebit) {}
  /** Change le nombre de comptes (60 req/min si ≤ 2, sinon 600). */
  definirNombreComptes(n: number): void {
    void n;
    throw new Error("non implémenté");
  }
  /** Réserve une requête (et, pour une création, un post par compte et par réseau). */
  reserver(route: RouteZernio, corps?: unknown): void {
    void [route, corps, this.options];
    throw new Error("non implémenté");
  }
}

/* --- Client ------------------------------------------------------------------------------------------------------ */

export function creerClientZernio(options: OptionsClientZernio): ClientZernio {
  void options;
  throw new Error("non implémenté");
}
