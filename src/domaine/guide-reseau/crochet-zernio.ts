// Parcours « mot → e-mail → guide » : crochet Zernio, PUR (aucun réseau, aucune base, aucun secret en dur).
import { createHmac, timingSafeEqual } from "node:crypto";
import { RE_MOT_GUIDE } from "./cle-idempotence";
import { estMotOpposition } from "./opposition";

/** Miroir du site (`src/content/guides-reseau.ts` : GUIDES_RESEAU_CONNUS). Liste FERMÉE ; à garder alignée sur le site. */
export const GUIDES_RESEAU_CONNUS: readonly string[] = ["guide-ia"];
/** Miroir du site (`contrat.ts`) : `^[a-z0-9-]{2,40}$`. */
export const RE_GUIDE = /^[a-z0-9-]{2,40}$/;
/** Miroir du site (`contrat.ts`) : forme d'une version de texte (M1, M2). */
export const RE_VERSION_TEXTE = /^[A-Za-z0-9._-]{3,64}$/;
const RE_DATE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/*
 * FORMAT RÉEL des webhooks Zernio (documentation publique : docs.zernio.com/webhooks et /webhooks/automations ; COR-PV2-T2).
 *   · En-têtes : `X-Zernio-Signature`, `X-Zernio-Event`, `X-Zernio-Event-Id` ; alias hérités `X-Late-Signature` et
 *     `X-Late-Event-Id` acceptés. AUCUN en-tête d'horodatage.
 *   · Signature : HMAC-SHA256, hexadécimal minuscule, du CORPS BRUT SEUL (pas d'horodatage devant), vérifiée AVANT tout JSON.parse.
 *   · Charge à la racine : `{ id, event, timestamp, ... }`. L'identifiant du run est `execution.id`.
 *   · Anti-rejeu : champ `timestamp` du CORPS (72 h dans le passé, 5 min dans le futur) + déduplication PERPÉTUELLE de l'`id` du corps
 *     (champ signé). L'en-tête `X-Zernio-Event-Id` n'est pas signé : il doit seulement être ÉGAL à l'`id` du corps.
 * Ce qui reste à capturer à l'essai réel : docs/zernio/parcours-viral/05-ESSAI-REEL-WEBHOOK.md. `PARCOURS_MOT_ENABLED` reste éteint.
 */
export const ENTETE_SIGNATURE_ZERNIO = "x-zernio-signature";
export const ENTETE_SIGNATURE_HERITEE = "x-late-signature";
export const ENTETE_EVENEMENT_ZERNIO = "x-zernio-event";
export const ENTETE_ID_EVENEMENT_ZERNIO = "x-zernio-event-id";
export const ENTETE_ID_EVENEMENT_HERITE = "x-late-event-id";
/**
 * Fenêtre anti-rejeu sur le champ `timestamp` du corps. Zernio réessaie 7 fois sur ~2 jours avec le MÊME id : le passé doit donc
 * tolérer au moins 72 h, sinon les réessais légitimes seraient refusés. Une fenêtre aussi large ne protège pas du rejeu à elle
 * seule : la vraie défense est la déduplication perpétuelle de l'`id` signé (un id déjà vu n'est jamais redéposé, quel que soit
 * son âge). La fenêtre sert à écarter les horodatages absurdes ; le futur reste serré (5 min, dérive d'horloge seulement).
 */
export const FENETRE_REJEU_PASSE_SEC = 72 * 3600;
export const FENETRE_REJEU_FUTUR_SEC = 300;
/** Taille maximale d'un crochet, en octets. */
export const TAILLE_MAX_CROCHET = 16 * 1024;
/** Événements qui ont un effet. Tous les autres (dont `webhook.test`, `message.sent`, `comment.received`, `workflow.run.failed`) : accusé 200 sans effet. */
export const TYPES_EVENEMENT_ACCEPTES = ["workflow.run.completed"] as const;
/** Événements SANS CONTENU (identifiants opaques seulement ; jamais le texte d'un commentaire ou d'un message). */
export const TYPE_EVENEMENT_COMMENTAIRE = "comment.received";
export const TYPE_EVENEMENT_MESSAGE = "message.received";

export const RESEAUX_GUIDE = ["instagram", "facebook", "linkedin_page", "tiktok", "page_guide"] as const;

const RE_SIGNATURE = /^[0-9a-f]{64}$/;
const RE_ID = /^[A-Za-z0-9._:-]{1,200}$/;
const RE_ID_RUN = /^[^\u0000-\u001f]{1,200}$/;

/** HMAC-SHA256 hexadécimal minuscule du CORPS BRUT SEUL (octet pour octet). */
export function signatureZernio(secret: string, corps: string | Buffer): string {
  return createHmac("sha256", secret).update(typeof corps === "string" ? Buffer.from(corps, "utf8") : corps).digest("hex");
}

export type VerdictSignature = "ok" | "invalide";

/** Vérifie la signature à temps constant (hex minuscule, 64 caractères). Ne lit jamais le JSON. */
export function verifierSignatureZernio(e: { secret: string; corps: string | Buffer; signature: string | null }): VerdictSignature {
  const brute = e.signature?.trim() ?? "";
  if (!RE_SIGNATURE.test(brute)) return "invalide";
  const attendue = Buffer.from(signatureZernio(e.secret, e.corps));
  const recue = Buffer.from(brute);
  // Longueurs publiques (64 hex) ; la comparaison du contenu est à temps constant.
  return attendue.length === recue.length && timingSafeEqual(attendue, recue) ? "ok" : "invalide";
}

/** Fenêtre anti-rejeu sur l'instant du CORPS (secondes Unix) : 72 h dans le passé, 5 min dans le futur. */
export function dansFenetreRejeu(timestampSec: number, maintenantMs: number): boolean {
  const ecart = Math.floor(maintenantMs / 1000) - timestampSec; // > 0 : passé
  return ecart <= FENETRE_REJEU_PASSE_SEC && ecart >= -FENETRE_REJEU_FUTUR_SEC;
}

/** `timestamp` du corps : texte ISO 8601 ou nombre (secondes, ou millisecondes si > 1e11). Retour en secondes, ou null. */
function secondesDe(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.floor(v > 1e11 ? v / 1000 : v);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const t = Date.parse(v);
    return Number.isFinite(t) ? Math.floor(t / 1000) : null;
  }
  return null;
}

/** Enveloppe commune, lue APRÈS vérification de la signature. `null` = charge inconnue (422). */
export interface EnveloppeZernio {
  id: string;
  event: string;
  timestampSec: number;
  racine: Record<string, unknown>;
}
export function lireEnveloppe(corps: string | Buffer): EnveloppeZernio | null {
  let j: unknown;
  try {
    j = JSON.parse(typeof corps === "string" ? corps : corps.toString("utf8"));
  } catch {
    return null;
  }
  if (!j || typeof j !== "object" || Array.isArray(j)) return null;
  const o = j as Record<string, unknown>;
  const t = secondesDe(o.timestamp);
  if (typeof o.id !== "string" || !RE_ID.test(o.id) || typeof o.event !== "string" || o.event.length < 1 || o.event.length > 100 || t === null) return null;
  return { id: o.id, event: o.event, timestampSec: t, racine: o };
}

export interface EvenementRun {
  type: (typeof TYPES_EVENEMENT_ACCEPTES)[number];
  /** `execution.id` : identifiant du run. */
  idRun: string;
  /** `contact.id` (opaque) et `trigger.text` SEULEMENT si mot seul ou opposition (sinon null) : jamais d'adresse e-mail. */
  idContact: string | null;
  motDeclencheur: string | null;
}

const objet = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const texteBorne = (v: unknown, max: number): string | null => (typeof v === "string" && v.length >= 1 && v.length <= max && !/[\u0000-\u001f]/.test(v) ? v : null);

/**
 * Lit un `workflow.run.completed` : `execution.id` + `execution.status` (`completed` ou `exited`). Retourne `null` si l'événement
 * n'est pas de ce type (accusé sans effet) ou si la charge est incomplète (le service distingue les deux avec `lireEnveloppe`).
 */
export function lireEvenementRun(env: EnveloppeZernio): EvenementRun | null {
  if (env.event !== "workflow.run.completed") return null;
  const ex = objet(env.racine.execution);
  const idRun = ex && typeof ex.id === "string" && RE_ID_RUN.test(ex.id) ? ex.id : null;
  if (!ex || !idRun || (ex.status !== "completed" && ex.status !== "exited")) return null;
  const contact = objet(env.racine.contact);
  const trigger = objet(env.racine.trigger);
  return { type: "workflow.run.completed", idRun, idContact: idOpaque(contact?.id), motDeclencheur: motSeulDe(trigger?.text) };
}

/** Miroir des mots de déclenchement configurés (liste FERMÉE, à garder alignée sur les guides du site). Pas de mot libre. */
export const MOTS_DECLENCHEURS_CONNUS: readonly string[] = ["GUIDE"];
/** Un mot composé uniquement de chiffres (ex. un numéro de téléphone) n'est jamais un mot de déclenchement. */
const RE_SEULEMENT_CHIFFRES = /^\d+$/;
/** Le mot seul si c'est un mot configuré (jamais uniquement des chiffres) ou un mot d'opposition ; tout autre texte (adresse, téléphone…) → null. */
export function motSeulDe(v: unknown, motsConnus: readonly string[] = MOTS_DECLENCHEURS_CONNUS): string | null {
  const t = texteBorne(v, 200);
  if (t === null) return null;
  const maj = t.trim().toUpperCase();
  if (RE_SEULEMENT_CHIFFRES.test(maj)) return null;
  return motsConnus.includes(maj) || estMotOpposition(t) ? t.trim() : null;
}

export interface EvenementCommentaire {
  idCommentaire: string;
  idPostPlateforme: string | null;
  idCompte: string;
  reseau: "instagram" | "facebook";
  idAuteur: string | null;
  /** Vrai si l'auteur est NOTRE compte (`author.isOwnAccount` du corps réel, ou ancienne garde par identifiant). Rien n'est à traiter. */
  proprio: boolean;
  /** Texte normalisé SEULEMENT s'il est un mot seul ou une opposition ; sinon null. Jamais le texte brut. */
  motSeul: string | null;
  estReponse: boolean;
}
export interface EvenementMessage {
  idMessage: string;
  /** `message.platformMessageId` : le mid de la plateforme, identique à l'`id` de la liste des messages (appariement sûr). Opaque, borné, facultatif. */
  idPlateforme?: string;
  idConversation: string | null;
  idCompte: string;
  idExpediteur: string | null;
  /** Vrai si le message est sortant / de notre compte (direction, isOwnAccount) : écho à ne pas traiter. Absent sinon. */
  sortant?: true;
  /** Charge d'un bouton (identifiant opaque sans espace ni « @ »), sinon null. Jamais `message.text`. */
  postback: string | null;
  /** Instant du message (ISO 8601 normalisé), seulement s'il est lisible et borné (2020 à 2100) ; sinon absent. */
  occurredAt?: string;
}
/** Horodatage ISO borné : lisible, entre 2020 et 2100, sinon `undefined`. Jamais de texte libre. */
function dateBornee(v: unknown): string | undefined {
  if (typeof v !== "string" || v.length > 40 || !RE_DATE_ISO.test(v)) return undefined;
  const t = Date.parse(v);
  return Number.isFinite(t) && t >= Date.UTC(2020, 0, 1) && t < Date.UTC(2100, 0, 1) ? new Date(t).toISOString() : undefined;
}
const idOpaque = (v: unknown): string | null => (typeof v === "string" && RE_ID.test(v) ? v : null);
const idCompteDe = (racine: Record<string, unknown>): string | null => {
  const a = objet(racine.account);
  return idOpaque(a?.accountId) ?? idOpaque(a?.id);
};

/**
 * Lit un `comment.received` SANS CONTENU. Les champs exacts restent à confirmer à l'essai réel (05-ESSAI-REEL-WEBHOOK.md) : la lecture
 * est tolérante sur les noms d'identifiants, stricte sur le contenu (comment.text n'est jamais conservé tel quel).
 */
export function lireEvenementCommentaire(env: EnveloppeZernio, motsConnus: readonly string[] = MOTS_DECLENCHEURS_CONNUS): EvenementCommentaire | null {
  if (env.event !== TYPE_EVENEMENT_COMMENTAIRE) return null;
  const c = objet(env.racine.comment);
  const compte = objet(env.racine.account);
  const idCommentaire = idOpaque(c?.id);
  const idCompte = idCompteDe(env.racine);
  const plateforme = String(compte?.platform ?? c?.platform ?? "").toLowerCase();
  if (!c || !idCommentaire || !idCompte || (plateforme !== "instagram" && plateforme !== "facebook")) return null;
  const auteur = objet(c.author) ?? objet(c.from);
  const idAuteur = idOpaque(auteur?.id) ?? idOpaque(c.authorId);
  const proprio = auteur?.isOwnAccount === true;
  const propre = proprio || auteur?.isSelf === true || c.isOwn === true || (idAuteur !== null && (idAuteur === idCompte || idAuteur === idOpaque(compte?.platformAccountId)));
  const texte = typeof c.text === "string" ? c.text : null;
  const motSeul = texte !== null && texte.length <= 200 ? motSeulDe(texte, motsConnus)?.toUpperCase() ?? null : null;
  const estReponse = c.isReply === true || (c.parentId !== undefined && c.parentId !== null && c.parentId !== "");
  return {
    idCommentaire,
    idPostPlateforme: idOpaque(c.platformPostId) ?? idOpaque(objet(env.racine.post)?.platformPostId) ?? idOpaque(c.postId),
    idCompte,
    reseau: plateforme as "instagram" | "facebook",
    // Notre propre réponse publique : on la marque en vidant l'auteur ET le mot (rien à traiter).
    idAuteur: propre ? idCompte : idAuteur,
    proprio: propre,
    motSeul: propre ? null : motSeul,
    estReponse,
  };
}

/** Lit un `message.received` SANS CONTENU : identifiants et charge de bouton opaque seulement ; `message.text` n'est jamais lu. */
export function lireEvenementMessage(env: EnveloppeZernio): EvenementMessage | null {
  if (env.event !== TYPE_EVENEMENT_MESSAGE) return null;
  const m = objet(env.racine.message);
  const idMessage = idOpaque(m?.id);
  const idCompte = idCompteDe(env.racine);
  if (!m || !idMessage || !idCompte) return null;
  const p = m.postback;
  const brut = typeof p === "string" ? p : objet(p)?.payload;
  const compte = objet(env.racine.account);
  const idExpediteur = idOpaque(objet(m.sender)?.id) ?? idOpaque(m.senderId);
  // Écho de NOS propres messages : on vide le postback et on marque l'expéditeur = compte (rien à traiter).
  const sens = typeof m.direction === "string" ? m.direction.toLowerCase() : "";
  const sortant = sens === "outgoing" || sens === "outbound" || objet(m.sender)?.isOwnAccount === true || m.isOwnAccount === true;
  const propre = sortant || objet(m.sender)?.isSelf === true || m.isSelf === true || m.isOwn === true || (idExpediteur !== null && (idExpediteur === idCompte || idExpediteur === idOpaque(compte?.platformAccountId)));
  return {
    idMessage,
    ...(idOpaque(m.platformMessageId) ? { idPlateforme: idOpaque(m.platformMessageId)! } : {}),
    idConversation: idOpaque(m.conversationId),
    idCompte,
    idExpediteur: propre ? idCompte : idExpediteur,
    ...(sortant ? { sortant: true as const } : {}),
    postback: propre ? null : idOpaque(brut),
    ...(dateBornee(m.createdAt ?? m.timestamp ?? m.sentAt) ? { occurredAt: dateBornee(m.createdAt ?? m.timestamp ?? m.sentAt) } : {}),
  };
}

/** Ce que Zernio consigne dans un run, relu chez Zernio (jamais pris dans le crochet). Transit seulement : jamais stocké ici. */
export interface RunLu {
  email: string;
  mot: string;
  reseau: (typeof RESEAUX_GUIDE)[number];
  guide: string;
  /** Version du texte du premier message privé (registre de preuve), ex. « mp-m1-v2 ». */
  versionTexteM1: string;
  locale?: string;
  /** Moment de la réponse (ISO 8601), optionnel. */
  occurredAt?: string;
  /** Origine complète (v3), facultative : lue seulement si le drapeau d'origine est allumé. Jamais de pseudo ni de texte. */
  origine?: import("./origine-v3").OrigineBrute;
}

/**
 * Corps figé de l'appel au site : ordre des clés FIXE, donc mêmes octets à chaque reconstruction.
 * Une clé absente (`undefined`) n'est pas écrite, mais les autres gardent leur place relative.
 * Plus de champ « accord » ni de version de question d'accord (décision du 03/11/2026) : même un run relu qui en porte encore un
 * (ancien parcours) ne les envoie pas ; le site accepte leur absence.
 * ⚠️ Le corps est RECONSTRUIT à chaque passage à partir du run relu : ne relire que des runs CLOS. Si Zernio modifie le
 * run entre deux passages, les octets changent et le site répond 409 `cle_reutilisee` (définitif).
 */
export function corpsDemandeGuide(run: RunLu, cleIdempotence: string): string {
  return JSON.stringify({
    schemaVersion: 1,
    cleIdempotence,
    email: run.email,
    mot: run.mot.toUpperCase(),
    reseau: run.reseau,
    guide: run.guide,
    versionTexteM1: run.versionTexteM1,
    locale: run.locale ?? "fr",
    occurredAt: run.occurredAt,
  });
}

/** Aligné sur le schéma strict du site (`SchemaDemandeGuideReseau`) pour refuser localement ce que le site refuserait en 422. */
export function runValide(r: unknown, motsConnus?: readonly string[]): r is RunLu {
  if (!r || typeof r !== "object") return false;
  const o = r as Record<string, unknown>;
  const locale = o.locale;
  return (
    typeof o.email === "string" && o.email.length > 0 && o.email.length <= 254 &&
    typeof o.mot === "string" && RE_MOT_GUIDE.test(o.mot) && (motsConnus === undefined || motsConnus.includes(o.mot.toUpperCase())) &&
    (RESEAUX_GUIDE as readonly string[]).includes(String(o.reseau)) &&
    typeof o.guide === "string" && RE_GUIDE.test(o.guide) && GUIDES_RESEAU_CONNUS.includes(o.guide) &&
    typeof o.versionTexteM1 === "string" && RE_VERSION_TEXTE.test(o.versionTexteM1) &&
    (locale === undefined || locale === "fr" || locale === "en") &&
    (o.occurredAt === undefined || (typeof o.occurredAt === "string" && RE_DATE_ISO.test(o.occurredAt) && Number.isFinite(Date.parse(o.occurredAt))))
  );
}

/* --- Réponse du site → conduite -------------------------------------------------------------------------------- */

/** Attente avant de réessayer un 409 `en_cours` : nettement au-delà de 2 minutes. */
export const ATTENTE_EN_COURS_MS = 5 * 60_000;
/** Attentes successives après une panne (429, 5xx, site injoignable, nonce réutilisé). */
export const ATTENTES_PANNE_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000] as const;
/** Essais MAX (pannes seulement : les 409 `en_cours` ne comptent pas). */
export const ESSAIS_MAX = ATTENTES_PANNE_MS.length + 1;
/** Nombre maximal d'attentes `en_cours` (hors ESSAIS_MAX) avant abandon : 12 × 5 min = 1 h. */
export const EN_COURS_MAX = 12;
/** `run_introuvable` : le run peut ne pas être encore lisible chez Zernio quand le webhook arrive. Réessai court, borné. */
export const ATTENTES_INTROUVABLE_MS = [30_000, 2 * 60_000, 10 * 60_000] as const;
/** Plafonds par passage : lot (événements traités) et débit (appels sortants par heure glissante). */
export const LOT_MAX_PAR_PASSAGE = 20;
export const DEBIT_MAX_PAR_HEURE = 120;
/** Disjoncteur simple : N pannes consécutives (réseau, 429, 5xx, 401) ouvrent le circuit pour une durée. */
export const DISJONCTEUR_SEUIL = 5;
export const DISJONCTEUR_PAUSE_MS = 10 * 60_000;

export type Conduite =
  | { genre: "termine" }
  | { genre: "reessayer"; apresMs: number; code: string; nouveauNonce?: boolean }
  | { genre: "definitif"; code: string };

/** `statut` 0 = site injoignable. `essai` = numéro de l'essai qui vient d'échouer (1 pour le premier). */
export function conduiteApresReponse(statut: number, corps: unknown, essai: number): Conduite {
  const erreur = corps && typeof corps === "object" && typeof (corps as Record<string, unknown>).erreur === "string" ? ((corps as Record<string, unknown>).erreur as string) : "";
  if (statut === 200) return { genre: "termine" };
  if (statut === 409 && erreur === "en_cours") return { genre: "reessayer", apresMs: ATTENTE_EN_COURS_MS, code: "409_en_cours" };
  if (statut === 409 && erreur === "nonce_reutilise") return { genre: "reessayer", apresMs: 0, code: "409_nonce_reutilise", nouveauNonce: true };
  if (statut === 409) return { genre: "definitif", code: erreur === "cle_reutilisee" ? "409_cle_reutilisee" : "409" };
  if ([400, 401, 413, 415, 422].includes(statut)) return { genre: "definitif", code: String(statut) };
  if (statut === 0 || statut === 429 || statut >= 500) {
    return { genre: "reessayer", apresMs: ATTENTES_PANNE_MS[Math.min(essai - 1, ATTENTES_PANNE_MS.length - 1)], code: statut === 0 ? "injoignable" : String(statut) };
  }
  return { genre: "definitif", code: String(statut) };
}
