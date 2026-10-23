/**
 * CHIFFREMENT DES JETONS (lot E2, import Google Drive) : AES-256-GCM, côté serveur seulement. Le jeton Google n'est
 * jamais gardé en clair en base ni envoyé au navigateur.
 * Clé : `GOOGLE_DRIVE_CLE` (32 caractères au moins) si elle existe, sinon dérivée de `SESSION_SECRET` (HKDF, usage
 * « google-drive ») : changer l'une ou l'autre oblige simplement à reconnecter le Drive.
 */
import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const VERSION = "v1";

function cle(env: Record<string, string | undefined>): Buffer {
  const propre = env.GOOGLE_DRIVE_CLE?.trim();
  const base = propre && propre.length >= 32 ? propre : env.SESSION_SECRET;
  if (!base || base.length < 32) throw new Error("Clé de chiffrement absente (GOOGLE_DRIVE_CLE ou SESSION_SECRET, 32 caractères au moins).");
  return Buffer.from(hkdfSync("sha256", base, "studio-axion-ia", "google-drive", 32));
}

/** Chiffre un texte : « v1.<iv>.<étiquette>.<chiffré> » en base64url. */
export function chiffrer(texte: string, env: Record<string, string | undefined> = process.env): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cle(env), iv);
  const chiffre = Buffer.concat([c.update(texte, "utf8"), c.final()]);
  return [VERSION, iv.toString("base64url"), c.getAuthTag().toString("base64url"), chiffre.toString("base64url")].join(".");
}

/** Déchiffre ; `null` si le texte a été modifié ou si la clé a changé (jamais d'exception). */
export function dechiffrer(paquet: string, env: Record<string, string | undefined> = process.env): string | null {
  const [v, iv, etiquette, chiffre] = paquet.split(".");
  if (v !== VERSION || !iv || !etiquette || chiffre === undefined) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", cle(env), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(etiquette, "base64url"));
    return Buffer.concat([d.update(Buffer.from(chiffre, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
