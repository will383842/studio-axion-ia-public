/**
 * TÉLÉCHARGEMENT SÛR D'UNE VIDÉO HEYGEN (lot R7, corrections de la relecture sécurité `3042b94`, n° 1 et 2).
 *
 * L'adresse de téléchargement est relue côté serveur chez HeyGen (`GET /v3/videos/{id}`) ; elle reste néanmoins un
 * contenu EXTERNE. Avant le moindre octet lu :
 *  - n° 1 (SSRF) : `https` seulement, port 443, aucun identifiant dans l'adresse, hôte de la LISTE BLANCHE
 *    (`HOTES_TELECHARGEMENT_HEYGEN`), jamais une adresse IP écrite en clair, et chaque adresse IP renvoyée par le DNS
 *    doit être publique (ni privée, ni boucle locale, ni lien local) ; les redirections ne sont PAS suivies
 *    automatiquement (`redirect: "manual"`) : chaque saut est revalidé de la même façon, `SAUTS_MAX` au plus ;
 *  - n° 2 (taille) : la réponse doit annoncer sa taille (`content-length`), au plus le plafond
 *    (`HEYGEN_VIDEO_MAX_MO`, défaut 2 048 Mo) ; sinon refus SANS lire le corps. Le corps est relayé en flux vers le
 *    stockage en comptant les octets réellement passés : au-delà de la taille annoncée, la copie s'arrête. Jamais
 *    `arrayBuffer()` sur ce contenu.
 * Limite connue : entre la vérification DNS et la connexion, un DNS hostile pourrait répondre autrement (« rebinding ») ;
 * la liste blanche d'hôtes HeyGen reste la garde principale.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ErreurHeygen } from "./client";

/**
 * HÔTES AUTORISÉS pour télécharger une vidéo HeyGen (le nom lui-même ou l'un de ses sous-domaines), en https.
 * D'après la documentation et les exemples de HeyGen relus le 03/10/2026 : les fichiers sont servis depuis des
 * sous-domaines de `heygen.ai` (ex. `files2.heygen.ai`, `resource2.heygen.ai`) et de `heygen.com`.
 * À COMPLÉTER au premier essai réel : si une vidéo est refusée pour « adresse inattendue », le journal du serveur
 * donne l'hôte exact ; l'ajouter ICI (un nom précis plutôt qu'un domaine entier de CDN partagé, jamais un joker
 * comme `cloudfront.net` ou `amazonaws.com` en entier).
 */
export const HOTES_TELECHARGEMENT_HEYGEN: readonly string[] = [
  "heygen.ai",
  "heygen.com",
];

/** Nombre de redirections suivies au plus (chacune revalidée). */
export const SAUTS_MAX = 3;

/** Plafond par défaut d'une vidéo HeyGen téléchargée (Mo). */
export const PLAFOND_VIDEO_HEYGEN_MO = 2048;

/** Plafond en octets, lu dans `HEYGEN_VIDEO_MAX_MO` (entier positif) ; sinon 2 048 Mo. */
export function plafondVideoHeygen(env: Record<string, string | undefined> = process.env): number {
  const mo = Number(env.HEYGEN_VIDEO_MAX_MO?.trim());
  return (Number.isInteger(mo) && mo > 0 ? mo : PLAFOND_VIDEO_HEYGEN_MO) * 1024 * 1024;
}

/** Résolution DNS : toutes les adresses d'un nom (tests : doublée, jamais de vrai DNS). */
export type Resoudre = (hote: string) => Promise<string[]>;

export const resoudreDns: Resoudre = async (hote) => (await lookup(hote, { all: true, verbatim: true })).map((a) => a.address);

const refus = (message: string) => new ErreurHeygen({ code: "refuse", reessayable: false, message });
const REFUS_ADRESSE = "Cette vidéo HeyGen vient d'une adresse inattendue : elle n'est pas téléchargée.";

/** Hôte de la liste blanche (le nom exact ou un sous-domaine). PUR, testé. */
export function hoteAutorise(hote: string, liste: readonly string[] = HOTES_TELECHARGEMENT_HEYGEN): boolean {
  const h = hote.toLowerCase().replace(/\.$/, "");
  return liste.some((x) => h === x || h.endsWith(`.${x}`));
}

function octetsIpv4(ip: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  return m ? m.slice(1).map(Number) : null;
}

/**
 * Adresse IP NON publique : privée, boucle locale, lien local, partagée (CGNAT), multidiffusion, réservée, non
 * spécifiée — en IPv4 comme en IPv6 (y compris IPv4 transposée en IPv6). PUR, testé. Illisible : non publique.
 */
export function ipNonPublique(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const o = octetsIpv4(ip);
    if (!o) return true;
    const [a, b] = o;
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0 && o[2] === 0) || (a === 198 && (b === 18 || b === 19));
  }
  if (v === 6) {
    const x = ip.toLowerCase().replace(/^\[|\]$/g, "");
    const transposee = /^(?:0*:)*:?ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x) ?? /^::(\d+\.\d+\.\d+\.\d+)$/.exec(x);
    if (transposee) return ipNonPublique(transposee[1]);
    if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(x)) return true; // IPv4 transposée écrite en hexadécimal : refusée.
    if (x === "::" || x === "::1") return true;
    const premier = parseInt(x.split(":")[0] || "0", 16);
    // fc00::/7 (privées), fe80::/10 (lien local), ff00::/8 (multidiffusion), 2001:db8::/32 (documentation).
    return (premier & 0xfe00) === 0xfc00 || (premier & 0xffc0) === 0xfe80 || (premier & 0xff00) === 0xff00 || x.startsWith("2001:db8:");
  }
  return true;
}

/**
 * Valide UNE adresse de téléchargement (le départ, puis chaque redirection) : https, port 443, sans identifiants,
 * nom d'hôte (jamais une IP écrite en clair) de la liste blanche, et toutes ses adresses DNS publiques.
 */
export async function verifierAdresseHeygen(adresse: string, resoudre: Resoudre = resoudreDns, liste: readonly string[] = HOTES_TELECHARGEMENT_HEYGEN): Promise<URL> {
  let u: URL;
  try {
    u = new URL(adresse);
  } catch {
    throw refus(REFUS_ADRESSE);
  }
  const hote = u.hostname.replace(/^\[|\]$/g, "");
  if (u.protocol !== "https:" || (u.port && u.port !== "443") || u.username || u.password) throw refus(REFUS_ADRESSE);
  if (isIP(hote) || octetsIpv4(hote) || hote.includes(":")) throw refus(REFUS_ADRESSE);
  if (!hoteAutorise(hote, liste)) {
    console.warn(`[heygen] téléchargement refusé : hôte hors liste « ${hote} » (à ajouter à HOTES_TELECHARGEMENT_HEYGEN s'il est bien celui de HeyGen).`);
    throw refus(REFUS_ADRESSE);
  }
  let ips: string[];
  try {
    ips = await resoudre(hote);
  } catch {
    throw new ErreurHeygen({ code: "indisponible", reessayable: true, message: "La vidéo HeyGen n'a pas pu être lue. Réessayez dans un instant." });
  }
  if (!ips.length || ips.some(ipNonPublique)) throw refus(REFUS_ADRESSE);
  return u;
}

export interface OptionsCopie {
  appeler?: typeof fetch;
  resoudre?: Resoudre;
  /** Taille maximale acceptée (octets). Défaut : `plafondVideoHeygen()`. */
  plafond?: number;
  liste?: readonly string[];
}

const ilnaPasPuEtreLue = () => new ErreurHeygen({ code: "indisponible", reessayable: true, message: "La vidéo HeyGen n'a pas pu être lue. Réessayez dans un instant." });

/** Ouvre la vidéo à télécharger : chaque saut est revalidé AVANT d'être appelé ; le corps n'est pas encore lu. */
async function ouvrir(source: string, o: Required<Pick<OptionsCopie, "appeler" | "resoudre" | "liste">>): Promise<Response> {
  let adresse = source;
  for (let saut = 0; saut <= SAUTS_MAX; saut++) {
    const u = await verifierAdresseHeygen(adresse, o.resoudre, o.liste);
    let r: Response;
    try {
      r = await o.appeler(u.href, { redirect: "manual", signal: AbortSignal.timeout(10 * 60_000) });
    } catch {
      throw ilnaPasPuEtreLue();
    }
    if (r.status < 300 || r.status >= 400) return r;
    const suivante = r.headers.get("location");
    await r.body?.cancel().catch(() => undefined);
    if (!suivante) throw ilnaPasPuEtreLue();
    try {
      adresse = new URL(suivante, u).href;
    } catch {
      throw refus(REFUS_ADRESSE);
    }
  }
  throw refus(REFUS_ADRESSE);
}

/**
 * Copie une vidéo HeyGen vers une adresse de dépôt signée du stockage, EN FLUX, avec toutes les gardes ci-dessus.
 * Renvoie le nombre d'octets réellement relayés (égal à la taille annoncée).
 */
export async function copierEnFlux(source: string, depot: string, mime: string, options: OptionsCopie = {}): Promise<number> {
  const appeler = options.appeler ?? fetch;
  const plafond = options.plafond ?? plafondVideoHeygen();
  const r = await ouvrir(source, { appeler, resoudre: options.resoudre ?? resoudreDns, liste: options.liste ?? HOTES_TELECHARGEMENT_HEYGEN });
  const annule = () => r.body?.cancel().catch(() => undefined);
  if (r.status === 403 || r.status === 404) {
    await annule();
    throw new ErreurHeygen({ code: "fichier-inaccessible", reessayable: true, message: "Le lien de la vidéo HeyGen a expiré : réessayez." });
  }
  if (!r.ok || !r.body) {
    await annule();
    throw ilnaPasPuEtreLue();
  }
  const brut = r.headers.get("content-length");
  const taille = brut && /^\d+$/.test(brut.trim()) ? Number(brut) : NaN;
  if (!Number.isSafeInteger(taille) || taille <= 0) {
    await annule();
    throw refus("HeyGen n'annonce pas la taille de cette vidéo : elle n'est pas téléchargée.");
  }
  if (taille > plafond) {
    await annule();
    throw refus(`Cette vidéo HeyGen est trop lourde (plus de ${Math.round(plafond / (1024 * 1024))} Mo) : elle n'est pas téléchargée.`);
  }
  // Compteur : chaque octet relayé est compté ; au-delà de la taille annoncée, la copie s'arrête.
  let relayes = 0;
  const compteur = new TransformStream<Uint8Array, Uint8Array>({
    transform(morceau, controleur) {
      relayes += morceau.byteLength;
      if (relayes > taille) controleur.error(refus("Cette vidéo HeyGen est plus lourde qu'annoncé : elle n'est pas gardée."));
      else controleur.enqueue(morceau);
    },
  });
  let d: Response;
  try {
    d = await appeler(depot, { method: "PUT", headers: { "content-type": mime, "content-length": String(taille) }, body: r.body.pipeThrough(compteur) as unknown as BodyInit, signal: AbortSignal.timeout(10 * 60_000), ...({ duplex: "half" } as object) });
  } catch (e) {
    if (e instanceof ErreurHeygen) throw e;
    if (relayes > taille) throw refus("Cette vidéo HeyGen est plus lourde qu'annoncé : elle n'est pas gardée.");
    throw new ErreurHeygen({ code: "indisponible", reessayable: true, message: "La vidéo n'a pas pu être gardée. Réessayez dans un instant." });
  }
  if (!d.ok) throw new ErreurHeygen({ code: "indisponible", reessayable: true, message: "La vidéo n'a pas pu être gardée. Réessayez dans un instant." });
  if (relayes !== taille) throw new ErreurHeygen({ code: "indisponible", reessayable: true, message: "La vidéo HeyGen est arrivée incomplète : réessayez." });
  return relayes;
}
