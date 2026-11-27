/**
 * IMPORT D'UNE VIDÉO DÉJÀ FAITE (hors du Studio) : règles pures, sans lecture ni écriture.
 * Bornes claires, refus en français simple. Le service `import-video-externe.ts` les applique, rien d'autre ne décide.
 */
import type { IdReseau } from "./types";

export const FORMATS_IMPORT = [
  { extension: "mp4", mime: "video/mp4" },
  { extension: "mov", mime: "video/quicktime" },
  { extension: "webm", mime: "video/webm" },
] as const;

/** Bornes : 1 Go au plus, de 3 secondes à 10 minutes. */
export const TAILLE_MAX_IMPORT_OCTETS = 1024 * 1024 * 1024;
export const DUREE_MIN_IMPORT_SEC = 3;
export const DUREE_MAX_IMPORT_SEC = 600;
export const TITRE_MAX_IMPORT = 120;

/** Phrase du refus de toute refabrication d'une vidéo importée (retouche, modification, nouveau format, nouvelle fabrication). */
export const IMPORTEE_PAS_REFABRICABLE = "Cette vidéo vient d'être importée : elle ne peut pas être retouchée ni refaite ici. Modifiez-la dans votre outil, puis importez-la à nouveau.";

/** Vrai pour une vidéo importée : le Studio n'a pas de plan ni de moteur pour la refabriquer. */
export const estVideoImportee = (video: { origineVideo?: string } | null | undefined): boolean => video?.origineVideo === "importee";

const RESEAUX_VALIDES: readonly IdReseau[] = ["linkedin", "instagram", "facebook", "tiktok", "youtube", "youtube-shorts", "pinterest"];

export interface DemandeImportVideo {
  nom: string;
  mime: string;
  taille: number;
  dureeSec: number;
  titre: string;
  reseaux: readonly string[];
  /** La case « Je valide cette vidéo ». */
  valide: boolean;
}

export type ControleImport = { ok: true; titre: string; reseaux: IdReseau[] } | { ok: false; code: string; message: string };

const extensionDe = (nom: string) => (/\.([A-Za-z0-9]{1,8})$/.exec(nom.trim())?.[1] ?? "").toLowerCase();

/** Le format est reconnu par l'extension ET par le type annoncé (un type vide est toléré, jamais un type d'un autre genre). */
export function formatImportAccepte(nom: string, mime: string): boolean {
  const f = FORMATS_IMPORT.find((x) => x.extension === extensionDe(nom));
  if (!f) return false;
  const m = (mime ?? "").trim().toLowerCase();
  return m === "" || m === f.mime || (f.extension === "mp4" && m === "video/x-m4v");
}

function libelleDuree(sec: number): string {
  return sec >= 60 ? `${Math.round(sec / 60)} minutes` : `${sec} secondes`;
}

export function controlerImportVideo(d: DemandeImportVideo): ControleImport {
  const refus = (code: string, message: string): ControleImport => ({ ok: false, code, message });
  if (d.valide !== true) return refus("NON_VALIDEE", "Cochez « Je valide cette vidéo » pour l'ajouter. Rien n'a été ajouté.");
  if (!formatImportAccepte(d.nom, d.mime)) return refus("FORMAT", "Ce format n'est pas accepté. Choisissez une vidéo mp4, mov ou webm.");
  if (!Number.isFinite(d.taille) || d.taille <= 0) return refus("TAILLE", "Ce fichier est vide. Choisissez une autre vidéo.");
  if (d.taille > TAILLE_MAX_IMPORT_OCTETS) return refus("TROP_LOURD", "Cette vidéo est trop lourde (1 Go au plus). Réduisez son poids puis recommencez.");
  if (!Number.isFinite(d.dureeSec) || d.dureeSec <= 0) return refus("DUREE_INCONNUE", "La durée de cette vidéo n'a pas pu être lue. Essayez un autre fichier.");
  if (d.dureeSec < DUREE_MIN_IMPORT_SEC) return refus("TROP_COURTE", `Cette vidéo est trop courte (${libelleDuree(DUREE_MIN_IMPORT_SEC)} au moins).`);
  if (d.dureeSec > DUREE_MAX_IMPORT_SEC) return refus("TROP_LONGUE", `Cette vidéo est trop longue (${libelleDuree(DUREE_MAX_IMPORT_SEC)} au plus).`);
  const titre = (d.titre ?? "").trim().slice(0, TITRE_MAX_IMPORT);
  if (!titre) return refus("TITRE", "Donnez un titre à cette vidéo.");
  const reseaux = Array.from(new Set(d.reseaux)).filter((r): r is IdReseau => (RESEAUX_VALIDES as readonly string[]).includes(r));
  if (!reseaux.length) return refus("RESEAUX", "Choisissez au moins un réseau.");
  return { ok: true, titre, reseaux };
}
