// Empreinte des personnes (HMAC-SHA256 avec secret du studio) : module PUR, aucun réseau, aucun journal.
// Jamais d'identifiant brut, de secret ni d'empreinte dans un message d'erreur.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const VARIABLE_SECRET_EMPREINTE = "STUDIO_EMPREINTE_SECRET";
/** Jusqu'à 3 anciens secrets, séparés par des virgules (lecture seule : sert à reconnaître, jamais à écrire). */
export const VARIABLE_SECRETS_ANCIENS = "STUDIO_EMPREINTE_SECRET_ANCIEN";
const AUTRES_SECRETS = ["SITE_GUIDES_RESEAU_SECRET", "SITE_VIDEOS_SECRET", "ZERNIO_WEBHOOK_SECRET"] as const;
const LONGUEUR_MINI = 32;
const MAX_ANCIENS = 3;
const LONGUEUR_ID_MAX = 256; // au-delà : condensé SHA-256

export type EspacePersonne = "instagram" | "facebook" | "zernio-contact" | "evenement" | "zernio-conversation";
export interface CleEmpreinte {
  kid: string;
  secret: Buffer;
}
export type EtatCles =
  | { ok: true; courante: CleEmpreinte; anciennes: CleEmpreinte[] }
  | { ok: false; raison: "absent" | "trop_court" | "identique_autre_secret" | "virgule" | "trop_d_anciens" | "kid_en_double" };

export class ErreurEmpreinteIndisponible extends Error {
  constructor(message = "Empreinte des personnes indisponible : secret absent ou non couvert.") {
    super(message);
    this.name = "ErreurEmpreinteIndisponible";
  }
}
export class ErreurIdentifiantInvalide extends Error {
  constructor() {
    super("Identifiant de personne invalide (vide).");
    this.name = "ErreurIdentifiantInvalide";
  }
}

const hmac = (secret: Buffer, texte: string): string => createHmac("sha256", secret).update(texte, "utf8").digest("hex");
const cle = (brut: string): CleEmpreinte => {
  const secret = Buffer.from(brut, "utf8");
  return { kid: hmac(secret, "studio/empreinte/kid").slice(0, 8), secret };
};

export function lireClesEmpreinte(env: Record<string, string | undefined>): EtatCles {
  const courant = (env[VARIABLE_SECRET_EMPREINTE] ?? "").trim();
  if (!courant) return { ok: false, raison: "absent" };
  // La virgule sépare les anciens secrets : un secret courant qui en contient une ne pourrait jamais être relu une fois devenu ancien.
  if (courant.includes(",")) return { ok: false, raison: "virgule" };
  const anciens = (env[VARIABLE_SECRETS_ANCIENS] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (anciens.length > MAX_ANCIENS) return { ok: false, raison: "trop_d_anciens" }; // jamais tronqué en silence
  const autres = AUTRES_SECRETS.map((n) => (env[n] ?? "").trim()).filter(Boolean);
  const tous = [courant, ...anciens];
  if (tous.some((s) => s.length < LONGUEUR_MINI)) return { ok: false, raison: "trop_court" };
  if (tous.some((s, i) => autres.includes(s) || tous.indexOf(s) !== i)) return { ok: false, raison: "identique_autre_secret" };
  const courante = cle(courant);
  const anciennes = anciens.map(cle);
  const kids = [courante, ...anciennes].map((k) => k.kid);
  if (new Set(kids).size !== kids.length) return { ok: false, raison: "kid_en_double" };
  return { ok: true, courante, anciennes };
}

/**
 * Normalise (NFC) : l'UTF-8 est accepté, un identifiant n'est JAMAIS refusé pour son contenu (un STOP ne doit jamais être perdu).
 * Un identifiant trop long est condensé (SHA-256) sous une étiquette distincte : aucune collision possible avec un identifiant court.
 */
function formeId(idBrut: string, espace: EspacePersonne): string {
  if (typeof idBrut !== "string" || idBrut.length === 0) throw new ErreurIdentifiantInvalide();
  const id = idBrut.normalize("NFC");
  if (id.length <= LONGUEUR_ID_MAX) return `studio/personne/v1\0${espace}\0${id}`;
  return `studio/personne/v1-long\0${espace}\0${createHash("sha256").update(id, "utf8").digest("hex")}`;
}

/** « p1.<kid>.<64 hex> » */
export function empreintePersonne(c: CleEmpreinte, espace: EspacePersonne, idBrut: string): string {
  return `p1.${c.kid}.${hmac(c.secret, formeId(idBrut, espace))}`;
}

/** HÉRITÉE, LECTURE SEULE : ancien SHA-256 tronqué à 32 hex (voir empreinteContact). On n'écrit plus jamais sous cette forme. */
export const empreinteHeritee = (idBrut: string): string => createHash("sha256").update(idBrut, "utf8").digest("hex").slice(0, 32);

/** Formes à reconnaître, la courante en premier, puis les anciennes, puis l'héritée. */
export function candidatsEmpreinte(cles: Extract<EtatCles, { ok: true }>, espace: EspacePersonne, idBrut: string): string[] {
  return [empreintePersonne(cles.courante, espace, idBrut), ...cles.anciennes.map((c) => empreintePersonne(c, espace, idBrut)), empreinteHeritee(idBrut)];
}

export function egalEnTempsConstant(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  if (x.length !== y.length) {
    timingSafeEqual(x, x);
    return false;
  }
  return timingSafeEqual(x, y);
}

/** Parcourt TOUT, sans sortie anticipée. */
export function contientEnTempsConstant(liste: readonly string[], candidats: readonly string[]): boolean {
  let trouve = false;
  for (const l of liste) for (const c of candidats) if (egalEnTempsConstant(l, c)) trouve = true;
  return trouve;
}

/**
 * Clé d'idempotence opaque : 64 hex, forme acceptée par RE_CLE_IDEMPOTENCE. Chaque morceau est préfixé par sa longueur (octets) :
 * aucun découpage ambigu, même avec \0. À calculer UNE fois à l'enregistrement de l'événement puis à STOCKER : elle dépend du
 * secret courant, donc ne jamais la recalculer après une rotation.
 */
export function cleIdempotenceOpaque(c: CleEmpreinte, domaine: "guide" | "opposition", ...parties: string[]): string {
  const morceaux = [domaine, ...parties].map((p) => `${Buffer.byteLength(p, "utf8")}:${p}`).join("");
  return hmac(c.secret, `studio/idem/v2\0${morceaux}`);
}
