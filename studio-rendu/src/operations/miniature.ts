/**
 * Opération `miniature` (file courte, lot R4) : UNE miniature tirée d'une vraie vidéo.
 *   1. 5 images autour de l'instant demandé (± 0,2 s et ± 0,4 s), lues directement dans la vidéo (lecture par plages,
 *      jamais le fichier entier) ;
 *   2. la PLUS NETTE (FFmpeg `blurdetect`), en écartant les images noires (fondu) ;
 *   3. mise à la taille (1080 × 1920, ou 1280 × 720 en 16:9), ombres à peine éclaircies, légère netteté ;
 *   4. titre de couverture posé par Remotion (composition `Miniature`, zone sûre, couleurs d'Axion) ;
 *   5. JPEG de 2 Mo au plus (limite de YouTube), déposé à `sortie.urlDepot`.
 * Entrée : `video` (adresse signée : la vidéo SANS texte de préférence, sinon la vidéo finale).
 * Paramètres : `instantSec`, `dureeSec` (facultatif), `ratio`, `couverture`, `motCle`, `variante` (0, 1, 2).
 * Gabarit `axion-v2` (vignettes, lot 1) : `gabarit`, `ambiance`, `mise`, `instagram`, `generateur`, entrée facultative `sujet`.
 * Sans `gabarit` (ou `r4`) : le comportement d'avant, inchangé.
 * Mesures : instant retenu, flou, luminosité, largeur, hauteur, octets.
 */
import { copyFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { ratioMiniature, formatMiniature, varianteMiniature, type ProprietesMiniature } from "../../compositions/commune/miniature-mise-en-page.js";
import { proprietesVignette, type AmbianceVignette, type MiseVignette, type ProprietesVignette } from "../../compositions/commune/vignette/socle.js";
import { servirDossier } from "../composition/serveur-fichiers.js";
import { ErreurRendu, type ContexteOperation, type Operation } from "../contrat.js";
import { deposer, dureeMedia, executer, executerAvecErreurs, exigerAdressePermise, FFMPEG, modeEssai, sansAdresses } from "../outils.js";

/** Poids maximal du JPEG (YouTube refuse au-delà de 2 Mo). */
export const OCTETS_MAX_MINIATURE = 2_000_000;
/** Écarts autour de l'instant demandé (5 images). */
export const ECARTS_SEC = [0, -0.2, 0.2, -0.4, 0.4] as const;
/** Luminosité moyenne (0-255) sous laquelle une image est un fondu au noir. */
export const LUMINOSITE_MIN = 28;

/** Les 5 instants à examiner, dans la vidéo, sans doublon. PUR. */
export function instantsCandidats(instantSec: number, dureeSec: number): number[] {
  const min = Math.min(0.1, dureeSec / 2);
  const max = Math.max(min, dureeSec - 0.15);
  const sortie: number[] = [];
  for (const e of ECARTS_SEC) {
    const t = Math.round(Math.min(max, Math.max(min, instantSec + e)) * 1000) / 1000;
    if (sortie.every((s) => Math.abs(s - t) >= 0.04)) sortie.push(t);
  }
  return sortie;
}

export interface MesureImage {
  instantSec: number;
  /** FFmpeg `blurdetect` : plus haut = plus flou. Absent si le filtre manque. */
  flou?: number;
  luminosite?: number;
}

/**
 * La plus nette des images, en écartant les images trop sombres (fondu) s'il en reste d'autres. À netteté égale
 * (± 2 %), la plus proche de l'instant demandé. PUR.
 */
export function choisirPlusNette(mesures: MesureImage[], instantVise: number): MesureImage {
  if (!mesures.length) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Aucune image lisible dans la vidéo." });
  const claires = mesures.filter((m) => m.luminosite === undefined || m.luminosite >= LUMINOSITE_MIN);
  const parmi = claires.length ? claires : mesures;
  return parmi.reduce((a, b) => {
    const fa = a.flou ?? Number.POSITIVE_INFINITY;
    const fb = b.flou ?? Number.POSITIVE_INFINITY;
    const proche = Math.abs(b.instantSec - instantVise) < Math.abs(a.instantSec - instantVise);
    if (Number.isFinite(fa) && Number.isFinite(fb) && Math.abs(fa - fb) <= Math.max(fa, fb) * 0.02) return proche ? b : a;
    if (fb < fa) return b;
    if (fb === fa && proche) return b;
    return a;
  });
}

/** Mise à la taille de la miniature (recadrage au centre si besoin) et légère netteté. PUR. */
export function filtreFond(largeur: number, hauteur: number): string {
  return `scale=${largeur}:${hauteur}:force_original_aspect_ratio=increase:flags=lanczos,crop=${largeur}:${hauteur},eq=gamma=1.06:saturation=1.04,unsharp=5:5:0.45:5:5:0,format=rgb24`;
}

/** Réglages JPEG essayés dans l'ordre jusqu'à passer sous 2 Mo (couleurs pleines d'abord : bords du titre nets). */
export const REGLAGES_JPEG = [
  { pixels: "yuvj444p", q: 2 },
  { pixels: "yuvj444p", q: 3 },
  { pixels: "yuvj420p", q: 3 },
  { pixels: "yuvj420p", q: 5 },
  { pixels: "yuvj420p", q: 8 },
] as const;

/**
 * Options de lecture de la vidéo, avant l'entrée : seulement les protocoles du réseau (jamais `file:`, ni une liste
 * de lecture qui irait chercher ailleurs), démultiplexeur mov / mp4 imposé. Un chemin local (essais sur ce poste,
 * permis en mode essai seulement : `entreePermise`) : fichier seul. PUR.
 */
export function argumentsLecture(entree: string): string[] {
  const protocoles = /^https:\/\//i.test(entree) ? "https,tls,tcp" : /^http:\/\//i.test(entree) ? "http,tcp" : "file";
  return ["-protocol_whitelist", protocoles, "-f", "mov"];
}

/**
 * Entrée acceptée (relecture sécurité R45 n° 4 et 5) : une adresse permise (`https:`, hôte du stockage du studio) ; un
 * chemin local SEULEMENT en mode essai explicite (`STUDIO_RENDU_ESSAI=1`, jamais en production). Refus clair sinon.
 * Rend l'entrée à donner à FFmpeg : l'adresse normalisée, vérifiée telle quelle (relecture R45, 2e lecture, A).
 */
export function entreePermise(entree: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(entree)) return exigerAdressePermise(entree);
  if (!modeEssai()) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Adresse refusée : elle ne vient pas du stockage du studio." });
  return entree;
}

/** Une image de la vidéo à l'instant donné (PNG, sans perte). Erreur sans l'adresse signée. */
async function extraire(url: string, instantSec: number, chemin: string, signal: AbortSignal): Promise<void> {
  try {
    await executer(FFMPEG, ["-hide_banner", "-v", "error", "-y", "-ss", instantSec.toFixed(3), ...argumentsLecture(url), "-i", url, "-frames:v", "1", "-an", chemin], signal);
  } catch (e) {
    throw e instanceof ErreurRendu ? new ErreurRendu({ ...e.erreur, message: sansAdresses(e.erreur.message) }) : e;
  }
}

async function mesurer(chemin: string, instantSec: number, signal: AbortSignal): Promise<MesureImage> {
  const m: MesureImage = { instantSec };
  try {
    const { erreurs } = await executerAvecErreurs(FFMPEG, ["-hide_banner", "-i", chemin, "-vf", "blurdetect,signalstats,metadata=print:key=lavfi.signalstats.YAVG", "-frames:v", "1", "-f", "null", "-"], signal);
    const flou = /blur mean:\s*([\d.]+)/.exec(erreurs);
    const lum = /YAVG=([\d.]+)/.exec(erreurs);
    if (flou) m.flou = Number(flou[1]);
    if (lum) m.luminosite = Number(lum[1]);
  } catch {
    /* mesure facultative : l'image reste candidate */
  }
  return m;
}

/** Image fixe Remotion de la composition `Miniature` (injectable : les tests n'ouvrent pas de navigateur). */
export type RendreMiniature = (proprietes: ProprietesMiniature, sortiePng: string, contexte: ContexteOperation) => Promise<void>;

/** Image fixe Remotion d'une composition donnée (injectable : les tests n'ouvrent pas de navigateur). */
async function rendreImageFixe(id: string, proprietes: Record<string, unknown>, sortiePng: string, contexte: ContexteOperation): Promise<void> {
  const { makeCancelSignal, renderStill, selectComposition } = await import("@remotion/renderer");
  // Délai de la file dépassé (ou arrêt) : le navigateur s'arrête aussi.
  const { cancelSignal, cancel } = makeCancelSignal();
  if (contexte.signal.aborted) cancel();
  else contexte.signal.addEventListener("abort", () => cancel(), { once: true });
  const { paquetCompositions, REGLAGES_RENDU } = await import("../remotion.js");
  const serveUrl = await paquetCompositions();
  const composition = await selectComposition({ serveUrl, id, inputProps: proprietes });
  await renderStill({ ...REGLAGES_RENDU, composition, serveUrl, output: sortiePng, frame: 0, imageFormat: "png", inputProps: proprietes, cancelSignal });
}

export const rendreAvecRemotion: RendreMiniature = (proprietes, sortiePng, contexte) => rendreImageFixe("Miniature", proprietes as unknown as Record<string, unknown>, sortiePng, contexte);

/** Image fixe de la composition `VignetteAxion` (lot 1 des vignettes, gabarit `axion-v2`). */
export type RendreVignette = (proprietes: ProprietesVignette, sortiePng: string, contexte: ContexteOperation) => Promise<void>;

export const rendreVignetteAvecRemotion: RendreVignette = (proprietes, sortiePng, contexte) => rendreImageFixe("VignetteAxion", proprietes as unknown as Record<string, unknown>, sortiePng, contexte);

/** JPEG de 2 Mo au plus (métadonnées retirées). Renvoie son poids. */
export async function encoderJpeg(png: string, jpeg: string, signal: AbortSignal): Promise<number> {
  let octets = 0;
  for (const r of REGLAGES_JPEG) {
    await executer(FFMPEG, ["-hide_banner", "-v", "error", "-y", "-i", png, "-map_metadata", "-1", "-pix_fmt", r.pixels, "-q:v", String(r.q), "-frames:v", "1", jpeg], signal);
    octets = (await stat(jpeg)).size;
    if (octets <= OCTETS_MAX_MINIATURE) return octets;
  }
  throw new ErreurRendu({ code: "refuse", reessayable: false, message: `La miniature dépasse 2 Mo (${Math.round(octets / 1000)} ko).` });
}

/** Étapes 1 à 3 : cinq images autour de l'instant, la plus nette, mise à la taille (`fond.png` dans le dossier de travail). */
async function choisirFond(url: string, instantVise: number, dureeSec: number, format: ReturnType<typeof formatMiniature>, contexte: ContexteOperation): Promise<{ choisie: MesureImage; mesures: MesureImage[] }> {
  // 1-2. Cinq images autour de l'instant, la plus nette.
  const mesures: MesureImage[] = [];
  const candidats = instantsCandidats(instantVise, dureeSec);
  for (const [i, t] of candidats.entries()) {
    const chemin = join(contexte.dossier, `candidat-${i}.png`);
    try {
      await extraire(url, t, chemin, contexte.signal);
      await stat(chemin);
    } catch (e) {
      if (e instanceof ErreurRendu && /403|404|Forbidden|Not Found/i.test(e.message)) throw new ErreurRendu({ code: "fichier-inaccessible", reessayable: true, message: "Vidéo inaccessible (adresse expirée ?)." });
      continue;
    }
    mesures.push(await mesurer(chemin, t, contexte.signal));
    contexte.progression(5 + Math.round(((i + 1) / candidats.length) * 45));
  }
  const choisie = choisirPlusNette(mesures, instantVise);
  const iChoisie = candidats.indexOf(choisie.instantSec);

  // 3. À la taille, légère netteté.
  const fond = join(contexte.dossier, "fond.png");
  await executer(FFMPEG, ["-hide_banner", "-v", "error", "-y", "-i", join(contexte.dossier, `candidat-${iChoisie}.png`), "-vf", filtreFond(format.largeur, format.hauteur), "-frames:v", "1", fond], contexte.signal);
  contexte.progression(55);
  return { choisie, mesures };
}

/** Entrée en `axion-v2` : refus clair (jamais un repli silencieux). */
const refus = (message: string) => new ErreurRendu({ code: "refuse", reessayable: false, message });

/**
 * Gabarit `axion-v2` (lot 1 des vignettes) : composition `VignetteAxion`, 16:9 ou 9:16. Instagram : ni vidéo, ni sujet,
 * ni image (aucune image extraite). Sinon : la plus nette des 5 images en repli, ou le `sujet` détouré s'il est fourni.
 */
async function operationVignette(demande: Parameters<Operation>[0], contexte: ContexteOperation, rendre: RendreVignette): ReturnType<Operation> {
  const p = demande.parametres;
  const instagram = p.instagram === true;
  const ratio = instagram ? "9:16" : p.ratio === "16:9" ? "16:9" : p.ratio === "9:16" || p.ratio === undefined ? "9:16" : null;
  if (!ratio) throw refus("Vignette : 16:9 ou 9:16 seulement.");
  const format = formatMiniature(ratio);
  const couverture = typeof p.couverture === "string" ? p.couverture.trim().slice(0, 80) : "";
  const base: Parameters<typeof proprietesVignette>[0] = {
    ratio,
    ambiance: p.ambiance as AmbianceVignette | undefined,
    mise: p.mise as MiseVignette | undefined,
    instagram,
    couverture,
    motCle: typeof p.motCle === "string" ? p.motCle.slice(0, 60) : undefined,
  };
  // Instagram : les entrées « video » et « sujet » sont ignorées (jamais lues, jamais transmises).
  const sujetBrut = !instagram && demande.entrees.sujet ? entreePermise(demande.entrees.sujet) : undefined;
  const mesures: Record<string, number> = { largeur: format.largeur, hauteur: format.hauteur };
  const png = join(contexte.dossier, "miniature.png");
  const serveur = await servirDossier(contexte.dossier);
  try {
    let propres: ProprietesVignette;
    if (instagram) {
      propres = proprietesVignette(base);
    } else {
      if (!demande.entrees.video) throw refus("Entrée « video » manquante.");
      const url = entreePermise(demande.entrees.video);
      const instantVise = Number(p.instantSec);
      if (!Number.isFinite(instantVise) || instantVise < 0) throw refus("Instant de la miniature invalide.");
      const dureeSec = Number.isFinite(Number(p.dureeSec)) && Number(p.dureeSec) > 0 ? Number(p.dureeSec) : await dureeMedia(url, contexte.signal, argumentsLecture(url));
      const { choisie, mesures: vues } = await choisirFond(url, instantVise, dureeSec, format, contexte);
      mesures.instant = choisie.instantSec;
      mesures.candidats = vues.length;
      if (choisie.flou !== undefined) mesures.flou = choisie.flou;
      if (choisie.luminosite !== undefined) mesures.luminosite = choisie.luminosite;
      // Sujet détouré : une adresse permise telle quelle ; un chemin local (mode essai) est servi depuis le dossier de travail.
      let sujet = sujetBrut;
      if (sujet && !/^https?:\/\//i.test(sujet)) {
        const nom = `sujet${sujet.slice(sujet.lastIndexOf(".")).toLowerCase()}`;
        await copyFile(sujet, join(contexte.dossier, nom));
        sujet = `${serveur.base}/${nom}`;
      }
      propres = proprietesVignette(sujet ? { ...base, sujet } : { ...base, image: `${serveur.base}/fond.png` });
    }
    await rendre(propres, png, contexte);
  } finally {
    await serveur.fermer();
  }
  contexte.progression(85);
  const jpeg = join(contexte.dossier, "miniature.jpg");
  mesures.octets = await encoderJpeg(png, jpeg, contexte.signal);
  await deposer(demande.sortie.urlDepot, jpeg, "image/jpeg", contexte.signal);
  return { mesures };
}

export function creerOperationMiniature(rendre: RendreMiniature = rendreAvecRemotion, rendreVignette: RendreVignette = rendreVignetteAvecRemotion): Operation {
  return async (demande, contexte) => {
    if (demande.parametres.gabarit === "axion-v2") return operationVignette(demande, contexte, rendreVignette);
    if (!demande.entrees.video) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Entrée « video » manquante." });
    const url = entreePermise(demande.entrees.video);
    const p = demande.parametres;
    const instantVise = Number(p.instantSec);
    if (!Number.isFinite(instantVise) || instantVise < 0) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Instant de la miniature invalide." });
    const format = formatMiniature(ratioMiniature(p.ratio));
    const dureeSec = Number.isFinite(Number(p.dureeSec)) && Number(p.dureeSec) > 0 ? Number(p.dureeSec) : await dureeMedia(url, contexte.signal, argumentsLecture(url));

    const { choisie, mesures } = await choisirFond(url, instantVise, dureeSec, format, contexte);

    // 4. Titre de couverture (Remotion), servi depuis le dossier de travail.
    const png = join(contexte.dossier, "miniature.png");
    const couverture = typeof p.couverture === "string" ? p.couverture.trim().slice(0, 80) : "";
    if (couverture) {
      const serveur = await servirDossier(contexte.dossier);
      try {
        const proprietes: ProprietesMiniature = {
          ratio: format.ratio,
          image: `${serveur.base}/fond.png`,
          couverture,
          motCle: typeof p.motCle === "string" ? p.motCle.slice(0, 60) : undefined,
          variante: varianteMiniature(p.variante),
        };
        await rendre(proprietes, png, contexte);
      } finally {
        await serveur.fermer();
      }
    } else {
      await copyFile(join(contexte.dossier, "fond.png"), png);
    }
    contexte.progression(85);

    // 5. JPEG ≤ 2 Mo, déposé.
    const jpeg = join(contexte.dossier, "miniature.jpg");
    const octets = await encoderJpeg(png, jpeg, contexte.signal);
    await deposer(demande.sortie.urlDepot, jpeg, "image/jpeg", contexte.signal);
    const sortie: Record<string, number> = { instant: choisie.instantSec, largeur: format.largeur, hauteur: format.hauteur, octets, candidats: mesures.length };
    if (choisie.flou !== undefined) sortie.flou = choisie.flou;
    if (choisie.luminosite !== undefined) sortie.luminosite = choisie.luminosite;
    return { mesures: sortie };
  };
}

export const miniature: Operation = creerOperationMiniature();
