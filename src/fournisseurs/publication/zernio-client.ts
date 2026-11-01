/**
 * Client FONDATEUR Zernio à liste fermée (ADR-0002 D4, ADR-0003 D5, ADR-0004 D6-D7).
 *
 * Toute requête passe par `requete`, dans cet ordre, et chaque refus a lieu AVANT le réseau :
 *   1. arrêt  : interrupteur `zernio.envoi_autorise` (faux = écritures refusées, lectures permises) ;
 *   2. filtre : mots interdits dans tout le corps (récursif + sérialisation) ;
 *   3. chemin : liste fermée D6 (méthode, chemin, forme du corps, publishNow) ; tout PUT /v1/posts/{id} est refusé
 *      par la porte publique et réservé à `promouvoir()` (GET avant, garde D5) ;
 *   4. débit  : plafonds locaux (requêtes/min, posts/heure/compte, posts/jour/réseau) ;
 *   5. fetch  : seul appel réseau. 429 rejoué UNE fois après Retry-After ; 5xx ou délai dépassé sur une écriture :
 *      lecture exigée avant toute nouvelle écriture (jamais de renvoi à l'aveugle).
 *
 * La clé d'API vit dans une fermeture : jamais dans un champ de l'objet, un journal, une erreur.
 */
import { createHash } from "node:crypto";
import { ErreurZernio, estErreurZernio, masquerSecret } from "./zernio-erreurs";
import { exigerCorpsSansMotInterdit, motsInterditsDuCorps } from "./zernio-filtre";

/* --- Types ------------------------------------------------------------------------------------------------------- */

export const ZERNIO_URL_DEFAUT = "https://zernio.com/api";

export type MethodeHttp = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Corps binaire d'un téléversement (flux ou octets). */
export type CorpsBinaire = Uint8Array | ReadableStream<Uint8Array>;

/** Fetch injectable (tests : faux fetch qui enregistre les appels). */
export type FetchZernio = (
  url: string,
  init: {
    method: MethodeHttp;
    headers: Record<string, string>;
    body?: string | CorpsBinaire;
    signal?: AbortSignal;
    duplex?: "half";
    /** Toujours "error" : une redirection (307/308) ne rejoue jamais méthode et corps hors de la liste fermée. */
    redirect?: "error";
  },
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
  /**
   * État « à vérifier » persisté par l'appelant (Z1-P) : vrai si un envoi précédent, peut-être dans un autre
   * processus, a fini sans réponse sûre. Le client exige alors une lecture de posts avant toute écriture.
   */
  lectureRequiseInitiale?: boolean;
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
  /**
   * Vrai tant qu'une écriture a fini sans réponse sûre (5xx, délai, coupure) et qu'aucune lecture de posts n'a suivi.
   * Cet état ne vit qu'en mémoire : l'appelant DOIT le persister (journal « à vérifier ») et le rendre au prochain
   * client via `lectureRequiseInitiale`, sinon un client recréé pourrait réécrire sans lecture préalable.
   */
  lectureExigee(): boolean;
}

/* --- Constantes ------------------------------------------------------------------------------------------------- */

/** Écart minimal entre le PUT de promotion et la date programmée. */
export const PROMOTION_MARGE_MIN_MS = 30 * 60 * 1000;
/** Au-delà, le média est re-téléversé avant promotion (stockage temporaire Zernio : 7 jours). */
export const MEDIA_AGE_MAX_MS = 6 * 24 * 60 * 60 * 1000;
export const ORIGINES_PROMOUVABLES = ["studio", "import-buffer"] as const;

/* --- Clés d'idempotence (D4) ------------------------------------------------------------------------------------ */

const HEX_64 = /^[0-9a-f]{64}$/;
const IDEMPOTENCE_PERMISE = /^(studio|imp)-[0-9a-f]{64}$/;

/** `Idempotency-Key` d'un envoi du Studio : `studio-<hex>` à partir de `cleEnvoiPublication` (71 signes). */
export function enteteIdempotenceStudio(cleHex: string): string {
  if (!HEX_64.test(cleHex)) throw new ErreurZernio("chemin-refuse", "Clé d'envoi invalide : 64 signes hexadécimaux attendus.");
  return `studio-${cleHex}`;
}

/** `Idempotency-Key` d'un import Buffer : `imp-<sha256(bufferId:accountId:pageId|organizationUrn)>`. */
export function cleIdempotenceImport(bufferId: string, accountId: string, cible: { pageId: string } | { organizationUrn: string }): string {
  const cibleTexte = "pageId" in cible ? cible.pageId : cible.organizationUrn;
  if (!bufferId || !accountId || !cibleTexte) throw new ErreurZernio("chemin-refuse", "Clé d'import incomplète : identifiant Buffer, compte et cible exigés.");
  return `imp-${createHash("sha256").update(`${bufferId}:${accountId}:${cibleTexte}`).digest("hex")}`;
}

/* --- Liste fermée (D6) ------------------------------------------------------------------------------------------- */

export function estEcriture(methode: MethodeHttp): boolean {
  return methode !== "GET";
}

/** Un segment d'identifiant ({accountId}, {postId}) : lettres, chiffres, `_`, `-` seulement. */
const SEGMENT_ID = "[A-Za-z0-9_-]{1,128}";

/** Table des routes permises : méthode + motif exact du chemin. Tout le reste est refusé. */
const ROUTES: readonly { methode: MethodeHttp; motif: RegExp; route: RouteZernio }[] = [
  { methode: "GET", motif: /^\/v1\/accounts$/, route: "comptes" },
  { methode: "GET", motif: new RegExp(`^/v1/accounts/${SEGMENT_ID}/facebook-page$`), route: "page-facebook" },
  { methode: "GET", motif: new RegExp(`^/v1/accounts/${SEGMENT_ID}/linkedin-organizations$`), route: "organisations-linkedin" },
  { methode: "GET", motif: new RegExp(`^/v1/accounts/${SEGMENT_ID}/tiktok/creator-info$`), route: "createur-tiktok" },
  { methode: "GET", motif: new RegExp(`^/v1/accounts/${SEGMENT_ID}/instagram/publishing-limit$`), route: "limite-instagram" },
  { methode: "POST", motif: /^\/v1\/media\/presign$/, route: "presign" },
  { methode: "POST", motif: /^\/v1\/posts$/, route: "creer-post" },
  { methode: "GET", motif: /^\/v1\/posts$/, route: "lister-posts" },
  { methode: "GET", motif: new RegExp(`^/v1/posts/${SEGMENT_ID}$`), route: "lire-post" },
  { methode: "PUT", motif: new RegExp(`^/v1/posts/${SEGMENT_ID}$`), route: "promouvoir-post" },
  { methode: "GET", motif: /^\/v1\/analytics$/, route: "analytics" },
];

/** En-têtes supplémentaires permis sur l'API (les autres, dont Authorization, sont posés par le client seul). */
const ENTETES_API_PERMIS = new Set(["x-request-id"]);
/** En-têtes supplémentaires permis sur le téléversement (jamais Authorization). */
const ENTETES_TELEVERSEMENT_PERMIS = new Set<string>();

const refus = (message: string, champs?: string[]) => new ErreurZernio("chemin-refuse", `${message} Rien n'a été envoyé.`, { champs });

/** `publishNow` sous toutes ses formes (casse, tiret, souligné) dans un nom ou une valeur. */
function ressemblePublishNow(t: string): boolean {
  return t.toLowerCase().replace(/[^a-z]/g, "").includes("publishnow");
}

/** Cherche `publishNow` dans les clés et les valeurs d'un corps, en profondeur. */
function contientPublishNow(v: unknown, profondeur = 0): boolean {
  if (profondeur > 32) return true;
  if (typeof v === "string") return ressemblePublishNow(v);
  if (Array.isArray(v)) return v.some((x) => contientPublishNow(x, profondeur + 1));
  if (v !== null && typeof v === "object") {
    return Object.entries(v as Record<string, unknown>).some(([k, x]) => ressemblePublishNow(k) || contientPublishNow(x, profondeur + 1));
  }
  return false;
}

function estObjet(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Date ISO à la seconde, en UTC, terminée par Z (fraction nulle tolérée). */
const ISO_SECONDE_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.0{1,3})?Z$/;

/** Adresse lisible, en https, sans identifiants. */
function estUrlHttps(texte: string): boolean {
  try {
    const u = new URL(texte);
    return u.protocol === "https:" && !u.username && !u.password && u.hostname.length > 0;
  } catch {
    return false;
  }
}

/** Forme permise de la valeur de x-request-id (ni filtre contournable, ni injection d'en-tête). */
const VALEUR_REQUEST_ID = /^[A-Za-z0-9-]{1,64}$/;

/** Catégorie d'échec rendue par Zernio : gardée seulement si elle a la forme d'un code court (finitions Z2-S). */
export function categorieSure(valeur: unknown): string | undefined {
  return typeof valeur === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(valeur) ? valeur : undefined;
}

function verifierEntetes(entetes: Record<string, string> | undefined, permis: ReadonlySet<string>): void {
  for (const [nom, valeur] of Object.entries(entetes ?? {})) {
    if (!permis.has(nom.toLowerCase())) throw refus(`En-tête « ${nom} » non permis.`);
    if (nom.toLowerCase() === "x-request-id" && (typeof valeur !== "string" || !VALEUR_REQUEST_ID.test(valeur))) {
      throw refus("En-tête x-request-id : 1 à 64 lettres, chiffres ou tirets attendus.");
    }
    // Par cohérence avec les corps : la valeur passe aussi par le filtre des mots interdits (finitions, relecture #154).
    if (nom.toLowerCase() === "x-request-id" && motsInterditsDuCorps(valeur).length) {
      throw refus("En-tête x-request-id : valeur refusée par le filtre des mots interdits.");
    }
  }
}

/**
 * Formes permises du corps d'un PUT /v1/posts/{postId} (D5) : promotion stricte ou remplacement des médias.
 * Promotion : date au moins 30 min dans le futur (sinon publication immédiate). Médias : adresses https seulement.
 * NB : la porte publique `requete()` refuse de toute façon ces deux formes (réservées à `promouvoir()`).
 */
function routeDuPut(corps: unknown, maintenant: number): RouteZernio {
  if (!estObjet(corps)) throw refus("PUT d'un post : corps objet attendu.");
  const cles = Object.keys(corps).sort();
  if (cles.length === 2 && cles[0] === "isDraft" && cles[1] === "scheduledFor") {
    if (corps.isDraft !== false) throw refus("PUT de promotion : isDraft doit valoir false.");
    if (typeof corps.scheduledFor !== "string" || !ISO_SECONDE_Z.test(corps.scheduledFor)) throw refus("PUT de promotion : scheduledFor ISO à la seconde avec Z attendu.");
    if (!(Date.parse(corps.scheduledFor) >= maintenant + PROMOTION_MARGE_MIN_MS)) {
      throw refus("PUT de promotion : date passée ou à moins de 30 min, elle publierait tout de suite.");
    }
    return "promouvoir-post";
  }
  if (cles.length === 1 && cles[0] === "mediaItems") {
    const items = corps.mediaItems;
    if (!Array.isArray(items) || items.length === 0 || !items.every((m) => estObjet(m) && typeof m.url === "string")) {
      throw refus("PUT de remplacement des médias : liste de médias non vide attendue.");
    }
    if (!items.every((m) => estUrlHttps((m as Record<string, unknown>).url as string))) {
      throw refus("PUT de remplacement des médias : adresse https sans identifiants exigée pour chaque média.");
    }
    return "remplacer-medias";
  }
  throw refus(`PUT d'un post : seules les formes { isDraft, scheduledFor } ou { mediaItems } sont permises (reçu : ${cles.join(", ") || "vide"}).`, cles);
}

/** Corps d'une création : liste de plateformes, et brouillon ou date au moins 30 min dans le futur. */
function verifierCreation(corps: unknown, maintenant: number): void {
  if (!estObjet(corps)) throw refus("Création de post : corps objet attendu.");
  if (!Array.isArray(corps.platforms) || corps.platforms.length === 0) throw refus("Création de post : au moins une plateforme exigée.");
  if (corps.isDraft === true) return;
  // Hors brouillon, une date absente, passée ou trop proche publierait tout de suite (Zernio ne contrôle pas).
  if (typeof corps.scheduledFor !== "string" || !ISO_SECONDE_Z.test(corps.scheduledFor)) {
    throw refus("Création de post : brouillon (isDraft: true) ou scheduledFor ISO avec Z exigé.");
  }
  if (Date.parse(corps.scheduledFor) < maintenant + PROMOTION_MARGE_MIN_MS) {
    throw refus("Création de post : date à moins de 30 min, elle publierait tout de suite.");
  }
}

function verifierPresign(corps: unknown): void {
  if (!estObjet(corps)) throw refus("Presign : corps objet attendu.");
  const permis = new Set(["filename", "contentType", "size"]);
  const autres = Object.keys(corps).filter((k) => !permis.has(k));
  if (autres.length > 0) throw refus(`Presign : champs non permis (${autres.join(", ")}).`, autres);
  if (typeof corps.filename !== "string" || typeof corps.contentType !== "string") throw refus("Presign : filename et contentType exigés.");
}

/**
 * Vérifie une requête contre la liste fermée et rend sa route ; lève `ErreurZernio("chemin-refuse")` sinon. PUR.
 * `hotesTeleversement` : hôtes rendus par presign (seuls permis pour `PUT <uploadUrl>`).
 */
export function verifierRequete(req: RequeteZernio, hotesTeleversement: ReadonlySet<string>, maintenant: number): RouteZernio {
  if ("urlTeleversement" in req) {
    if (req.methode !== "PUT") throw refus("Téléversement : seule la méthode PUT est permise.");
    let url: URL;
    try {
      url = new URL(req.urlTeleversement);
    } catch {
      throw refus("Téléversement : adresse illisible.");
    }
    if (url.protocol !== "https:") throw refus("Téléversement : adresse https exigée.");
    if (url.username || url.password) throw refus("Téléversement : identifiants dans l'adresse refusés.");
    if (!hotesTeleversement.has(url.host)) throw refus("Téléversement : hôte différent de celui rendu par presign.");
    verifierEntetes(req.entetes, ENTETES_TELEVERSEMENT_PERMIS);
    if (!Number.isSafeInteger(req.contentLength) || req.contentLength <= 0) throw refus("Téléversement : Content-Length exigé.");
    return "televersement";
  }

  const { methode, chemin } = req;
  if (typeof chemin !== "string" || !/^\/v1\/[A-Za-z0-9_\-/]+$/.test(chemin) || chemin.includes("//")) {
    throw refus(`Chemin « ${String(chemin).slice(0, 80)} » illisible ou hors API.`);
  }
  if (ressemblePublishNow(chemin)) throw refus("publishNow refusé.");
  for (const [k, v] of Object.entries(req.query ?? {})) {
    if (ressemblePublishNow(k) || ressemblePublishNow(String(v))) throw refus("publishNow refusé.", [k]);
  }
  if (contientPublishNow(req.corps)) throw refus("publishNow refusé.");
  verifierEntetes(req.entetes, ENTETES_API_PERMIS);

  const trouvee = ROUTES.find((r) => r.methode === methode && r.motif.test(chemin));
  if (!trouvee) throw refus(`${methode} ${chemin} : hors de la liste fermée.`);

  if (methode === "GET" && req.corps !== undefined) throw refus("Une lecture ne porte pas de corps.");
  if (estEcriture(methode) && req.query && Object.keys(req.query).length > 0) throw refus("Une écriture ne porte pas de paramètres de requête.");
  if (req.idempotence !== undefined && trouvee.route !== "creer-post") throw refus("Idempotency-Key réservée à la création de post.");

  switch (trouvee.route) {
    case "creer-post":
      if (!req.idempotence || !IDEMPOTENCE_PERMISE.test(req.idempotence)) throw refus("Création de post : Idempotency-Key studio-<hex> ou imp-<hex> exigée.");
      verifierCreation(req.corps, maintenant);
      return "creer-post";
    case "promouvoir-post":
      return routeDuPut(req.corps, maintenant);
    case "presign":
      verifierPresign(req.corps);
      return "presign";
    default:
      return trouvee.route;
  }
}

/* --- Débit ------------------------------------------------------------------------------------------------------- */

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;
/** Posts par compte et par heure (vélocité Zernio). */
export const POSTS_PAR_HEURE_ET_COMPTE = 25;
/** Posts par jour, par compte et par réseau (TikTok : 15 vidéos et 15 photos). */
export const POSTS_PAR_JOUR: Readonly<Record<string, number>> = { instagram: 100, facebook: 100, linkedin: 50, "tiktok-video": 15, "tiktok-photo": 15 };

export interface OptionsLimiteurDebit {
  nombreComptes: number;
  maintenant: () => number;
}

/** Plafonds locaux : refus AVANT le réseau (`ErreurZernio("debit")` avec `attenteMs`). */
export class LimiteurDebitZernio {
  private nombreComptes: number;
  private readonly requetes: number[] = [];
  private readonly posts = new Map<string, number[]>();

  constructor(private readonly options: OptionsLimiteurDebit) {
    this.nombreComptes = options.nombreComptes;
  }

  /** Change le nombre de comptes (60 req/min si ≤ 2, sinon 600). */
  definirNombreComptes(n: number): void {
    if (Number.isFinite(n) && n >= 0) this.nombreComptes = n;
  }

  /** Plafond de requêtes par minute selon le nombre de comptes. */
  get requetesParMinute(): number {
    return this.nombreComptes <= 2 ? 60 : 600;
  }

  /**
   * Réserve une requête ; pour une création (`corps` donné), aussi un post par compte (heure) et par réseau (jour).
   * Tout ou rien : si un plafond est atteint, rien n'est compté.
   */
  reserver(route: RouteZernio, corps?: unknown): void {
    const t = this.options.maintenant();
    const attente: number[] = [];
    if (route !== "televersement") {
      const libre = this.attenteFenetre(this.requetes, t, MINUTE, this.requetesParMinute);
      if (libre > 0) attente.push(libre);
    }
    const cles = route === "creer-post" && corps !== undefined ? clesDePosts(corps) : [];
    for (const { compte, reseauJour } of cles) {
      const heure = this.attenteFenetre(this.serie(`h:${compte}`), t, HEURE, POSTS_PAR_HEURE_ET_COMPTE);
      if (heure > 0) attente.push(heure);
      const plafondJour = POSTS_PAR_JOUR[reseauJour];
      if (plafondJour !== undefined) {
        const jour = this.attenteFenetre(this.serie(`j:${reseauJour}:${compte}`), t, JOUR, plafondJour);
        if (jour > 0) attente.push(jour);
      }
    }
    if (attente.length > 0) {
      const attenteMs = Math.max(...attente);
      throw new ErreurZernio("debit", `Plafond d'envoi atteint : réessayer dans ${Math.ceil(attenteMs / 1000)} s. Rien n'a été envoyé.`, { reessayable: true, attenteMs });
    }
    if (route !== "televersement") this.requetes.push(t);
    for (const { compte, reseauJour } of cles) {
      this.serie(`h:${compte}`).push(t);
      if (POSTS_PAR_JOUR[reseauJour] !== undefined) this.serie(`j:${reseauJour}:${compte}`).push(t);
    }
  }

  private serie(cle: string): number[] {
    let s = this.posts.get(cle);
    if (!s) {
      s = [];
      this.posts.set(cle, s);
    }
    return s;
  }

  /** Purge la fenêtre glissante ; rend 0 si une place est libre, sinon l'attente avant la prochaine place. */
  private attenteFenetre(serie: number[], t: number, fenetre: number, plafond: number): number {
    while (serie.length > 0 && serie[0] <= t - fenetre) serie.shift();
    return serie.length < plafond ? 0 : serie[0] + fenetre - t;
  }
}

/** Compte et réseau (TikTok séparé en vidéo / photo) de chaque plateforme d'un corps de création. */
function clesDePosts(corps: unknown): { compte: string; reseauJour: string }[] {
  if (!estObjet(corps) || !Array.isArray(corps.platforms)) return [];
  const medias = Array.isArray(corps.mediaItems) ? corps.mediaItems : [];
  const aVideo = medias.some((m) => estObjet(m) && m.type === "video");
  return corps.platforms.filter(estObjet).map((p) => {
    const compte = typeof p.accountId === "string" ? p.accountId : estObjet(p.accountId) ? String(p.accountId._id) : "?";
    const reseau = String(p.platform ?? "?").toLowerCase();
    return { compte, reseauJour: reseau === "tiktok" ? (aVideo ? "tiktok-video" : "tiktok-photo") : reseau };
  });
}

/* --- Client ------------------------------------------------------------------------------------------------------ */

/** Attente maximale acceptée pour rejouer un 429 (au-delà : refus, pas de rejeu). */
export const RETRY_AFTER_MAX_MS = 5 * MINUTE;
const RETRY_AFTER_DEFAUT_MS = MINUTE;

/** Statuts d'une plateforme jugés en échec (207 : jugé sur `platforms[].status`). */
const STATUTS_ECHEC = new Set(["failed", "error"]);

/** Lit Retry-After (secondes ou date HTTP) en millisecondes. */
function lireRetryAfter(valeur: string | null, maintenant: number): number {
  if (!valeur) return RETRY_AFTER_DEFAUT_MS;
  const secondes = Number(valeur);
  if (Number.isFinite(secondes) && secondes >= 0) return secondes * 1000;
  const date = Date.parse(valeur);
  return Number.isFinite(date) ? Math.max(0, date - maintenant) : RETRY_AFTER_DEFAUT_MS;
}

/** Date du journal → ISO à la seconde avec Z ; null si illisible ou avec une fraction non nulle (jamais d'arrondi). */
function dateALaSeconde(iso: string): string | null {
  if (!ISO_SECONDE_Z.test(iso)) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toISOString().replace(/\.000Z$/, "Z") : null;
}

export function creerClientZernio(options: OptionsClientZernio): ClientZernio {
  // La clé reste dans cette fermeture : aucun champ de l'objet rendu ne la porte.
  const cle = options.cle;
  if (typeof cle !== "string" || cle.trim().length === 0) {
    throw new ErreurZernio("acces", "Clé Zernio absente : envoi impossible.");
  }
  const fetchZ: FetchZernio = options.fetch ?? ((url, init) => fetch(url, init as RequestInit));
  const base = (options.baseUrl ?? ZERNIO_URL_DEFAUT).replace(/\/+$/, "");
  // La clé part dans Authorization : jamais vers une base en clair ni portant des identifiants.
  if (!estUrlHttps(base) || /[?#]/.test(base)) {
    throw new ErreurZernio("acces", "Adresse Zernio refusée : https sans identifiants exigé.");
  }
  const maintenant = options.maintenant ?? (() => Date.now());
  const attendre = options.attendre ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const delaiMs = options.delaiMs ?? 30_000;
  const envoiAutorise = options.envoiAutorise ?? (() => true);
  const limiteur = new LimiteurDebitZernio({ nombreComptes: options.nombreComptes ?? 2, maintenant });
  const hotesTeleversement = new Set<string>();
  /**
   * Vrai après une 5xx, un délai dépassé ou une coupure sur une écriture : une lecture de posts doit précéder toute
   * écriture. En mémoire seulement : exposé par `lectureExigee()`, à persister par l'appelant (voir `ClientZernio`).
   */
  let lectureRequise = options.lectureRequiseInitiale === true;

  const propre = (t: string) => masquerSecret(t, [cle]);
  const journal = {
    info: (m: string, d?: Record<string, unknown>) => options.journal?.info(propre(m), d && JSON.parse(propre(JSON.stringify(d)))),
    alerte: (m: string, d?: Record<string, unknown>) => options.journal?.alerte(propre(m), d && JSON.parse(propre(JSON.stringify(d)))),
  };

  async function lireCorps(rep: Response): Promise<unknown> {
    // Tout corps reçu est nettoyé AVANT lecture : un écho de la clé ne peut ressortir nulle part.
    const texte = propre(await rep.text());
    if (!texte) return undefined;
    try {
      return JSON.parse(texte);
    } catch {
      return propre(texte.slice(0, 500));
    }
  }

  function texteErreur(corps: unknown): string {
    if (estObjet(corps)) {
      const e = corps.error ?? corps.message;
      return propre(typeof e === "string" ? e.slice(0, 500) : JSON.stringify(corps).slice(0, 500));
    }
    return typeof corps === "string" ? propre(corps.slice(0, 500)) : "";
  }

  /** Un seul appel réseau (en-têtes posés ici et nulle part ailleurs). */
  async function appeler(req: RequeteZernio): Promise<Response> {
    if ("urlTeleversement" in req) {
      // Téléversement : JAMAIS d'Authorization vers l'hôte de stockage.
      return fetchZ(req.urlTeleversement, {
        method: "PUT",
        headers: { "Content-Type": req.contentType, "Content-Length": String(req.contentLength) },
        body: req.corps,
        signal: AbortSignal.timeout(delaiMs),
        duplex: "half",
        redirect: "error",
      });
    }
    const qs = req.query && Object.keys(req.query).length > 0 ? `?${new URLSearchParams(Object.entries(req.query).map(([k, v]) => [k, String(v)]))}` : "";
    const headers: Record<string, string> = { Accept: "application/json", ...(req.entetes ?? {}), Authorization: `Bearer ${cle}` };
    if (req.corps !== undefined) headers["Content-Type"] = "application/json";
    if (req.idempotence) headers["Idempotency-Key"] = req.idempotence;
    return fetchZ(`${base}${req.chemin}${qs}`, {
      method: req.methode,
      headers,
      body: req.corps === undefined ? undefined : JSON.stringify(req.corps),
      signal: AbortSignal.timeout(delaiMs),
      redirect: "error",
    });
  }

  /** Porte publique : tout PUT /v1/posts/{id} (promotion ou médias) y est refusé, réservé à `promouvoir()` (garde D5). */
  function requete<T = unknown>(req: RequeteZernio): Promise<ReponseZernio<T>> {
    return requeteInterne<T>(req, false);
  }

  /** `depuisPromotion` : vrai seulement quand `promouvoir()` appelle, après son GET avant (jamais exporté). */
  async function requeteInterne<T = unknown>(req: RequeteZernio, depuisPromotion: boolean): Promise<ReponseZernio<T>> {
    const ecriture = estEcriture(req.methode);
    const libelle = "urlTeleversement" in req ? "PUT <uploadUrl>" : `${req.methode} ${req.chemin}`;

    // 1. Arrêt : interrupteur lu en premier, à chaque requête.
    if (ecriture && !(await envoiAutorise())) {
      throw new ErreurZernio("envoi-coupe", "Envoi vers Zernio coupé (réglage zernio.envoi_autorise) : écriture refusée, rien n'a été envoyé.");
    }
    // 2. Filtre des mots interdits sur tout le corps JSON (le binaire d'un téléversement n'est pas du texte).
    if (!("urlTeleversement" in req)) {
      exigerCorpsSansMotInterdit(req.corps, libelle);
      if (req.query) exigerCorpsSansMotInterdit(req.query, libelle);
    }
    // 3. Chemin : liste fermée.
    const route = verifierRequete(req, hotesTeleversement, maintenant());
    if ((route === "promouvoir-post" || route === "remplacer-medias") && !depuisPromotion) {
      throw refus("PUT d'un post réservé à promouvoir() (garde D5 : GET avant, origine, clé, filtre, marge de 30 min).");
    }
    if (ecriture && lectureRequise) {
      throw new ErreurZernio("lecture-requise", "Un envoi précédent a fini sans réponse sûre : lire les posts avant tout nouvel envoi. Rien n'a été envoyé.");
    }
    // 4. Débit local.
    limiteur.reserver(route, route === "creer-post" && !("urlTeleversement" in req) ? req.corps : undefined);

    // 5. Réseau : 429 rejoué une seule fois.
    for (let essai = 1; ; essai++) {
      const debut = maintenant();
      let rep: Response;
      let corps: unknown;
      try {
        rep = await appeler(req);
        // Lecture du corps dans le même try : un délai ou une coupure pendant la lecture = réponse non sûre.
        corps = await lireCorps(rep);
      } catch (e) {
        const nom = e instanceof Error ? e.name : "";
        const detail = propre(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
        const delai = nom === "AbortError" || nom === "TimeoutError";
        journal.alerte("Zernio : appel sans réponse", { requete: libelle, delaiDepasse: delai });
        if (ecriture) {
          lectureRequise = true;
          throw new ErreurZernio("a-verifier", "Zernio n'a pas répondu à temps : état inconnu, lecture exigée avant tout nouvel envoi.", { detailTechnique: detail });
        }
        throw new ErreurZernio("indisponible", "Zernio ne répond pas pour le moment.", { reessayable: true, detailTechnique: detail });
      }
      journal.info("Zernio : réponse", { requete: libelle, statut: rep.status, dureeMs: maintenant() - debut });

      if (rep.status === 429) {
        const attenteMs = lireRetryAfter(rep.headers.get("retry-after"), maintenant());
        if (essai === 1 && attenteMs <= RETRY_AFTER_MAX_MS) {
          await attendre(attenteMs);
          limiteur.reserver(route); // le rejeu compte comme une requête (pas comme un nouveau post)
          continue;
        }
        throw new ErreurZernio("debit", "Zernio limite les envois pour le moment : réessayer plus tard.", { statut: 429, reessayable: true, attenteMs, detailTechnique: texteErreur(corps) });
      }
      if (rep.status >= 500) {
        journal.alerte("Zernio : erreur serveur", { requete: libelle, statut: rep.status });
        if (ecriture) {
          lectureRequise = true;
          throw new ErreurZernio("a-verifier", "Zernio a répondu en erreur : état inconnu, lecture exigée avant tout nouvel envoi.", { statut: rep.status, detailTechnique: texteErreur(corps) });
        }
        throw new ErreurZernio("indisponible", "Zernio est indisponible pour le moment.", { statut: rep.status, reessayable: true, detailTechnique: texteErreur(corps) });
      }
      if (rep.status === 409) {
        const c = estObjet(corps) ? corps : {};
        const details = estObjet(c.details) ? c.details : {};
        if (c.code === "idempotency_conflict" || details.code === "idempotency_conflict") {
          throw new ErreurZernio("conflit-idempotence", "Le même envoi est encore en cours chez Zernio : attendre, ne rien renvoyer.", {
            statut: 409,
            reessayable: true,
            attenteMs: lireRetryAfter(rep.headers.get("retry-after"), maintenant()),
            detailTechnique: texteErreur(corps),
          });
        }
        const existant = details.existingPostId ?? c.existingPostId;
        throw new ErreurZernio("doublon", "Contenu identique déjà envoyé à ce compte dans les dernières 24 h.", {
          statut: 409,
          existingPostId: typeof existant === "string" ? existant : undefined,
          detailTechnique: texteErreur(corps),
        });
      }
      if (rep.status === 401 || rep.status === 403) throw new ErreurZernio("acces", "Zernio refuse l'accès : vérifier la clé dans Connexions.", { statut: rep.status, detailTechnique: texteErreur(corps) });
      if (rep.status === 404) throw new ErreurZernio("introuvable", "Élément introuvable chez Zernio.", { statut: 404, detailTechnique: texteErreur(corps) });
      if (rep.status >= 400 || rep.status < 200 || rep.status >= 300) {
        throw new ErreurZernio("refuse", "Zernio a refusé la demande.", { statut: rep.status, detailTechnique: texteErreur(corps) });
      }
      if (route === "lire-post" || route === "lister-posts") lectureRequise = false;
      return { statut: rep.status, corps: corps as T, route };
    }
  }

  function exigerObjet(corps: unknown, quoi: string): Record<string, unknown> {
    if (!estObjet(corps)) throw new ErreurZernio("reponse-invalide", `Réponse Zernio illisible (${quoi}).`);
    return corps;
  }

  function lirePostDe(corps: unknown): PostZernio {
    const c = exigerObjet(corps, "post");
    const post = estObjet(c.post) ? c.post : c;
    if (typeof post._id !== "string" || typeof post.status !== "string" || !Array.isArray(post.platforms)) {
      throw new ErreurZernio("reponse-invalide", "Réponse Zernio illisible (post sans identifiant, statut ou plateformes).");
    }
    return post as PostZernio;
  }

  const segment = (id: string) => {
    if (!new RegExp(`^${SEGMENT_ID}$`).test(id)) throw refus("Identifiant illisible.");
    return id;
  };

  const client: ClientZernio = {
    requete,

    lectureExigee: () => lectureRequise,

    async listerComptes() {
      const { corps } = await requete({ methode: "GET", chemin: "/v1/accounts" });
      const comptes = exigerObjet(corps, "comptes").accounts;
      if (!Array.isArray(comptes)) throw new ErreurZernio("reponse-invalide", "Réponse Zernio illisible (comptes).");
      limiteur.definirNombreComptes(comptes.length);
      return comptes as CompteZernio[];
    },

    async pagesFacebook(accountId) {
      const { corps } = await requete({ methode: "GET", chemin: `/v1/accounts/${segment(accountId)}/facebook-page` });
      const pages = exigerObjet(corps, "pages").pages;
      return Array.isArray(pages) ? (pages as PageFacebookZernio[]) : [];
    },

    async organisationsLinkedin(accountId) {
      const { corps } = await requete({ methode: "GET", chemin: `/v1/accounts/${segment(accountId)}/linkedin-organizations` });
      const orgs = exigerObjet(corps, "organisations").organizations;
      return Array.isArray(orgs) ? (orgs as OrganisationLinkedinZernio[]) : [];
    },

    async infoCreateurTiktok(accountId) {
      const { corps } = await requete({ methode: "GET", chemin: `/v1/accounts/${segment(accountId)}/tiktok/creator-info` });
      return exigerObjet(corps, "créateur TikTok");
    },

    async limitePublicationInstagram(accountId) {
      const { corps } = await requete({ methode: "GET", chemin: `/v1/accounts/${segment(accountId)}/instagram/publishing-limit` });
      return exigerObjet(corps, "limite Instagram");
    },

    async preparerTeleversement(d) {
      const corpsDemande: Record<string, unknown> = { filename: d.filename, contentType: d.contentType };
      if (d.size !== undefined) corpsDemande.size = d.size;
      const { corps } = await requete({ methode: "POST", chemin: "/v1/media/presign", corps: corpsDemande });
      const c = exigerObjet(corps, "presign");
      if (typeof c.uploadUrl !== "string" || typeof c.publicUrl !== "string") throw new ErreurZernio("reponse-invalide", "Réponse Zernio illisible (presign).");
      let url: URL;
      try {
        url = new URL(c.uploadUrl);
      } catch {
        throw new ErreurZernio("reponse-invalide", "Adresse de téléversement illisible.");
      }
      if (url.protocol !== "https:") throw new ErreurZernio("reponse-invalide", "Adresse de téléversement non https : refusée.");
      hotesTeleversement.add(url.host);
      return c as unknown as TeleversementPrepareZernio;
    },

    async televerser(d) {
      await requete({ methode: "PUT", urlTeleversement: d.uploadUrl, corps: d.corps, contentType: d.contentType, contentLength: d.contentLength });
    },

    async creerPost(corps, idempotence) {
      const rep = await requete({ methode: "POST", chemin: "/v1/posts", corps, idempotence });
      const post = lirePostDe(rep.corps);
      const echecs = post.platforms
        .filter((p) => STATUTS_ECHEC.has(String(p.status ?? "").toLowerCase()))
        .map((p) => ({ platform: p.platform, errorMessage: p.errorMessage && propre(p.errorMessage), errorCategory: categorieSure(p.errorCategory) }));
      const issue: IssueCreationZernio = echecs.length === 0 ? "ok" : echecs.length === post.platforms.length ? "echec" : "partiel";
      if (issue !== "ok") journal.alerte("Zernio : création incomplète", { statut: rep.statut, issue, plateformes: echecs.map((e) => e.platform) });
      return { statut: rep.statut, post, issue, echecs, rejeu: rep.statut === 200 };
    },

    async lirePost(postId) {
      const { corps } = await requete({ methode: "GET", chemin: `/v1/posts/${segment(postId)}` });
      return lirePostDe(corps);
    },

    async listerPosts(query) {
      const { corps } = await requete({ methode: "GET", chemin: "/v1/posts", query });
      const posts = exigerObjet(corps, "posts").posts;
      return Array.isArray(posts) ? (posts as PostZernio[]) : [];
    },

    async promouvoir(d) {
      return promouvoir(d);
    },

    async analytics(query) {
      const { corps } = await requete({ methode: "GET", chemin: "/v1/analytics", query });
      return corps;
    },
  };

  /** D5 complète : GET avant → (médias) → PUT { isDraft: false, scheduledFor } → GET après. */
  async function promouvoir(d: DemandePromotionZernio): Promise<ResultatPromotionZernio> {
    if (!(await envoiAutorise())) {
      throw new ErreurZernio("envoi-coupe", "Envoi vers Zernio coupé (réglage zernio.envoi_autorise) : promotion refusée, rien n'a été envoyé.");
    }
    const scheduledFor = dateALaSeconde(d.dateJournal);
    if (!scheduledFor) return { etat: "refuse", raison: "Date du journal illisible : ISO à la seconde avec Z attendue." };
    const tropProche = () => Date.parse(scheduledFor) < maintenant() + PROMOTION_MARGE_MIN_MS;
    if (tropProche()) return { etat: "a-reprogrammer", raison: "Date passée ou à moins de 30 min : à reprogrammer par vous." };

    // GET avant.
    const avant = await client.lirePost(d.postId);
    if (avant.status !== "draft") return { etat: "refuse", raison: `Le post n'est plus un brouillon (statut ${avant.status}).` };
    const origine = avant.metadata?.origine;
    if (typeof origine !== "string" || !(ORIGINES_PROMOUVABLES as readonly string[]).includes(origine)) {
      return { etat: "refuse", raison: "Post sans origine Studio ou import Buffer : il n'est pas à nous." };
    }
    if (avant.metadata?.studioCle !== d.cleJournal) return { etat: "refuse", raison: "La clé du post ne correspond pas à celle du journal." };
    const mots = motsInterditsDuCorps(avant);
    if (mots.length > 0) return { etat: "refuse", raison: `Mot interdit dans le post relu (${[...new Set(mots.map((m) => m.chemin))].join(", ")}).` };

    // Médias de plus de 6 jours : nouveau téléversement puis remplacement (seconde forme, même garde).
    let mediasRemplaces = false;
    if (d.medias) {
      const televerseLe = Date.parse(d.medias.televerseLe);
      if (!Number.isFinite(televerseLe)) return { etat: "refuse", raison: "Date de téléversement des médias illisible." };
      if (maintenant() - televerseLe > MEDIA_AGE_MAX_MS) {
        const items = await d.medias.reteleverser();
        try {
          await requeteInterne({ methode: "PUT", chemin: `/v1/posts/${segment(d.postId)}`, corps: { mediaItems: items } }, true);
        } catch (e) {
          if (estErreurZernio(e) && e.code === "a-verifier") return aVerifier("PUT de remplacement des médias sans réponse sûre.");
          throw e;
        }
        mediasRemplaces = true;
      }
    }

    // Date revérifiée au moment même du PUT.
    if (tropProche()) return { etat: "a-reprogrammer", raison: "Date passée ou à moins de 30 min : à reprogrammer par vous." };
    try {
      await requeteInterne({ methode: "PUT", chemin: `/v1/posts/${segment(d.postId)}`, corps: { isDraft: false, scheduledFor } }, true);
    } catch (e) {
      if (estErreurZernio(e) && e.code === "a-verifier") return aVerifier("PUT de promotion sans réponse sûre.");
      throw e;
    }

    // GET après : seul juge (un 200 au PUT peut laisser le brouillon brouillon).
    let apres: PostZernio;
    try {
      apres = await client.lirePost(d.postId);
    } catch {
      return aVerifier("Relecture après promotion impossible.");
    }
    const memeDate = typeof apres.scheduledFor === "string" && Date.parse(apres.scheduledFor) === Date.parse(scheduledFor);
    if (apres.status !== "scheduled" || !memeDate) {
      return aVerifier(`Après promotion : statut ${apres.status}, date ${memeDate ? "identique" : "différente"}.`, apres);
    }
    journal.info("Zernio : post programmé", { mediasRemplaces });
    return { etat: "programme", post: apres, mediasRemplaces };

    function aVerifier(raison: string, post?: PostZernio): ResultatPromotionZernio {
      journal.alerte("Zernio : promotion à vérifier (aucun nouvel essai automatique)", { raison });
      return { etat: "a-verifier", raison, post };
    }
  }

  return client;
}
