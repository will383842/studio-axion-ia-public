// Parcours « mot → e-mail → guide » : crochet Zernio, PUR (aucun réseau, aucune base, aucun secret en dur).
import { createHmac, timingSafeEqual } from "node:crypto";
import { ACCORDS_ENTREE, RE_MOT_GUIDE } from "./cle-idempotence";

export const ENTETE_SIGNATURE_ZERNIO = "x-zernio-signature";
export const ENTETE_HORODATAGE_ZERNIO = "x-zernio-timestamp";
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
export function signatureZernio(secret: string, horodatage: string, corps: string): string {
  return createHmac("sha256", secret).update(`${horodatage}.${corps}`, "utf8").digest("hex");
}

export type VerdictSignature = "ok" | "invalide" | "perimee";

/** Vérifie la signature à temps constant, puis la fenêtre. `maintenantMs` : injectable. */
export function verifierSignatureZernio(e: { secret: string; corps: string; horodatage: string | null; signature: string | null; maintenantMs: number }): VerdictSignature {
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
export function lireEvenementRun(corps: string): EvenementRun | null {
  let j: unknown;
  try {
    j = JSON.parse(corps);
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
  locale?: string;
}

/** Corps figé de l'appel au site : ordre des clés FIXE, donc mêmes octets à chaque reconstruction. */
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
    locale: run.locale ?? "fr",
  });
}

export function runValide(r: unknown): r is RunLu {
  if (!r || typeof r !== "object") return false;
  const o = r as Record<string, unknown>;
  return (
    typeof o.email === "string" && o.email.length > 0 && o.email.length <= 254 &&
    typeof o.mot === "string" && RE_MOT_GUIDE.test(o.mot) &&
    (RESEAUX_GUIDE as readonly string[]).includes(String(o.reseau)) &&
    (ACCORDS_ENTREE as readonly string[]).includes(String(o.accord)) &&
    typeof o.guide === "string" && o.guide.length > 0 && o.guide.length <= 80 &&
    typeof o.versionTexteM1 === "string" && o.versionTexteM1.length > 0 && o.versionTexteM1.length <= 40
  );
}

/* --- Réponse du site → conduite -------------------------------------------------------------------------------- */

/** Attente avant de réessayer un 409 `en_cours` : nettement au-delà de 2 minutes. */
export const ATTENTE_EN_COURS_MS = 5 * 60_000;
/** Attentes successives après une panne (429, 5xx, site injoignable, nonce réutilisé). */
export const ATTENTES_PANNE_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000] as const;
export const ESSAIS_MAX = ATTENTES_PANNE_MS.length + 1;

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
