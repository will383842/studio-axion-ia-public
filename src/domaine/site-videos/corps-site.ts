// Vidéos sur le site — corps d'envoi au format du SITE (ADR-0016, PUR). Le site refuse tout champ inconnu (422) : ce corps
// n'a que les champs de son schéma `schemaVersion: 1`. Il remplace plus tard `corpsPasseport` ; rien ne l'appelle encore.
import type { PasseportWeb } from "./types";

export const SCHEMA_VERSION_SITE = 1;

export interface FichierImageSite {
  chemin: string;
  octets: number;
  type: "image/avif" | "image/webp" | "image/jpeg";
  largeur: number;
  hauteur: number;
}

export interface CorpsSite {
  schemaVersion: 1;
  studioVideoId: string;
  version: number;
  slug: string;
  langue: "fr";
  titre: string;
  description: string;
  resume: string;
  aRetenir: string[];
  questions: { question: string; reponse: string }[];
  theme: string;
  serie: { slug: string; titre: string; rang: number } | null;
  lien: { type: "service" | "formation"; chemin: string };
  dureeSecondes: number;
  chapitres: { titre: string; debutSecondes: number }[];
  fichiers: {
    video: { chemin: string; octets: number; type: "video/mp4"; sha256: string; largeur: number; hauteur: number };
    affiche169: FichierImageSite;
    vignette43: FichierImageSite;
    vignette11: FichierImageSite;
    sousTitres: { chemin: string; octets: number; type: "text/vtt" };
  };
  transcription: string | null;
  ia: { voixGeneree: boolean; doubleNumerique: boolean };
  personnesALImage: { williams: boolean };
  attestations: { aucunNomNiLogoDeClient: true };
}

export interface EntreeCorpsSite {
  idStudio: string;
  passeport: PasseportWeb;
  slug: string;
  description: string;
  /** Thème de la liste fermée du site (déjà rapproché de la rubrique). */
  theme: string;
  lien: CorpsSite["lien"];
  serie?: CorpsSite["serie"];
  dureeSec: number;
  fichiers: CorpsSite["fichiers"];
  ia: CorpsSite["ia"];
  /** Jamais vrai par défaut : le fondateur doit le décider pour cette vidéo. */
  personnesALImage: CorpsSite["personnesALImage"];
  /** Case « Aucun client nommé, aucun logo » : sans elle, pas de corps. */
  aucunClient: boolean;
}

/** Le JSON envoyé au site. Lève si l'attestation « aucun client nommé » n'est pas donnée (le site la refuserait). */
export function corpsSite(e: EntreeCorpsSite): CorpsSite {
  if (e.aucunClient !== true) throw new RangeError("L'attestation « aucun client nommé, aucun logo » est obligatoire.");
  const p = e.passeport;
  return {
    schemaVersion: SCHEMA_VERSION_SITE,
    studioVideoId: e.idStudio,
    version: p.version,
    slug: e.slug,
    langue: "fr",
    titre: p.titreWeb,
    description: e.description,
    resume: p.resume,
    aRetenir: [...p.aRetenir],
    questions: p.questions.map((q) => ({ question: q.question, reponse: q.reponse })),
    theme: e.theme,
    serie: e.serie ?? null,
    lien: { ...e.lien },
    dureeSecondes: Math.round(e.dureeSec),
    chapitres: p.chapitres.map((c) => ({ titre: c.libelle, debutSecondes: Math.round(c.debutSec) })),
    fichiers: e.fichiers,
    transcription: p.transcription.trim() ? p.transcription : null,
    ia: { ...e.ia },
    personnesALImage: { ...e.personnesALImage },
    attestations: { aucunNomNiLogoDeClient: true },
  };
}
