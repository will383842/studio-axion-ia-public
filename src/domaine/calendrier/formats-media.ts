/**
 * CAL-25 : contrôle du format d'un média déposé à la main, réseau par réseau. Fonctions pures, aucune lecture de fichier.
 * Les plafonds sont prudents (à reconfirmer avec les aides officielles de chaque réseau) ; ils vivent ici, à un seul endroit.
 * Un format refusé n'empêche jamais l'ajout : l'appelant garde la publication en brouillon et affiche la raison.
 */
import type { IdReseau, Ratio } from "@/domaine/types";

export type TypeMedia = "video" | "image" | "pdf";
const Mo = 1024 * 1024;
const Go = 1024 * Mo;

export interface RegleType {
  mimes: readonly string[];
  /** Octets, limite incluse. */
  tailleMax: number;
  /** Secondes, limite incluse (vidéo seulement). */
  dureeMaxSec?: number;
}
export type LimitesReseau = Partial<Record<TypeMedia, RegleType>>;

const VIDEO_MP4 = ["video/mp4"] as const;
const IMAGE_JPG_PNG = ["image/jpeg", "image/png"] as const;

export const LIMITES_FORMAT: Record<IdReseau, LimitesReseau> = {
  linkedin: { video: { mimes: VIDEO_MP4, tailleMax: 5 * Go }, image: { mimes: IMAGE_JPG_PNG, tailleMax: 10 * Mo }, pdf: { mimes: ["application/pdf"], tailleMax: 100 * Mo } },
  instagram: { video: { mimes: VIDEO_MP4, tailleMax: 1 * Go }, image: { mimes: ["image/jpeg"], tailleMax: 8 * Mo } },
  facebook: { video: { mimes: VIDEO_MP4, tailleMax: 4 * Go }, image: { mimes: IMAGE_JPG_PNG, tailleMax: 10 * Mo } },
  tiktok: { video: { mimes: VIDEO_MP4, tailleMax: 4 * Go } },
  youtube: { video: { mimes: VIDEO_MP4, tailleMax: 4 * Go } },
  "youtube-shorts": { video: { mimes: VIDEO_MP4, tailleMax: 4 * Go, dureeMaxSec: 180 } },
};

const NOM_RESEAU: Record<IdReseau, string> = { linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube", "youtube-shorts": "YouTube Shorts" };
const NOM_TYPE: Record<TypeMedia, string> = { video: "la vidéo", image: "l'image", pdf: "le PDF" };

export interface MediaDecrit {
  mime: string;
  taille: number;
  dureeSec?: number;
}
export type ResultatFormat = { ok: true; type: TypeMedia } | { ok: false; raison: string };

/** Type de média d'un type MIME ; null si ce n'est ni une vidéo, ni une image, ni un PDF. */
export function typeDuMime(mime: string): TypeMedia | null {
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("image/")) return "image";
  if (m === "application/pdf") return "pdf";
  return null;
}

function libelleTaille(octets: number): string {
  return octets >= Go ? `${Math.round((octets / Go) * 10) / 10} Go`.replace(".", ",") : `${Math.round(octets / Mo)} Mo`;
}

export function verifierFormat(reseau: IdReseau, media: MediaDecrit): ResultatFormat {
  const nom = NOM_RESEAU[reseau] ?? String(reseau);
  const type = typeDuMime(media.mime);
  if (!type) return { ok: false, raison: "Ce fichier n'est ni une vidéo, ni une image, ni un PDF : le format n'est pas reconnu." };
  if (!Number.isFinite(media.taille) || media.taille <= 0) return { ok: false, raison: "Ce fichier semble vide : il n'a pas été reçu en entier." };
  const regle = LIMITES_FORMAT[reseau]?.[type];
  if (!regle) return { ok: false, raison: `${nom} n'accepte pas ${NOM_TYPE[type]} : choisissez un autre type de fichier ou un autre réseau.` };
  if (!regle.mimes.includes(media.mime.toLowerCase())) {
    const attendus = regle.mimes.map((x) => x.split("/")[1].toUpperCase().replace("JPEG", "JPG")).join(" ou ");
    return { ok: false, raison: `${nom} n'accepte pas ce format de fichier (${media.mime}) : convertissez-le en ${attendus}.` };
  }
  if (media.taille > regle.tailleMax) return { ok: false, raison: `Ce fichier est trop lourd pour ${nom} : ${libelleTaille(regle.tailleMax)} au plus.` };
  if (regle.dureeMaxSec !== undefined && media.dureeSec !== undefined && media.dureeSec > regle.dureeMaxSec) {
    return { ok: false, raison: `Cette vidéo est trop longue pour ${nom} : ${regle.dureeMaxSec} secondes au plus.` };
  }
  return { ok: true, type };
}

/** Ratio le plus proche parmi les quatre connus ; null si une dimension manque, est nulle ou n'est pas un nombre. */
export function ratioDe(largeur?: number, hauteur?: number): Ratio | null {
  if (!largeur || !hauteur || !Number.isFinite(largeur) || !Number.isFinite(hauteur) || largeur <= 0 || hauteur <= 0) return null;
  const r = largeur / hauteur;
  const candidats: [Ratio, number][] = [["9:16", 9 / 16], ["4:5", 4 / 5], ["1:1", 1], ["16:9", 16 / 9]];
  return candidats.reduce((a, b) => (Math.abs(Math.log(b[1] / r)) < Math.abs(Math.log(a[1] / r)) ? b : a))[0];
}
