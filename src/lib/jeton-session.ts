/**
 * Jeton de session signé (jose HS256). Utilisé par src/proxy.ts ET par les services.
 * Ne dépend d'aucun dépôt : le proxy ne vérifie que la signature et l'expiration ;
 * la révocation est revérifiée côté serveur par exigerSession().
 */
import { jwtVerify, SignJWT } from "jose";

export const NOM_COOKIE_SESSION = "studio_session";
export const DUREE_LONGUE_SEC = 30 * 24 * 3600; // « Rester connecté » : 30 jours
export const DUREE_COURTE_SEC = 12 * 3600; // sinon 12 heures

export interface ContenuJeton {
  jti: string;
  rc: boolean; // rester connecté
  /** Émis le (secondes depuis 1970). */
  iat?: number;
}

function cle(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET absent ou trop court (32 caractères au moins).");
  return new TextEncoder().encode(secret);
}

export async function signerJeton(contenu: ContenuJeton, dureeSec: number): Promise<string> {
  return new SignJWT({ rc: contenu.rc })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(contenu.jti)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + dureeSec)
    .setAudience("studio-axion-ia")
    .sign(cle());
}

export async function verifierJeton(jeton: string | undefined): Promise<ContenuJeton | null> {
  if (!jeton) return null;
  try {
    const { payload } = await jwtVerify(jeton, cle(), { algorithms: ["HS256"], audience: "studio-axion-ia" });
    if (typeof payload.jti !== "string") return null;
    return { jti: payload.jti, rc: payload.rc === true, iat: typeof payload.iat === "number" ? payload.iat : undefined };
  } catch {
    return null;
  }
}
