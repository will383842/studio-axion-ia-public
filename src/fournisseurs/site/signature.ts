/**
 * Signature des appels studio → site (plan § 7.2). Une seule fonction pour le client et pour le site factice :
 * HMAC-SHA256 hexadécimal de `chaineASigner(...)`, comparaison en temps constant.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { chaineASigner } from "@/domaine/site-videos/contrat";

export const ENTETE_HORODATAGE = "x-axion-horodatage";
export const ENTETE_NONCE = "x-axion-nonce";
export const ENTETE_SIGNATURE = "x-axion-signature";

/** Tolérance de l'horodatage, en secondes. */
export const TOLERANCE_HORODATAGE_SEC = 300;
/** Durée pendant laquelle un nonce déjà vu est refusé, en millisecondes. */
export const MEMOIRE_NONCE_MS = 10 * 60 * 1000;

/** En-têtes d'un appel signé : `x-axion-horodatage`, `x-axion-nonce`, `x-axion-signature`. */
export type EntetesSignes = Record<string, string>;

export const sha256Hex = (texte: string): string => createHash("sha256").update(texte, "utf8").digest("hex");

/** Signature HMAC-SHA256 hexadécimale d'une chaîne (la même que `signatureCrochet`). */
export function hmacHex(secret: string, donnee: string): string {
  return createHmac("sha256", secret).update(donnee, "utf8").digest("hex");
}

/** En-têtes d'un appel : horodatage (secondes Unix), nonce (16 octets hex) et signature. */
export function signerAppel(e: { secret: string; methode: string; chemin: string; corps: string; horodatageSec: number; nonce?: string }): EntetesSignes {
  const horodatage = String(Math.floor(e.horodatageSec));
  const nonce = e.nonce ?? randomBytes(16).toString("hex");
  const signature = hmacHex(e.secret, chaineASigner({ horodatage, nonce, methode: e.methode, chemin: e.chemin, sha256Corps: sha256Hex(e.corps) }));
  return { [ENTETE_HORODATAGE]: horodatage, [ENTETE_NONCE]: nonce, [ENTETE_SIGNATURE]: signature };
}

export function signatureValide(secret: string, e: { methode: string; chemin: string; corps: string; horodatage: string; nonce: string; signature: string }): boolean {
  const attendue = Buffer.from(hmacHex(secret, chaineASigner({ horodatage: e.horodatage, nonce: e.nonce, methode: e.methode, chemin: e.chemin, sha256Corps: sha256Hex(e.corps) })));
  const recue = Buffer.from(e.signature);
  return attendue.length === recue.length && timingSafeEqual(attendue, recue);
}
