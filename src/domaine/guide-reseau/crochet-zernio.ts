// Parcours « mot → e-mail → guide » : crochet Zernio, PUR (aucun réseau, aucune base, aucun secret en dur).
import { createHmac, timingSafeEqual } from "node:crypto";
import { ACCORDS_ENTREE, RE_MOT_GUIDE } from "./cle-idempotence";

/** Miroir du site (`src/content/guides-reseau.ts` : GUIDES_RESEAU_CONNUS). Liste FERMÉE ; à garder alignée sur le site. */
export const GUIDES_RESEAU_CONNUS: readonly string[] = ["guide-ia"];
/** Miroir du site (`contrat.ts`) : `^[a-z0-9-]{2,40}$`. */
export const RE_GUIDE = /^[a-z0-9-]{2,40}$/;
/** Miroir du site (`contrat.ts`) : forme d'une version de texte (M1, M2). */
export const RE_VERSION_TEXTE = /^[A-Za-z0-9._-]{3,64}$/;
const RE_DATE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/*
 * ⚠️ À CONFIRMER PAR UN ESSAI RÉEL (COR-PV2, bloquant 2). Le format de signature des webhooks Zernio n'est documenté
 * NULLE PART dans ce dépôt (l'extrait OpenAPI 1.418.1 ne contient ni « signature » ni « secret »), et la documentation
 * publique n'a pas pu être consultée (hôte hors de la liste réseau autorisée de la session). Sont donc des HYPOTHÈSES :
 *   · les en-têtes `x-zernio-signature` et `x-zernio-timestamp` ;
 *   · le HMAC-SHA256 hexadécimal de `<horodatage>.<corps brut>` ;
 *   · la charge `{ id, event: "run.completed", data: { runId } }`.
 * Procédure d'essai : docs/zernio/parcours-viral/05-ESSAI-REEL-WEBHOOK.md. Tant qu'elle n'est pas faite,
 * `PARCOURS_MOT_ENABLED` DOIT rester éteint.
 */
export const ENTETE_SIGNATURE_ZERNIO = "x-zernio-signature"; // À CONFIRMER PAR UN ESSAI RÉEL
export const ENTETE_HORODATAGE_ZERNIO = "x-zernio-timestamp"; // À CONFIRMER PAR UN ESSAI RÉEL
/** Fenêtre anti-rejeu, en secondes (de part et d'autre de l'heure du serveur). */
export const FENETRE_REJEU_SEC = 300;
/** Taille maximale d'un crochet, en octets. */
export const TAILLE_MAX_CROCHET = 16 * 1024;
/** Seul type d'événement accepté : « un run vient de se terminer ». Tout le reste est refusé (charge inconnue). */
export const TYPES_EVENEMENT_ACCEPTES = ["run.completed"] as const;

export const RESEAUX_GUIDE = ["instagram", "facebook", "linkedin_page", "tiktok", "page_guide"] as const;

const RE_HORODATAGE = /^[0-9]{10}$/;
const RE_SIGNATURE = /^(?:sha256=)?[0-9a-fA-F]{64}$/;
const RE_ID = /^[A-Za-z0-9._:-]{1,200}$/;

/** HMAC-SHA256 hexadécimal de `<horodatage>.<corps brut>` (le corps est signé octet pour octet). */
export function signatureZernio(secret: string, horodatage: string, corps: string | Buffer): string {
  // Calculé sur les OCTETS bruts (jamais sur un texte décodé) ; format À CONFIRMER PAR UN ESSAI RÉEL.
  return createHmac("sha256", secret).update(`${horodatage}.`, "utf8").update(typeof corps === "string" ? Buffer.from(corps, "utf8") : corps).digest("hex");
}

export type VerdictSignature = "ok" | "invalide" | "perimee";

/** Vérifie la signature à temps constant, puis la fenêtre. `maintenantMs` : injectable. */
export function verifierSignatureZernio(e: { secret: string; corps: string | Buffer; horodatage: string | null; signature: string | null; maintenantMs: number }): VerdictSignature {
  if (!e.horodatage || !RE_HORODATAGE.test(e.horodatage) || !e.signature || !RE_SIGNATURE.test(e.signature.trim())) return "invalide";
  const attendue = Buffer.from(signatureZernio(e.secret, e.horodatage, e.corps));
  const recue = Buffer.from(e.signature.trim().replace(/^sha256=/i, "").toLowerCase());
  // Longueurs publiques (64 hex) ; la comparaison du contenu est à temps constant.
  if (attendue.length !== recue.length || !timingSafeEqual(attendue, recue)) return "invalide";
  const ecart = Math.abs(Math.floor(e.maintenantMs / 1000) - Number(e.horodatage));
  return ecart > FENETRE_REJEU_SEC ? "perimee" : "ok";
}

export interface EvenementRun {
  idEvenement: string;
  type: (typeof TYPES_EVENEMENT_ACCEPTES)[number];
  idRun: string;
}

/** Lit la charge : `{ id, event: "run.completed", data: { runId } }`. Rien d'autre n'est gardé (aucune donnée de personne). */
export function lireEvenementRun(corps: string | Buffer): EvenementRun | null {
  let j: unknown;
  try {
    j = JSON.parse(typeof corps === "string" ? corps : corps.toString("utf8"));
  } catch {
    return null;
  }
  if (!j || typeof j !== "object" || Array.isArray(j)) return null;
  const o = j as Record<string, unknown>;
  const data = o.data && typeof o.data === "object" && !Array.isArray(o.data) ? (o.data as Record<string, unknown>) : null;
  if (typeof o.id !== "string" || !RE_ID.test(o.id) || !(TYPES_EVENEMENT_ACCEPTES as readonly string[]).includes(String(o.event)) || !data || typeof data.runId !== "string" || data.runId.length < 1 || data.runId.length > 200 || /[\u0000-\u001f]/.test(data.runId)) return null;
  return { idEvenement: o.id, type: o.event as EvenementRun["type"], idRun: data.runId };
}

/** Ce que Zernio consigne dans un run, relu chez Zernio (jamais pris dans le crochet). Transit seulement : jamais stocké ici. */
export interface RunLu {
  email: string;
  mot: string;
  reseau: (typeof RESEAUX_GUIDE)[number];
  accord: (typeof ACCORDS_ENTREE)[number];
  guide: string;
  versionTexteM1: string;
  /** Version de la question « conseils par e-mail » (M2). OBLIGATOIRE si `accord === "oui"` (refine du site). */
  versionTexteM2?: string;
  locale?: string;
  /** Moment de la réponse (ISO 8601), optionnel. */
  occurredAt?: string;
}

/**
 * Corps figé de l'appel au site : ordre des clés FIXE, donc mêmes octets à chaque reconstruction.
 * Une clé absente (`undefined`) n'est pas écrite, mais les autres gardent leur place relative.
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
    accord: run.accord,
    versionTexteM1: run.versionTexteM1,
    versionTexteM2: run.versionTexteM2,
    locale: run.locale ?? "fr",
    occurredAt: run.occurredAt,
  });
}

/** Aligné sur le schéma strict du site (`SchemaDemandeGuideReseau`) pour refuser localement ce que le site refuserait en 422. */
export function runValide(r: unknown): r is RunLu {
  if (!r || typeof r !== "object") return false;
  const o = r as Record<string, unknown>;
  const m2 = o.versionTexteM2;
  const locale = o.locale;
  return (
    typeof o.email === "string" && o.email.length > 0 && o.email.length <= 254 &&
    typeof o.mot === "string" && RE_MOT_GUIDE.test(o.mot) &&
    (RESEAUX_GUIDE as readonly string[]).includes(String(o.reseau)) &&
    (ACCORDS_ENTREE as readonly string[]).includes(String(o.accord)) &&
    typeof o.guide === "string" && RE_GUIDE.test(o.guide) && GUIDES_RESEAU_CONNUS.includes(o.guide) &&
    typeof o.versionTexteM1 === "string" && RE_VERSION_TEXTE.test(o.versionTexteM1) &&
    (m2 === undefined || (typeof m2 === "string" && RE_VERSION_TEXTE.test(m2))) &&
    (o.accord !== "oui" || m2 !== undefined) &&
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
  | { genre: "termine"; accord: string | null }
  | { genre: "reessayer"; apresMs: number; code: string; nouveauNonce?: boolean }
  | { genre: "definitif"; code: string };

/** `statut` 0 = site injoignable. `essai` = numéro de l'essai qui vient d'échouer (1 pour le premier). */
export function conduiteApresReponse(statut: number, corps: unknown, essai: number): Conduite {
  const erreur = corps && typeof corps === "object" && typeof (corps as Record<string, unknown>).erreur === "string" ? ((corps as Record<string, unknown>).erreur as string) : "";
  if (statut === 200) {
    const a = corps && typeof corps === "object" ? (corps as Record<string, unknown>).accord : undefined;
    return { genre: "termine", accord: typeof a === "string" ? a : null };
  }
  if (statut === 409 && erreur === "en_cours") return { genre: "reessayer", apresMs: ATTENTE_EN_COURS_MS, code: "409_en_cours" };
  if (statut === 409 && erreur === "nonce_reutilise") return { genre: "reessayer", apresMs: 0, code: "409_nonce_reutilise", nouveauNonce: true };
  if (statut === 409) return { genre: "definitif", code: erreur === "cle_reutilisee" ? "409_cle_reutilisee" : "409" };
  if ([400, 401, 413, 415, 422].includes(statut)) return { genre: "definitif", code: String(statut) };
  if (statut === 0 || statut === 429 || statut >= 500) {
    return { genre: "reessayer", apresMs: ATTENTES_PANNE_MS[Math.min(essai - 1, ATTENTES_PANNE_MS.length - 1)], code: statut === 0 ? "injoignable" : String(statut) };
  }
  return { genre: "definitif", code: String(statut) };
}
