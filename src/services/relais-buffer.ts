/**
 * Relais public de la vidéo pour Buffer. Buffer vérifie l'adresse par un HEAD avant de la prendre ; une adresse R2 signée
 * n'est valable que pour GET (SigV4 inclut la méthode) → HEAD 403 → « Video could not be read from its URL ».
 * Le relais répond lui-même à HEAD et à GET (avec Range) et lit le fichier dans R2 avec une adresse signée GET gardée en interne.
 * Joignable SANS session, mais UNIQUEMENT avec un jeton valide (src/lib/jeton-media-buffer.ts). Flux direct : rien n'est écrit sur disque.
 */
import "server-only";
import { estCleDemo } from "@/domaine/miniatures";
import { creerJetonMediaBuffer, verifierJetonMediaBuffer } from "@/lib/jeton-media-buffer";
import { depots, ErreurStudio, fournisseur } from "./_commun";

/** Nom de fichier terminant l'adresse donnée à Buffer (elle finit par .mp4). */
export const NOM_VIDEO_RELAIS = "video.mp4";
/** Même adresse par défaut que les e-mails de secours (STUDIO_ADRESSE, variable déjà existante). */
const ADRESSE_PAR_DEFAUT = "https://studio.axion-ia.com";
/** Limite de débit par jeton : au plus 600 requêtes par minute (en mémoire du processus, sans infrastructure). */
export const LIMITE_REQUETES_PAR_MINUTE = 600;
const FENETRE_MS = 60_000;
const DELAI_ENTETES_R2_MS = 30_000;
const ENTETES_COMMUNS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" } as const;

/** Adresse publique du Studio (https), sans barre finale. */
export function adressePubliqueStudio(env: Record<string, string | undefined> = process.env): string {
  return (env.STUDIO_ADRESSE?.trim() || ADRESSE_PAR_DEFAUT).replace(/\/+$/, "");
}

/** Adresse donnée à Buffer pour ce fichier : https://<studio>/api/media-buffer/<jeton>/video.mp4 */
export function adresseRelaisBuffer(fichierId: string): string {
  const url = `${adressePubliqueStudio()}/api/media-buffer/${creerJetonMediaBuffer(fichierId)}/${NOM_VIDEO_RELAIS}`;
  if (!/^https:\/\//.test(url)) throw new ErreurStudio("FICHIER_HORS_LIGNE", "L'adresse publique du Studio n'est pas en https : Buffer ne pourrait pas lire la vidéo.");
  return url;
}

const appels = new Map<string, number[]>();

/** Vrai si ce jeton dépasse la limite (appelé seulement après vérification du jeton : pas de croissance par des jetons faux). */
function tropDeRequetes(jeton: string, maintenantMs: number): boolean {
  const recents = (appels.get(jeton) ?? []).filter((t) => t > maintenantMs - FENETRE_MS);
  recents.push(maintenantMs);
  appels.set(jeton, recents);
  if (appels.size > 1000) for (const [k, v] of appels) if (!v.some((t) => t > maintenantMs - FENETRE_MS)) appels.delete(k);
  return recents.length > LIMITE_REQUETES_PAR_MINUTE;
}

/** Remet les compteurs à zéro (tests seulement). */
export function reinitialiserLimitePourEssai(): void {
  appels.clear();
}

function introuvable(): Response {
  return new Response("Introuvable.", { status: 404, headers: { ...ENTETES_COMMUNS, "Content-Type": "text/plain; charset=utf-8" } });
}

function indisponible(): Response {
  return new Response("Fichier momentanément indisponible.", { status: 502, headers: { ...ENTETES_COMMUNS, "Content-Type": "text/plain; charset=utf-8" } });
}

/** Une seule plage « bytes=a-b » est relayée ; tout autre en-tête Range est ignoré (fichier entier). */
function plageValable(range: string | null): string | null {
  return range && /^bytes=(\d+-\d*|-\d+)$/.test(range) ? range : null;
}

export async function servirRelaisBuffer(methode: "GET" | "HEAD", jeton: string, nom: string, range: string | null, signalClient?: AbortSignal, maintenantMs: number = Date.now()): Promise<Response> {
  const fichierId = nom === NOM_VIDEO_RELAIS ? verifierJetonMediaBuffer(jeton, maintenantMs) : null;
  if (!fichierId) return introuvable();
  if (tropDeRequetes(jeton, maintenantMs)) return new Response("Trop de requêtes.", { status: 429, headers: { ...ENTETES_COMMUNS, "Retry-After": "60", "Content-Type": "text/plain; charset=utf-8" } });

  const fichier = await depots().fichiers.obtenir(fichierId);
  // Même garde que l'envoi : un fichier de démonstration ne sort jamais.
  if (!fichier || !fichier.cleStockage || estCleDemo(fichier.cleStockage)) return introuvable();

  if (methode === "HEAD") {
    return new Response(null, { status: 200, headers: { ...ENTETES_COMMUNS, "Content-Type": "video/mp4", "Content-Length": String(fichier.taille), "Accept-Ranges": "bytes" } });
  }

  try {
    const stockage = await fournisseur("stockage");
    const signee = stockage.urlLectureDuree ? await stockage.urlLectureDuree(fichier.cleStockage, 300) : "";
    if (!/^https:\/\//.test(signee)) return indisponible();
    const plage = plageValable(range);
    const controle = new AbortController();
    const delai = setTimeout(() => controle.abort(), DELAI_ENTETES_R2_MS);
    signalClient?.addEventListener("abort", () => controle.abort(), { once: true });
    let r: Response;
    try {
      r = await fetch(signee, { headers: { "accept-encoding": "identity", ...(plage ? { range: plage } : {}) }, signal: controle.signal, cache: "no-store" });
    } finally {
      clearTimeout(delai);
    }
    if (r.status === 416) {
      await r.body?.cancel().catch(() => undefined);
      return new Response(null, { status: 416, headers: { ...ENTETES_COMMUNS, "Content-Range": r.headers.get("content-range") ?? `bytes */${fichier.taille}` } });
    }
    if ((r.status !== 200 && r.status !== 206) || !r.body) {
      await r.body?.cancel().catch(() => undefined);
      console.error(`[relais-buffer] stockage : réponse ${r.status}`);
      return indisponible();
    }
    const entetes: Record<string, string> = { ...ENTETES_COMMUNS, "Content-Type": "video/mp4", "Accept-Ranges": "bytes" };
    const longueur = r.headers.get("content-length");
    if (longueur) entetes["Content-Length"] = longueur;
    const contenu = r.headers.get("content-range");
    if (r.status === 206 && contenu) entetes["Content-Range"] = contenu;
    return new Response(r.body, { status: r.status === 206 && contenu ? 206 : 200, headers: entetes });
  } catch {
    console.error("[relais-buffer] stockage injoignable");
    return indisponible();
  }
}
