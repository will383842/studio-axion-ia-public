// Vidéos sur le site — contrat d'échange studio → site, version 1 (PUR). Figé par `docs/site-videos/contrat/` (lot S4).
import type { PasseportWeb } from "./types";

export const VERSION_CONTRAT = 1;

/** Corps du `POST /api/interne/videos` : le JSON exact envoyé au site (plan § 7.3). Ni `blocRecette`, ni `origines`, ni identifiant de fichier privé. */
export interface CorpsPasseport {
  versionContrat: number;
  idStudio: string;
  versionPasseport: number;
  slugPropose: string;
  titre: string;
  resume: string;
  transcription: string;
  aRetenir: string[];
  questions: { question: string; reponse: string }[];
  chapitres: { debutSec: number; finSec: number; libelle: string }[];
  rubrique: string;
  motsCles: string[];
  generateur: string;
  langue: string;
  dureeSec: number;
  largeur: number;
  hauteur: number;
  contenuGenere: boolean;
  publieLe: string;
  urlVideo: string;
  urlVignette: string;
  largeurVignette: number;
  hauteurVignette: number;
  urlVtt: string;
  credits: string[];
  lienService?: string;
}

export interface EntreeCorpsPasseport {
  idStudio: string;
  passeport: PasseportWeb;
  slugPropose: string;
  generateur: string;
  langue: string;
  dureeSec: number;
  largeur: number;
  hauteur: number;
  publieLe: string;
  urls: { video: string; vignette: string; vtt: string };
  vignette: { largeur: number; hauteur: number };
}

const dixieme = (n: number) => Math.round(n * 10) / 10;

/** Le JSON envoyé au site, champ par champ (§ 7.3). */
export function corpsPasseport(e: EntreeCorpsPasseport): CorpsPasseport {
  const p = e.passeport;
  return {
    versionContrat: VERSION_CONTRAT,
    idStudio: e.idStudio,
    versionPasseport: p.version,
    slugPropose: e.slugPropose,
    titre: p.titreWeb,
    resume: p.resume,
    transcription: p.transcription,
    aRetenir: [...p.aRetenir],
    questions: p.questions.map((q) => ({ question: q.question, reponse: q.reponse })),
    chapitres: p.chapitres.map((c) => ({ debutSec: c.debutSec, finSec: c.finSec, libelle: c.libelle })),
    rubrique: p.rubrique,
    motsCles: [...p.motsCles],
    generateur: e.generateur,
    langue: e.langue,
    dureeSec: dixieme(e.dureeSec),
    largeur: e.largeur,
    hauteur: e.hauteur,
    contenuGenere: p.contenuGenere,
    publieLe: e.publieLe,
    urlVideo: e.urls.video,
    urlVignette: e.urls.vignette,
    largeurVignette: e.vignette.largeur,
    hauteurVignette: e.vignette.hauteur,
    urlVtt: e.urls.vtt,
    credits: [...p.credits],
    ...(p.lienService ? { lienService: p.lienService } : {}),
  };
}

/** Chaîne signée de chaque appel (§ 7.2) : `<horodatage>.<nonce>.<MÉTHODE>.<chemin>.<sha256 hex du corps>`. */
export function chaineASigner(e: { horodatage: string; nonce: string; methode: string; chemin: string; sha256Corps: string }): string {
  return `${e.horodatage}.${e.nonce}.${e.methode}.${e.chemin}.${e.sha256Corps}`;
}

/* ------------------------------------------------------------------ */
/* Fichiers publics : clés versionnées (plan § 7.4)                     */
/* ------------------------------------------------------------------ */

/** Toute clé publique commence par là (règle Cloudflare `/medias/*` vers le seau PUBLIC dédié, jamais le seau privé). */
export const PREFIXE_CLES_PUBLIQUES = "medias/videos/";
/** Même domaine que le site : les fichiers sont servis sous `/medias/*`. */
export const BASE_PUBLIQUE = "https://axion-ia.com";

export interface ClesPubliques {
  video: string;
  vignette: string;
  vtt: string;
}

export interface EntreeClesPubliques {
  idStudio: string;
  slug: string;
  version: number;
  /** sha256 hexadécimal de chaque fichier (les 8 premiers caractères entrent dans la clé). */
  sha256: ClesPubliques;
}

const propre = (texte: string, motif: RegExp) => texte.replace(motif, "");

/**
 * Clés des trois fichiers publics : `medias/videos/<idStudio>/<slug>-v<version>-<8 caractères du sha256>.<mp4|jpg|vtt>`.
 * Versionnées par le contenu : un nom ne change jamais de contenu (cache `immutable`, jamais de purge). Jamais hors du préfixe.
 */
export function clesPubliques(e: EntreeClesPubliques): ClesPubliques {
  const id = propre(e.idStudio, /[^A-Za-z0-9_-]/g);
  if (!id.replace(/[-_]/g, "")) throw new Error("Identifiant de vidéo illisible pour une clé publique.");
  if (!Number.isInteger(e.version) || e.version < 1) throw new Error("Version de page invalide pour une clé publique.");
  const slug = propre(e.slug.toLowerCase(), /[^a-z0-9-]/g).replace(/-+/g, "-").replace(/^-|-$/g, "") || "video";
  const cle = (sha: string, extension: string) => {
    if (!/^[0-9a-f]{8,}$/.test(sha)) throw new Error("Empreinte de fichier invalide pour une clé publique.");
    return `${PREFIXE_CLES_PUBLIQUES}${id}/${slug}-v${e.version}-${sha.slice(0, 8)}.${extension}`;
  };
  return { video: cle(e.sha256.video, "mp4"), vignette: cle(e.sha256.vignette, "jpg"), vtt: cle(e.sha256.vtt, "vtt") };
}

/** Adresse publique d'une clé. */
export function adressePublique(cle: string): string {
  return `${BASE_PUBLIQUE}/${cle}`;
}
