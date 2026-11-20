import "server-only";
/**
 * RAP-3 · Miniature d'une publication rapatriée. Le navigateur ne lit jamais l'adresse du diffuseur (la CSP `img-src` reste inchangée :
 * le site et R2 seulement) : il demande `/api/calendrier/miniature/<id>` et c'est le SERVEUR qui lit l'image, sans identifiant, sans suivre
 * de redirection, avec un délai et un poids bornés, et seulement si c'est une vraie image (pas de SVG). Lecture seule, aucune écriture.
 */
import { request as requeteHttps } from "node:https";
import { lookup as lookupDns, type LookupOptions } from "node:dns";
import { Readable } from "node:stream";
import { resoudreDns, ipNonPublique, type Resoudre } from "@/fournisseurs/heygen/telechargement";
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
  const h = u.hostname.toLowerCase().replace(/\.+$/, ""); // « localhost. » et « x.internal. » désignent les mêmes hôtes
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

/** Toutes les adresses du nom doivent être publiques (boucle locale, privée, lien local, IPv6 locale, métadonnées : refusées). La connexion refait cette vérification sur l'adresse réellement utilisée (`creerLookupSur`). */
async function hotePublic(adresse: string, resoudre: Resoudre): Promise<boolean> {
  const hote = new URL(adresse).hostname.toLowerCase().replace(/\.+$/, "");
  const ips = await resoudre(hote);
  return ips.length > 0 && ips.every((ip) => !ipNonPublique(ip));
}

type LookupBrut = (hote: string, options: LookupOptions, rappel: (err: NodeJS.ErrnoException | null, a?: unknown, f?: number) => void) => void;
type AdresseLue = { address: string; family: number };

/**
 * Résolution FAITE PAR LA CONNEXION elle-même : l'adresse vérifiée est celle qui sert à se connecter (plus de fenêtre entre la
 * vérification et la connexion). Une seule adresse non publique suffit au refus. Le nom reste celui du certificat (TLS).
 */
export function creerLookupSur(brut: LookupBrut = lookupDns as never) {
  return (hote: string, options: LookupOptions, rappel: (err: Error | null, a?: unknown, f?: number) => void): void => {
    brut(hote, { ...options, all: true }, (err, liste) => {
      const adresses = (liste ?? []) as AdresseLue[];
      if (err) return rappel(err);
      if (!adresses.length || adresses.some((a) => ipNonPublique(a.address))) return rappel(new Error("adresse non publique"));
      if (options.all) return rappel(null, adresses);
      return rappel(null, adresses[0].address, adresses[0].family);
    });
  };
}

/** `fetch` restreint à ce besoin : https, GET, sans redirection suivie, connexion à l'adresse vérifiée à l'instant de la connexion. */
export const fetchMiniatureSur: typeof fetch = (entree, init) =>
  new Promise<Response>((ok, ko) => {
    const u = new URL(String(entree));
    const req = requeteHttps(u, { method: "GET", agent: false, headers: init?.headers as Record<string, string>, lookup: creerLookupSur() as never, signal: init?.signal ?? undefined }, (res) => {
      const entetes = new Headers();
      for (const [k, v] of Object.entries(res.headers)) if (typeof v === "string") entetes.set(k, v);
      const sansCorps = res.statusCode === 204 || res.statusCode === 304;
      ok(new Response(sansCorps ? null : (Readable.toWeb(res) as ReadableStream<Uint8Array>), { status: res.statusCode ?? 502, headers: entetes }));
    });
    req.on("error", ko);
    req.end();
  });

/** Cache mémoire BORNÉ (aucune dépendance) : 100 entrées, 30 Mo, 1 h ; éviction de la plus ancienne. Clé = publication + adresse. */
const CACHE_MAX_ENTREES = 100;
const CACHE_MAX_OCTETS = 30_000_000;
const CACHE_DUREE_MS = 3_600_000;
const CACHE_REFUS_MS = 5 * 60_000; // un refus de sécurité n'est gardé que quelques minutes
interface EntreeCache {
  valeur: MiniatureLue | null;
  expire: number;
  taille: number;
}
const cache = new Map<string, EntreeCache>();
let octetsCache = 0;

export function viderCacheMiniatures(): void {
  cache.clear();
  octetsCache = 0;
}
export const tailleCacheMiniatures = () => ({ entrees: cache.size, octets: octetsCache });

function oterDuCache(cle: string): void {
  const e = cache.get(cle);
  if (e) {
    octetsCache -= e.taille;
    cache.delete(cle);
  }
}
function garder(cle: string, valeur: MiniatureLue | null, expire: number): void {
  const taille = valeur?.octets.byteLength ?? 0;
  if (taille > CACHE_MAX_OCTETS) return;
  oterDuCache(cle);
  cache.set(cle, { valeur, expire, taille });
  octetsCache += taille;
  while (cache.size > CACHE_MAX_ENTREES || octetsCache > CACHE_MAX_OCTETS) {
    const plusAncienne = cache.keys().next().value;
    if (plusAncienne === undefined) break;
    oterDuCache(plusAncienne);
  }
}

/** L'image de la publication rapatriée, ou `null` (jamais d'erreur levée : l'écran montre alors une carte texte). */
export async function lireMiniatureDiffuseur(publicationId: string, deps: { fetch?: typeof fetch; resoudre?: Resoudre; maintenant?: () => number } = {}): Promise<MiniatureLue | null> {
  try {
    const p = await depots().publications.obtenir(publicationId);
    const adresse = p && estRapatriee(p) && !p.retireeLe ? p.mediaDiffuseur?.miniature : undefined;
    if (!adresse) return null;
    const instant = (deps.maintenant ?? Date.now)();
    const cle = `${publicationId}|${adresse}`;
    const deja = cache.get(cle);
    if (deja && deja.expire > instant) return deja.valeur;
    if (deja) oterDuCache(cle);
    const refus = () => {
      garder(cle, null, instant + CACHE_REFUS_MS);
      return null;
    };
    if (!adresseMiniatureSure(adresse)) return refus();
    if (!(await hotePublic(adresse, deps.resoudre ?? resoudreDns))) return refus();
    const r = await (deps.fetch ?? fetchMiniatureSur)(adresse, { method: "GET", redirect: "manual", credentials: "omit", headers: { Accept: "image/*" }, signal: AbortSignal.timeout(DELAI_MS) });
    const type = (r.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (r.status !== 200 || !TYPES_IMAGE.has(type)) return null;
    const octets = await lireBorne(r);
    if (!octets || octets.byteLength === 0) return null;
    const lue = { octets, type };
    garder(cle, lue, instant + CACHE_DUREE_MS);
    return lue;
  } catch {
    return null;
  }
}
