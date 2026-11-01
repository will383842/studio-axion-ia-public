/**
 * TÉLÉVERSEMENT DES MÉDIAS VERS ZERNIO (z1p, D10). Le serveur lit le fichier dans R2 (adresse signée interne) et le
 * pousse EN FLUX vers l'`uploadUrl` rendue par presign, avec Content-Length. L'`uploadUrl` vaut 3 600 s ; le stockage
 * Zernio est temporaire (7 jours) : le client re-téléverse si besoin (voir `MEDIA_AGE_MAX_MS`).
 */
import type { ClientZernio, CorpsBinaire, MediaItemZernio } from "./zernio-client";
import { ErreurZernio } from "./zernio-erreurs";

/** Lecteur du fichier source : adresse https signée → flux, taille, type. Injectable (tests : faux flux). */
export type LecteurMedia = (adresse: string) => Promise<{ corps: CorpsBinaire; taille: number; contentType?: string }>;

const TYPES_PAR_EXTENSION: Readonly<Record<string, string>> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", m4v: "video/x-m4v", pdf: "application/pdf",
};

const refus = (message: string) => new ErreurZernio("refuse", `${message} Rien n'a été envoyé.`);

/** Lecteur par défaut : fetch https, flux direct (jamais tout le fichier en mémoire). */
export const lecteurMediaParDefaut: LecteurMedia = async (adresse) => {
  if (!/^https:\/\//.test(adresse)) throw refus("Un média n'est pas en ligne (adresse https exigée).");
  const rep = await fetch(adresse);
  if (!rep.ok || !rep.body) throw refus("Le fichier du média n'a pas pu être lu.");
  const taille = Number(rep.headers.get("content-length"));
  if (!Number.isSafeInteger(taille) || taille <= 0) throw refus("La taille du média est inconnue.");
  return { corps: rep.body as ReadableStream<Uint8Array>, taille, contentType: rep.headers.get("content-type")?.split(";")[0].trim() };
};

/** Nom de fichier et type d'un média (le type vient de l'extension, sinon de la réponse de lecture). */
export function typeEtNom(adresse: string, typeLu?: string): { filename: string; contentType: string } {
  let chemin = "";
  try {
    chemin = new URL(adresse).pathname;
  } catch {
    throw refus("L'adresse d'un média est illisible.");
  }
  const dernier = chemin.split("/").filter(Boolean).pop() ?? "media";
  const ext = dernier.includes(".") ? dernier.split(".").pop()!.toLowerCase() : "";
  const contentType = TYPES_PAR_EXTENSION[ext] ?? typeLu ?? "";
  if (!Object.values(TYPES_PAR_EXTENSION).includes(contentType)) throw refus("Le type du média n'est pas accepté par Zernio.");
  return { filename: dernier.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120), contentType };
}

/** Téléverse UN média : presign → PUT en flux. Rend le média tel que Zernio l'attend (url publique, titre, texte alternatif). */
export async function televerserMedia(client: ClientZernio, lire: LecteurMedia, media: MediaItemZernio): Promise<MediaItemZernio> {
  const source = await lire(media.url);
  const { filename, contentType } = typeEtNom(media.url, source.contentType);
  const pret = await client.preparerTeleversement({ filename, contentType, size: source.taille });
  await client.televerser({ uploadUrl: pret.uploadUrl, corps: source.corps, contentType, contentLength: source.taille });
  return { ...media, url: pret.publicUrl };
}

/** Téléverse les médias dans l'ordre, un à la fois (un seul flux ouvert). */
export async function televerserMedias(client: ClientZernio, lire: LecteurMedia, medias: MediaItemZernio[]): Promise<MediaItemZernio[]> {
  const faits: MediaItemZernio[] = [];
  for (const m of medias) faits.push(await televerserMedia(client, lire, m));
  return faits;
}
