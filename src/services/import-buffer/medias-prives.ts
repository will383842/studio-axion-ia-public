/**
 * IMP-1 — COPIE PRIVÉE DES MÉDIAS D'UN POST BUFFER VERS R2 (seau PRIVÉ).
 * Clé : `import-buffer/<bufferId>/<rang>.<ext>`. Pour chaque média : type, taille, empreinte SHA-256.
 * Aucune adresse n'est conservée ni renvoyée (ni celle de Buffer, ni une adresse publique) ; le dépôt passe par une
 * adresse signée de dépôt du stockage R2 du dépôt. Lecture seule côté Buffer.
 */
import { createHash } from "node:crypto";
import type { StockageFichiers } from "../../fournisseurs/types";
import type { MediaBuffer, PostBuffer, TypeMedia } from "./types";

export interface MediaCopie {
  rang: number;
  type: TypeMedia;
  mime: string;
  taille: number;
  sha256: string;
  cleStockage: string;
  texteAlternatif?: string;
  titre?: string;
}

export interface ResultatCopie {
  postId: string;
  copies: MediaCopie[];
  echecs: { rang: number; raison: string }[];
}

export type StockagePrive = Pick<StockageFichiers, "urlDepotDuree">;
type Fetch = typeof fetch;

const ID_SUR = /^[A-Za-z0-9_-]{1,64}$/;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp",
  "video/mp4": "mp4", "video/quicktime": "mov", "application/pdf": "pdf",
};
export const TAILLE_MAX_MEDIA = 500 * 1024 * 1024;
const DELAI_MS = 120_000;

export function extensionDe(mime: string): string {
  return EXTENSIONS[mime.toLowerCase()] ?? "bin";
}

/** Clé de stockage privée ; refuse un identifiant qui pourrait sortir du dossier. */
export function cleMediaPrive(bufferId: string, rang: number, mime: string): string {
  if (!ID_SUR.test(bufferId)) throw new Error("Identifiant de post illisible : copie refusée.");
  return `import-buffer/${bufferId}/${rang}.${extensionDe(mime)}`;
}

export const sha256De = (octets: Uint8Array): string => createHash("sha256").update(octets).digest("hex");

/** Copie un média : téléchargement, empreinte, dépôt signé, jamais d'adresse en retour. */
export async function copierMedia(
  bufferId: string,
  rang: number,
  media: MediaBuffer,
  stockage: StockagePrive,
  appeler: Fetch = fetch,
): Promise<MediaCopie> {
  const cle = cleMediaPrive(bufferId, rang, media.mime);
  if (!media.source || !/^https:\/\//.test(media.source)) throw new Error("Média sans adresse de lecture.");
  if (!stockage.urlDepotDuree) throw new Error("Stockage privé indisponible (R2 non configuré).");
  if (media.tailleAnnoncee !== undefined && media.tailleAnnoncee > TAILLE_MAX_MEDIA) throw new Error("Média trop volumineux.");
  const lecture = await appeler(media.source, { signal: AbortSignal.timeout(DELAI_MS) });
  if (!lecture.ok) throw new Error(`Téléchargement refusé (HTTP ${lecture.status}).`);
  const annoncee = Number(lecture.headers.get("content-length"));
  if (Number.isFinite(annoncee) && annoncee > TAILLE_MAX_MEDIA) {
    await lecture.body?.cancel().catch(() => undefined);
    throw new Error("Média trop volumineux.");
  }
  const octets = new Uint8Array(await lecture.arrayBuffer());
  if (octets.byteLength === 0) throw new Error("Média vide.");
  if (octets.byteLength > TAILLE_MAX_MEDIA) throw new Error("Média trop volumineux.");
  const url = await stockage.urlDepotDuree(cle, 3600, media.mime);
  const depot = await appeler(url, { method: "PUT", headers: { "content-type": media.mime }, body: octets, signal: AbortSignal.timeout(DELAI_MS) });
  if (!depot.ok) throw new Error(`Dépôt privé refusé (HTTP ${depot.status}).`);
  return {
    rang, type: media.type, mime: media.mime, taille: octets.byteLength, sha256: sha256De(octets), cleStockage: cle,
    ...(media.texteAlternatif ? { texteAlternatif: media.texteAlternatif } : {}),
    ...(media.titre ? { titre: media.titre } : {}),
  };
}

/** Copie tous les médias d'un post ; un échec n'arrête pas les autres et ne porte aucune adresse. */
export async function copierMediasDuPost(post: PostBuffer, stockage: StockagePrive, appeler: Fetch = fetch): Promise<ResultatCopie> {
  const res: ResultatCopie = { postId: post.id, copies: [], echecs: [] };
  for (const [rang, media] of post.medias.entries()) {
    try {
      res.copies.push(await copierMedia(post.id, rang, media, stockage, appeler));
    } catch (e) {
      res.echecs.push({ rang, raison: (e instanceof Error ? e.message : "erreur").replace(/https?:\/\/\S+/g, "[adresse]").slice(0, 200) });
    }
  }
  return res;
}
