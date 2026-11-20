import "server-only";
/**
 * RAP-3 · Miniature d'une publication rapatriée. Le navigateur ne lit jamais l'adresse du diffuseur (la CSP `img-src` reste inchangée :
 * le site et R2 seulement) : il demande `/api/calendrier/miniature/<id>` et c'est le SERVEUR qui lit l'image, sans identifiant, sans suivre
 * de redirection, avec un délai et un poids bornés, et seulement si c'est une vraie image (pas de SVG). Lecture seule, aucune écriture.
 */
import { estRapatriee } from "@/domaine/types";
import { depots } from "@/services/_commun";

const DELAI_MS = 5_000;
export const POIDS_MAX_MINIATURE = 5_000_000;
const TYPES_IMAGE = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

/** Adresse https publique : ni identifiants, ni port particulier, ni adresse IP, ni nom interne. */
export function adresseMiniatureSure(adresse: string): boolean {
  let u: URL;
  try {
    u = new URL(adresse);
  } catch {
    return false;
  }
  const h = u.hostname.toLowerCase();
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return false;
  if (h.startsWith("[") || /^\d+(\.\d+){0,3}$/.test(h) || !h.includes(".")) return false;
  return !/(^|\.)(localhost|local|internal|intranet|lan|home|corp)$/.test(h);
}

export interface MiniatureLue {
  octets: Uint8Array;
  type: string;
}

async function lireBorne(r: Response): Promise<Uint8Array | null> {
  const annonce = Number(r.headers.get("content-length") ?? "0");
  if (annonce > POIDS_MAX_MINIATURE || !r.body) return null;
  const morceaux: Uint8Array[] = [];
  let total = 0;
  const lecteur = r.body.getReader();
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.byteLength;
    if (total > POIDS_MAX_MINIATURE) {
      await lecteur.cancel().catch(() => undefined);
      return null;
    }
    morceaux.push(value);
  }
  const sortie = new Uint8Array(total);
  let i = 0;
  for (const m of morceaux) {
    sortie.set(m, i);
    i += m.byteLength;
  }
  return sortie;
}

/** L'image de la publication rapatriée, ou `null` (jamais d'erreur levée : l'écran montre alors une carte texte). */
export async function lireMiniatureDiffuseur(publicationId: string, deps: { fetch?: typeof fetch } = {}): Promise<MiniatureLue | null> {
  try {
    const p = await depots().publications.obtenir(publicationId);
    const adresse = p && estRapatriee(p) && !p.retireeLe ? p.mediaDiffuseur?.miniature : undefined;
    if (!adresse || !adresseMiniatureSure(adresse)) return null;
    const r = await (deps.fetch ?? fetch)(adresse, { method: "GET", redirect: "manual", credentials: "omit", headers: { Accept: "image/*" }, signal: AbortSignal.timeout(DELAI_MS) });
    const type = (r.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (r.status !== 200 || !TYPES_IMAGE.has(type)) return null;
    const octets = await lireBorne(r);
    return octets && octets.byteLength > 0 ? { octets, type } : null;
  } catch {
    return null;
  }
}
