/**
 * Jeton du relais vidéo pour Buffer (/api/media-buffer/<jeton>/video.mp4).
 * Charge {fichierId, exp} signée en HMAC-SHA256, le tout en base64url : « <charge>.<signature> ».
 * La clé de signature est DÉRIVÉE du secret de session avec un libellé fixe : le secret brut ne signe jamais ce jeton, et un jeton de
 * session ne peut pas être confondu avec lui. Pas de dépendance aux dépôts : fonctions pures, testables.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Libellé de dérivation de la clé (changer ce texte invalide tous les jetons déjà donnés à Buffer). */
export const LIBELLE_CLE_MEDIA_BUFFER = "buffer-media-v1";

/** Durée de vie d'un jeton : 30 jours. Buffer relit la vidéo jusqu'à la publication ; un jeton fuité cesse de servir ensuite. */
export const DUREE_JETON_MEDIA_BUFFER_SEC = 30 * 24 * 3600;

function cleDerivee(env: { SESSION_SECRET?: string }): Buffer {
  const secret = env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET absent ou trop court (32 caractères au moins).");
  return createHmac("sha256", secret).update(LIBELLE_CLE_MEDIA_BUFFER).digest();
}

function signer(charge: string, env: { SESSION_SECRET?: string }): string {
  return createHmac("sha256", cleDerivee(env)).update(charge).digest("base64url");
}

/** Jeton pour ce fichier, valable `DUREE_JETON_MEDIA_BUFFER_SEC` à partir de `maintenantMs`. */
export function creerJetonMediaBuffer(fichierId: string, maintenantMs: number = Date.now(), env: { SESSION_SECRET?: string } = process.env): string {
  const exp = Math.floor(maintenantMs / 1000) + DUREE_JETON_MEDIA_BUFFER_SEC;
  const charge = Buffer.from(JSON.stringify({ fichierId, exp })).toString("base64url");
  return `${charge}.${signer(charge, env)}`;
}

/** L'identifiant du fichier si le jeton est authentique et non expiré ; sinon null (aucune raison donnée : falsifié, expiré, illisible = même résultat). */
export function verifierJetonMediaBuffer(jeton: string, maintenantMs: number = Date.now(), env: { SESSION_SECRET?: string } = process.env): string | null {
  try {
    const morceaux = jeton.split(".");
    if (morceaux.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(morceaux[0]) || !/^[A-Za-z0-9_-]+$/.test(morceaux[1])) return null;
    const [charge, signature] = morceaux;
    const attendue = Buffer.from(signer(charge, env));
    const recue = Buffer.from(signature);
    if (attendue.length !== recue.length || !timingSafeEqual(attendue, recue)) return null;
    const contenu: unknown = JSON.parse(Buffer.from(charge, "base64url").toString("utf8"));
    if (typeof contenu !== "object" || contenu === null) return null;
    const { fichierId, exp } = contenu as { fichierId?: unknown; exp?: unknown };
    if (typeof fichierId !== "string" || !fichierId || typeof exp !== "number" || !Number.isFinite(exp)) return null;
    if (exp * 1000 <= maintenantMs) return null;
    return fichierId;
  } catch {
    return null;
  }
}
