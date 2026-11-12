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
 * Fond propre (`fondPropre: true` ou aucune image acceptable) : fond de la charte, titre seul.
 * Gabarit `image-video-v3` : la mieux notée des images des 3 premières secondes de la vidéo finale, sans titre (voir `operationImageVideo`).
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
export const LUMINOSITE_MIN = 35;
/** Luminosité moyenne au-dessus de laquelle une image est vide ou délavée. */
export const LUMINOSITE_MAX = 235;
/** Écart (YHIGH − YLOW) sous lequel une image est plate : fondu à moitié fait, écran vide. */
export const CONTRASTE_MIN = 40;
/** `blurdetect` au-dessus duquel une image est floue. */
export const FLOU_MAX = 25;

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
  /** YHIGH − YLOW (signalstats) : écart entre les ombres et les hautes lumières. */
  contraste?: number;
  /** Différence moyenne (YAVG, 0-255) avec la candidate précédente : grande = fondu ou changement de plan. Absente pour la première. */
  ecartVoisine?: number;
}

/** Une image digne d'être une vignette : ni noire, ni vide, ni plate (fondu à moitié), ni floue. Mesure absente : pas jugée mauvaise. PUR. */
export function jugerImage(m: MesureImage): boolean {
  if (m.luminosite !== undefined && (m.luminosite < LUMINOSITE_MIN || m.luminosite > LUMINOSITE_MAX)) return false;
  if (m.contraste !== undefined && m.contraste < CONTRASTE_MIN) return false;
  if (m.flou !== undefined && m.flou > FLOU_MAX) return false;
  return true;
}

/** La plus nette des images acceptables ; null s'il n'y en a aucune (le studio pose alors un fond propre de la charte). PUR. */
export function choisirImagePropre(mesures: MesureImage[], instantVise: number): MesureImage | null {
  const bonnes = mesures.filter(jugerImage);
  return bonnes.length ? choisirPlusNette(bonnes, instantVise) : null;
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

/** Fenêtre de l'accroche : la couverture est cherchée dans les 3 premières secondes (GV-VG-04). */
export const FENETRE_COUVERTURE_SEC = 3;
/** Fin des « premières secondes » où l'on cherche la meilleure image (= la fenêtre de l'accroche). */
export const DEBUT_BON_SEC = FENETRE_COUVERTURE_SEC;
/** Limite du repli : la meilleure image des 6 premières secondes. */
export const DEBUT_SECOURS_SEC = 6;
/** Pas entre deux candidates dans la fenêtre de l'accroche. */
export const PAS_COUVERTURE_SEC = 0.25;
/** Pas entre deux candidates du repli (de 3,25 s à 6 s). */
export const PAS_SECOURS_SEC = 0.5;

/**
 * Différence moyenne (YAVG de `blend=difference`, 0-255) avec l'image d'avant au-dessus de laquelle une image est en
 * transition (fondu, changement de plan) et écartée. VALEUR ESTIMÉE, à recaler sur de vraies vidéos : un visage qui
 * parle donne quelques points d'écart en 0,25 s, un fondu bien plus.
 */
export const ECART_TRANSITION = 18;
/** Poids de la note d'une image (somme = 100). */
export const POIDS_NOTE = { nettete: 40, luminosite: 20, contraste: 15, stabilite: 25 } as const;
/** Luminosité visée : le milieu de la plage acceptée. */
export const LUMINOSITE_IDEALE = (LUMINOSITE_MIN + LUMINOSITE_MAX) / 2;
/** Contraste (YHIGH − YLOW) à partir duquel la note de contraste est pleine. */
export const CONTRASTE_PLEIN = 120;
/** À moins de ce nombre de points d'écart avec la meilleure note, on prend la plus tôt. */
export const ECART_NOTE_EGALITE = 5;

const borner01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Note d'une image, de 0 à 100 : netteté (40), luminosité (20, meilleure vers le milieu de la plage), contraste (15),
 * stabilité (25, écart avec la voisine). Une mesure absente vaut 0,5 : ni bonne, ni mauvaise. PUR.
 */
export function noterImage(m: MesureImage): number {
  const nettete = m.flou === undefined ? 0.5 : 1 - borner01(m.flou / FLOU_MAX);
  const luminosite = m.luminosite === undefined ? 0.5 : 1 - borner01(Math.abs(m.luminosite - LUMINOSITE_IDEALE) / (LUMINOSITE_IDEALE - LUMINOSITE_MIN));
  const contraste = m.contraste === undefined ? 0.5 : borner01(m.contraste / CONTRASTE_PLEIN);
  const stabilite = m.ecartVoisine === undefined ? 0.5 : 1 - borner01(m.ecartVoisine / ECART_TRANSITION);
  const note = nettete * POIDS_NOTE.nettete + luminosite * POIDS_NOTE.luminosite + contraste * POIDS_NOTE.contraste + stabilite * POIDS_NOTE.stabilite;
  return Math.round(note * 100) / 100;
}

/** Image en transition (fondu, changement de plan) : trop différente de la précédente. PUR. */
export function enTransition(m: MesureImage): boolean {
  return m.ecartVoisine !== undefined && m.ecartVoisine > ECART_TRANSITION;
}

/**
 * Instants à examiner au début de la vidéo finale. `premiers` : 0,05 s puis un pas de 0,25 s jusqu'à 3 s (13 images au
 * plus) ; `secours` : de 3,25 s à 6 s par pas de 0,5 s, examiné seulement si aucune des premières ne passe. Jamais
 * au-delà de la durée. PUR.
 */
export function instantsDebut(dureeSec: number): { premiers: number[]; secours: number[] } {
  const max = Math.max(0.05, dureeSec - 0.15);
  const arrondi = (t: number) => Math.round(t * 1000) / 1000;
  const premiers: number[] = [];
  for (let t = 0.05; t <= FENETRE_COUVERTURE_SEC + 1e-9 && t <= max; t = t === 0.05 ? PAS_COUVERTURE_SEC : arrondi(t + PAS_COUVERTURE_SEC)) premiers.push(arrondi(t));
  const secours: number[] = [];
  for (let t = FENETRE_COUVERTURE_SEC + PAS_COUVERTURE_SEC; t <= DEBUT_SECOURS_SEC + 1e-9 && t <= max; t = arrondi(t + PAS_SECOURS_SEC)) secours.push(arrondi(t));
  return { premiers, secours };
}

/** Images de l'accroche (3 premières secondes) dignes d'être une couverture : bonnes (`jugerImage`) et hors transition. PUR. */
export function imagesDebutRetenues(mesures: MesureImage[]): MesureImage[] {
  return mesures.filter((m) => m.instantSec <= FENETRE_COUVERTURE_SEC + 1e-9 && jugerImage(m) && !enTransition(m));
}

/**
 * Image de départ de la vignette : la MIEUX NOTÉE des images de l'accroche (3 premières secondes) qui passent
 * `jugerImage` hors transition ; à moins de 5 points de la meilleure, la plus tôt. Aucune ne passe : la meilleure des
 * 6 premières secondes, pourvu qu'elle ne soit ni noire ni vide. Sinon null (carte de la charte, en dernier recours). PUR.
 */
export function choisirImageDebut(mesures: MesureImage[]): MesureImage | null {
  const triees = [...mesures].sort((a, b) => a.instantSec - b.instantSec);
  const retenues = imagesDebutRetenues(triees);
  if (retenues.length) {
    const meilleure = Math.max(...retenues.map(noterImage));
    return retenues.find((m) => noterImage(m) >= meilleure - ECART_NOTE_EGALITE)!;
  }
  const utilisables = triees.filter((m) => (m.luminosite === undefined || (m.luminosite >= LUMINOSITE_MIN && m.luminosite <= LUMINOSITE_MAX)) && m.instantSec <= DEBUT_SECOURS_SEC + 1e-9);
  return utilisables.length ? choisirPlusNette(utilisables, 0) : null;
}

/** Bande du 9:16 où se pose le titre de couverture : jamais dans les 270 px du haut ni les 670 px du bas. */
export const BANDE_TITRE_COUVERTURE_9_16 = { haut: 270, bas: 1250 } as const;

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

/** Différence moyenne (YAVG, FFmpeg `blend=difference`) entre deux images de même taille ; undefined si la mesure échoue. */
async function ecartEntre(chemin: string, precedent: string, signal: AbortSignal): Promise<number | undefined> {
  try {
    const { erreurs } = await executerAvecErreurs(FFMPEG, ["-hide_banner", "-i", chemin, "-i", precedent, "-filter_complex", "[0:v][1:v]blend=all_mode=difference,signalstats,metadata=print", "-frames:v", "1", "-f", "null", "-"], signal);
    const lum = /YAVG=([\d.]+)/.exec(erreurs);
    return lum ? Number(lum[1]) : undefined;
  } catch {
    return undefined; /* mesure facultative */
  }
}

async function mesurer(chemin: string, instantSec: number, signal: AbortSignal, precedent?: string): Promise<MesureImage> {
  const m: MesureImage = { instantSec };
  if (precedent) {
    const ecart = await ecartEntre(chemin, precedent, signal);
    if (ecart !== undefined) m.ecartVoisine = ecart;
  }
  try {
    const { erreurs } = await executerAvecErreurs(FFMPEG, ["-hide_banner", "-i", chemin, "-vf", "blurdetect,signalstats,metadata=print", "-frames:v", "1", "-f", "null", "-"], signal);
    const flou = /blur mean:\s*([\d.]+)/.exec(erreurs);
    const lum = /YAVG=([\d.]+)/.exec(erreurs);
    if (flou) m.flou = Number(flou[1]);
    if (lum) m.luminosite = Number(lum[1]);
    const bas = /YLOW=([\d.]+)/.exec(erreurs);
    const haut = /YHIGH=([\d.]+)/.exec(erreurs);
    if (bas && haut) m.contraste = Number(haut[1]) - Number(bas[1]);
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
async function choisirFond(url: string, instantVise: number, dureeSec: number, format: ReturnType<typeof formatMiniature>, contexte: ContexteOperation, strict = false): Promise<{ choisie: MesureImage | null; mesures: MesureImage[] }> {
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
  // Strict (gabarit Axion) : aucune image acceptable → null, le fond propre de la charte prend la place.
  const choisie = strict ? choisirImagePropre(mesures, instantVise) : choisirPlusNette(mesures, instantVise);
  if (!choisie) return { choisie: null, mesures };
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
    } else if (p.fondPropre === true) {
      // Aucune vidéo sans texte : la vidéo finale porte déjà texte d'écran et sous-titres. Fond de la charte, titre seul.
      mesures.fondPropre = 1;
      propres = proprietesVignette(base);
    } else {
      if (!demande.entrees.video) throw refus("Entrée « video » manquante.");
      const url = entreePermise(demande.entrees.video);
      const instantVise = Number(p.instantSec);
      if (!Number.isFinite(instantVise) || instantVise < 0) throw refus("Instant de la miniature invalide.");
      const dureeSec = Number.isFinite(Number(p.dureeSec)) && Number(p.dureeSec) > 0 ? Number(p.dureeSec) : await dureeMedia(url, contexte.signal, argumentsLecture(url));
      const { choisie, mesures: vues } = await choisirFond(url, instantVise, dureeSec, format, contexte, true);
      mesures.candidats = vues.length;
      if (choisie) {
        mesures.instant = choisie.instantSec;
        if (choisie.flou !== undefined) mesures.flou = choisie.flou;
        if (choisie.luminosite !== undefined) mesures.luminosite = choisie.luminosite;
      } else {
        mesures.fondPropre = 1;
        mesures.instant = instantVise;
      }
      // Sujet détouré : une adresse permise telle quelle ; un chemin local (mode essai) est servi depuis le dossier de travail.
      let sujet = sujetBrut;
      if (sujet && !/^https?:\/\//i.test(sujet)) {
        const nom = `sujet${sujet.slice(sujet.lastIndexOf(".")).toLowerCase()}`;
        await copyFile(sujet, join(contexte.dossier, nom));
        sujet = `${serveur.base}/${nom}`;
      }
      // Aucune image acceptable : fond propre de la charte, titre seul (jamais une image coupée).
      propres = proprietesVignette(sujet ? { ...base, sujet } : choisie ? { ...base, image: `${serveur.base}/fond.png` } : base);
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

/** Mise à la taille SANS retouche de couleur ni rognage : l'image de la vidéo a déjà le ratio demandé, simple mise à l'échelle. PUR. */
export function filtreFondFidele(largeur: number, hauteur: number): string {
  return `scale=${largeur}:${hauteur}:flags=lanczos,format=rgb24`;
}

/**
 * Gabarit `image-video-v3` : la vignette est une vraie image du DÉBUT de la vidéo finale, sans titre ajouté (celle que
 * les réseaux montrent au lancement). Titre (`couverture`) seulement si Williams en a saisi un. Aucune image
 * utilisable (ou pas de vidéo lisible) : carte de la charte, en dernier recours.
 */
async function operationImageVideo(demande: Parameters<Operation>[0], contexte: ContexteOperation, rendre: RendreVignette): ReturnType<Operation> {
  const p = demande.parametres;
  const ratio = ratioMiniature(p.ratio);
  const format = formatMiniature(ratio);
  const couverture = typeof p.couverture === "string" ? p.couverture.trim().slice(0, 80) : "";
  const base: Parameters<typeof proprietesVignette>[0] = {
    ratio,
    ambiance: p.ambiance as AmbianceVignette | undefined,
    // Réglage `couverture.titreParDefaut` allumé (paramètre `titreCentre`) : titre posé en 9:16, la mise m2 seule tient dans
    // la bande centrale (BANDE_TITRE_COUVERTURE_9_16). Réglage éteint : la mise demandée, exactement comme avant GV-VG-04.
    mise: couverture && ratio === "9:16" && p.titreCentre === true ? "m2" : (p.mise as MiseVignette | undefined),
    couverture,
    motCle: typeof p.motCle === "string" ? p.motCle.slice(0, 60) : undefined,
  };
  const mesures: Record<string, number> = { largeur: format.largeur, hauteur: format.hauteur };
  const png = join(contexte.dossier, "miniature.png");
  let choisie: MesureImage | null = null;
  if (p.fondPropre !== true && demande.entrees.video) {
    const url = entreePermise(demande.entrees.video);
    const dureeSec = Number.isFinite(Number(p.dureeSec)) && Number(p.dureeSec) > 0 ? Number(p.dureeSec) : await dureeMedia(url, contexte.signal, argumentsLecture(url));
    const { premiers, secours } = instantsDebut(dureeSec);
    const vues: MesureImage[] = [];
    const fichiers = new Map<number, string>();
    // Les 3 premières secondes (accroche) sont toutes examinées ; le repli (jusqu'à 6 s) seulement si aucune ne passe.
    let precedent: string | undefined;
    for (const [i, t] of [...premiers, ...secours].entries()) {
      if (i >= premiers.length && imagesDebutRetenues(vues).length) break;
      const chemin = join(contexte.dossier, `debut-${i}.png`);
      try {
        await extraire(url, t, chemin, contexte.signal);
        await stat(chemin);
      } catch (e) {
        if (e instanceof ErreurRendu && /403|404|Forbidden|Not Found/i.test(e.message)) throw new ErreurRendu({ code: "fichier-inaccessible", reessayable: true, message: "Vidéo inaccessible (adresse expirée ?)." });
        continue;
      }
      const m = await mesurer(chemin, t, contexte.signal, precedent);
      vues.push(m);
      fichiers.set(t, chemin);
      precedent = chemin;
      contexte.progression(5 + Math.min(45, i));
    }
    mesures.candidats = vues.length;
    choisie = choisirImageDebut(vues);
    if (choisie) {
      mesures.instant = choisie.instantSec;
      mesures.instantMs = Math.round(choisie.instantSec * 1000);
      if (choisie.flou !== undefined) mesures.flou = choisie.flou;
      if (choisie.luminosite !== undefined) mesures.luminosite = choisie.luminosite;
      await executer(FFMPEG, ["-hide_banner", "-v", "error", "-y", "-i", fichiers.get(choisie.instantSec)!, "-vf", filtreFondFidele(format.largeur, format.hauteur), "-frames:v", "1", join(contexte.dossier, "fond.png")], contexte.signal);
    }
  }
  if (!choisie) mesures.fondPropre = 1;
  contexte.progression(55);
  if (choisie && !couverture) {
    await copyFile(join(contexte.dossier, "fond.png"), png);
  } else {
    const serveur = await servirDossier(contexte.dossier);
    try {
      await rendre(proprietesVignette(choisie ? { ...base, image: `${serveur.base}/fond.png` } : base), png, contexte);
    } finally {
      await serveur.fermer();
    }
  }
  contexte.progression(85);
  const jpeg = join(contexte.dossier, "miniature.jpg");
  mesures.octets = await encoderJpeg(png, jpeg, contexte.signal);
  await deposer(demande.sortie.urlDepot, jpeg, "image/jpeg", contexte.signal);
  return { mesures };
}

export function creerOperationMiniature(rendre: RendreMiniature = rendreAvecRemotion, rendreVignette: RendreVignette = rendreVignetteAvecRemotion): Operation {
  return async (demande, contexte) => {
    if (demande.parametres.gabarit === "image-video-v3") return operationImageVideo(demande, contexte, rendreVignette);
    if (demande.parametres.gabarit === "axion-v2") return operationVignette(demande, contexte, rendreVignette);
    if (!demande.entrees.video) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Entrée « video » manquante." });
    const url = entreePermise(demande.entrees.video);
    const p = demande.parametres;
    const instantVise = Number(p.instantSec);
    if (!Number.isFinite(instantVise) || instantVise < 0) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Instant de la miniature invalide." });
    const format = formatMiniature(ratioMiniature(p.ratio));
    const dureeSec = Number.isFinite(Number(p.dureeSec)) && Number(p.dureeSec) > 0 ? Number(p.dureeSec) : await dureeMedia(url, contexte.signal, argumentsLecture(url));

    // Hors gabarit Axion (secours « r4 ») : toujours une image, la plus nette.
    const { choisie: trouvee, mesures } = await choisirFond(url, instantVise, dureeSec, format, contexte);
    const choisie = trouvee!;

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
