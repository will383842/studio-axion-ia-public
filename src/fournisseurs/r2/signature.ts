/**
 * Signature AWS « Signature V4 » par adresse (query string), compatible S3 et Cloudflare R2.
 * Fonction PURE (aucun réseau) : testée hors ligne contre l'exemple officiel de la documentation S3.
 * R2 : région « auto », service « s3 », adresses de style chemin `https://{compte}.r2.cloudflarestorage.com/{seau}/{clé}`.
 */
import { createHash, createHmac } from "node:crypto";

export interface IdentifiantsS3 {
  cleAcces: string;
  secret: string;
  region: string;
}

export interface DemandeSignature {
  methode: "GET" | "PUT" | "POST" | "HEAD" | "DELETE";
  /** Hôte seul, sans protocole (`compte.r2.cloudflarestorage.com`). */
  hote: string;
  /** Chemin NON encodé, commençant par « / » (`/seau/studio/prod/…`). */
  chemin: string;
  /** Durée de validité en secondes (1 à 604 800). */
  expireSec: number;
  /** Paramètres propres à l'opération (`uploads`, `partNumber`, `uploadId`…). Valeur vide : paramètre sans valeur. */
  parametres?: Record<string, string>;
  /** Instant de signature (défaut : maintenant). */
  date?: Date;
}

/** Encodage RFC 3986 exigé par la signature V4 (plus strict qu'`encodeURIComponent`). */
export function encoderRfc3986(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** Chemin canonique : chaque segment encodé, les « / » gardés. */
export function cheminCanonique(chemin: string): string {
  return chemin.split("/").map(encoderRfc3986).join("/");
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function hmac(cle: Buffer | string, s: string): Buffer {
  return createHmac("sha256", cle).update(s, "utf8").digest();
}

/** `20130524T000000Z` */
export function dateAmz(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Adresse signée complète (`https://…?X-Amz-Signature=…`). */
export function signerAdresse(identifiants: IdentifiantsS3, demande: DemandeSignature): string {
  const date = demande.date ?? new Date();
  const amz = dateAmz(date);
  const jour = amz.slice(0, 8);
  const portee = `${jour}/${identifiants.region}/s3/aws4_request`;
  const expire = Math.max(1, Math.min(604_800, Math.round(demande.expireSec)));
  const parametres: Record<string, string> = {
    ...(demande.parametres ?? {}),
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${identifiants.cleAcces}/${portee}`,
    "X-Amz-Date": amz,
    "X-Amz-Expires": String(expire),
    "X-Amz-SignedHeaders": "host",
  };
  const requete = Object.keys(parametres)
    .sort()
    .map((k) => `${encoderRfc3986(k)}=${encoderRfc3986(parametres[k])}`)
    .join("&");
  const chemin = cheminCanonique(demande.chemin);
  const canonique = [demande.methode, chemin, requete, `host:${demande.hote}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const aSigner = ["AWS4-HMAC-SHA256", amz, portee, sha256Hex(canonique)].join("\n");
  const cleSignature = hmac(hmac(hmac(hmac(`AWS4${identifiants.secret}`, jour), identifiants.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", cleSignature).update(aSigner, "utf8").digest("hex");
  return `https://${demande.hote}${chemin}?${requete}&X-Amz-Signature=${signature}`;
}
