/**
 * Opération `composition`, mode `facecam-v4` (file LONGUE) — Lot I du face caméra animée v4 (17/10/2026).
 *
 * Une vidéo face caméra animée v4 d'après le PLAN du réalisateur (déjà contrôlé par le studio, `verifierPlan`) :
 *  1. la prise BRUTE de Will (entrée `prise`, adresse signée) est téléchargée puis MONTÉE selon les intervalles gardés
 *     (`parametres.gardes`, coupes des silences du studio recalées sur 30 i/s) : FFmpeg, image par image, voix comprise,
 *     AUCUN zoom ni recadrage, fond intact (même filtre que la répétition validée, `outils/facecam-animee-v4/monter-prise.mjs`) ;
 *     prise HORIZONTALE seulement (`parametres.recadrage`, calculé par le studio sur le visage) : colonne 9:16 FIXE de toute la hauteur,
 *     ramenée à 1080 × 1920 (aucun zoom en plus, aucun mouvement de cadrage) ;
 *  2. un dossier PLAT est servi en local (`servirDossier`) : prise montée, bruitages (`sons/` + 3 maison du lot 5), B-roll
 *     (`motion-v4/communs/broll`), polices (Montserrat 900 woff2, Montserrat Black, Inter Bold) et logo ; son adresse passe à la
 *     composition en `mediasBase` (`motion-v4/communs/medias-v4.ts`) : aucun `staticFile`, aucun dossier public ;
 *  3. Remotion rend `InterfaceClaireFaceCameraV4` (CRF 18), puis FFmpeg ré-encode comme la répétition (CRF 22, ≤ 3,4 Mb/s, AAC 48 kHz,
 *     `+faststart`) ; la vidéo est déposée sur `sortie.urlDepot`.
 * VIDÉOS D'ILLUSTRATION (AvantApres, MosaiqueVideos, duel-video) : le studio les envoie en entrées « broll:v4-<rang>-<k>.mp4 » (adresses signées),
 * rangées dans ce même dossier avant les médias maison ; un plan dont une de ces plaquettes n'a pas ses médias est refusé AVANT le montage
 * (`medias-plaquettes-v4.ts`) — jamais plus de `broll/` sans nom de fichier à 99 % du rendu (vidéo v-60359dd080b1).
 * AUCUNE musique : un plan qui porte des sons (`plan.sons` non vide) est refusé ; les bruitages viennent des plaquettes elles-mêmes.
 * Mesures : `images`, `fps`, `dureeSec`, `taille`, `dureeMonteeSec`, `gardes`, temps des étapes.
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, rename, stat, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ErreurRendu, type ContexteOperation, type DemandeRendu } from "../contrat.js";
import { deposer, executer, executerAvecErreurs, FFMPEG, FFPROBE, telecharger } from "../outils.js";
import { CACHE_VIDEO_RENDU_OCTETS, paquetCompositions, racinePaquet, REGLAGES_RENDU } from "../remotion.js";
import { servirDossier } from "../composition/serveur-fichiers.js";
import { controlerMediasPlaquettesV4, telechargerVideosIllustrationV4 } from "./medias-plaquettes-v4.js";
import { mesurerFichier } from "../son/mesure.js";

export const ID_COMPOSITION_FACECAM_V4 = "InterfaceClaireFaceCameraV4";
/** Nom de la prise montée dans le dossier servi (le studio met `plan.prise.src` à cette valeur). */
export const PRISE_MONTEE_V4 = "prise-montee.mp4";

export interface GardeV4 {
  debutSec: number;
  finSec: number;
}

export interface ParametresFacecamV4 {
  mode: "facecam-v4";
  plan: { elementsV4?: unknown[]; sons?: unknown[]; duree: number; fps: number; prise: { src: string } } & Record<string, unknown>;
  gardes: GardeV4[];
  crf?: number;
  debitMax?: string;
  /** Dépôt de la vignette (JPEG, image à 1,5 s), facultatif. */
  vignette?: { urlDepot: string; cle: string };
  /** Prise horizontale : colonne gardée (pixels de la prise après rotation) et taille de sortie. */
  recadrage?: RecadrageMontageV4;
}

export interface RecadrageMontageV4 {
  x: number;
  largeur: number;
  hauteur: number;
  sortieLargeur: number;
  sortieHauteur: number;
}

/** Dossiers de médias des plaquettes v4 (relatifs à la racine du paquet), aplatis dans le dossier servi. */
export function sourcesMediasV4(racine: string = racinePaquet()): { dossiers: string[]; fichiers: string[] } {
  const ic = resolve(racine, "compositions", "interface-claire");
  return {
    dossiers: [join(ic, "sons"), join(ic, "motion-v4", "lot5", "sons"), join(ic, "motion-v4", "communs", "broll"), join(ic, "motion-v4", "lot5", "polices"), join(ic, "motion-v4", "lot5", "marque")],
    fichiers: [join(ic, "motion-v4", "lot2", "polices", "Montserrat-Black.ttf"), resolve(racine, "compositions", "commune", "polices", "Inter-Bold.ttf")],
  };
}

const MEDIA = /\.(wav|mp4|woff2|ttf|png)$/i;

/**
 * Filtre FFmpeg du montage de la prise (intervalles gardés, 30 i/s, voix comprise). Avec `recadrage` (prise horizontale) : la colonne
 * gardée, fixe, ramenée à la taille de sortie ; sans : identique à la répétition validée, au caractère près. PUR.
 */
export function filtreMontageV4(gardes: readonly GardeV4[], recadrage?: RecadrageMontageV4): string {
  const coupes =
    gardes.map((g, i) => `[0:v]trim=start=${g.debutSec}:end=${g.finSec},setpts=PTS-STARTPTS,fps=30[v${i}];[0:a]atrim=start=${g.debutSec}:end=${g.finSec},asetpts=PTS-STARTPTS[a${i}];`).join("") +
    gardes.map((_, i) => `[v${i}][a${i}]`).join("");
  if (!recadrage) return coupes + `concat=n=${gardes.length}:v=1:a=1[v][a]`;
  const r = recadrage;
  return coupes + `concat=n=${gardes.length}:v=1:a=1[vc][a];[vc]crop=${r.largeur}:${r.hauteur}:${r.x}:0,scale=${r.sortieLargeur}:${r.sortieHauteur}:flags=lanczos,setsar=1[v]`;
}

/** Lit le recadrage demandé (entiers pairs, colonne verticale) ; absent ou invalide : `undefined` (refus si présent mais faux). PUR. */
export function lireRecadrageV4(x: unknown): RecadrageMontageV4 | undefined {
  if (x === undefined || x === null) return undefined;
  const r = x as Partial<RecadrageMontageV4>;
  const entiers = [r.x, r.largeur, r.hauteur, r.sortieLargeur, r.sortieHauteur];
  const valide = entiers.every((v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) % 2 === 0) && (r.largeur as number) > 0 && (r.hauteur as number) > 0 && (r.sortieLargeur as number) > 0 && (r.sortieHauteur as number) > 0 && (r.largeur as number) < (r.hauteur as number);
  if (!valide) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Recadrage de la prise invalide." });
  return { x: r.x as number, largeur: r.largeur as number, hauteur: r.hauteur as number, sortieLargeur: r.sortieLargeur as number, sortieHauteur: r.sortieHauteur as number };
}

/** Décision de Will (17/10/2026) : voix à -27,4 LUFS, « on entend à peine » → son final de CE format à -14 LUFS intégré, pic vrai ≤ -1,5 dBTP. */
export const CIBLE_LUFS_V4 = -14;
export const PIC_VRAI_MAX_V4 = -1.5;
/** Marges (dB) sous le pic visé avant l'AAC, essayées dans l'ordre : l'encodage AAC dépasse de 0,7 à 2 dB selon le son (mesuré sur la vraie prise). */
export const MARGES_PIC_AAC_DB: readonly number[] = [1, 2, 3, 4, 5];
/** Écart toléré sur le niveau intégré visé (LU). */
export const TOLERANCE_LUFS_V4 = 1;
const cibleLoudnorm = (margeDb: number) => `I=${CIBLE_LUFS_V4}:TP=${+(PIC_VRAI_MAX_V4 - margeDb).toFixed(2)}:LRA=11`;

/** Passe 1 de la normalisation : mesure (JSON sur stderr). PUR. */
export function filtreLoudnormMesure(margeDb: number = MARGES_PIC_AAC_DB[0]): string {
  return `loudnorm=${cibleLoudnorm(margeDb)}:print_format=json`;
}

export interface MesureLoudnorm {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
}

/** Lit le JSON de la passe 1 (dernier bloc `{…}` de la sortie d'erreur de FFmpeg). PUR. */
export function lireMesureLoudnorm(sortie: string): MesureLoudnorm {
  const debut = sortie.lastIndexOf("{");
  const fin = sortie.lastIndexOf("}");
  if (debut < 0 || fin < debut) throw new ErreurRendu({ code: "inconnu", reessayable: false, message: "Mesure du son (loudnorm) illisible." });
  const j = JSON.parse(sortie.slice(debut, fin + 1)) as Record<string, string>;
  for (const cle of ["input_i", "input_tp", "input_lra", "input_thresh", "target_offset"]) {
    if (!Number.isFinite(Number(j[cle]))) throw new ErreurRendu({ code: "inconnu", reessayable: false, message: `Mesure du son (loudnorm) : « ${cle} » absent ou infini (piste muette ?).` });
  }
  return j as unknown as MesureLoudnorm;
}

/** Passe 2 : normalisation d'après la mesure, ramenée à 48 kHz (loudnorm travaille à 192 kHz). PUR. */
export function filtreLoudnormFinal(m: MesureLoudnorm, margeDb: number = MARGES_PIC_AAC_DB[0]): string {
  return `loudnorm=${cibleLoudnorm(margeDb)}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`;
}

/** Le son mesuré après AAC respecte-t-il la cible (niveau à ±1 LU, pic vrai ≤ -1,5 dBTP) ? PUR. */
export function sonConforme(m: { lufs: number; creteVraieDbtp: number }): boolean {
  return Number.isFinite(m.lufs) && Number.isFinite(m.creteVraieDbtp) && Math.abs(m.lufs - CIBLE_LUFS_V4) <= TOLERANCE_LUFS_V4 && m.creteVraieDbtp <= PIC_VRAI_MAX_V4;
}

/**
 * Son du rendu final de CE format : loudnorm en deux passes (mesure, puis gain), encodé en AAC 128 k / 48 kHz, puis MESURÉ (ebur128) ;
 * si le pic vrai dépasse après l'AAC, on recommence avec une marge plus grande. Écrit `sortie` (m4a) et renvoie la mesure retenue.
 * Si aucune marge ne convient, la meilleure tentative est gardée (le pic le plus bas dans la tolérance de niveau, sinon le plus bas).
 */
export async function normaliserSonV4(entree: string, sortie: string, signal?: AbortSignal): Promise<{ lufs: number; creteVraieDbtp: number; margeDb: number; tentatives: number }> {
  let meilleure: { lufs: number; creteVraieDbtp: number; margeDb: number } | null = null;
  const essai = `${sortie}.essai.m4a`;
  let tentatives = 0;
  for (const margeDb of MARGES_PIC_AAC_DB) {
    tentatives++;
    const passe1 = await executerAvecErreurs(FFMPEG, ["-hide_banner", "-nostats", "-i", entree, "-map", "0:a:0", "-af", filtreLoudnormMesure(margeDb), "-f", "null", "-"], signal);
    await executer(FFMPEG, ["-hide_banner", "-v", "error", "-y", "-i", entree, "-map", "0:a:0", "-vn", "-af", filtreLoudnormFinal(lireMesureLoudnorm(passe1.erreurs), margeDb), "-c:a", "aac", "-b:a", "128k", "-ar", "48000", essai], signal);
    const m = await mesurerFichier(essai, [], signal);
    const retenue = { lufs: m.lufs, creteVraieDbtp: m.creteVraieDbtp, margeDb };
    const mieux = !meilleure || (Math.abs(retenue.lufs - CIBLE_LUFS_V4) <= TOLERANCE_LUFS_V4 && retenue.creteVraieDbtp < meilleure.creteVraieDbtp) || (!sonConforme(meilleure) && Math.abs(meilleure.lufs - CIBLE_LUFS_V4) > TOLERANCE_LUFS_V4 && retenue.creteVraieDbtp < meilleure.creteVraieDbtp);
    if (mieux) {
      meilleure = retenue;
      await rename(essai, sortie);
    }
    if (sonConforme(m)) break;
  }
  return { ...meilleure!, tentatives };
}

/** Contrôle des paramètres (refus non réessayable). PUR. */
export function lireParametresFacecamV4(p: Record<string, unknown>): ParametresFacecamV4 {
  const refus = (message: string) => new ErreurRendu({ code: "refuse", reessayable: false, message });
  const plan = p.plan as ParametresFacecamV4["plan"] | undefined;
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.elementsV4) || !plan.elementsV4.length) throw refus("Plan v4 absent ou sans plaquette.");
  if (Array.isArray(plan.sons) && plan.sons.length) throw refus("Plan v4 refusé : il porte des sons (aucune musique ; les bruitages viennent des plaquettes).");
  if (plan.prise?.src !== PRISE_MONTEE_V4) throw refus(`Plan v4 refusé : la prise du plan doit être « ${PRISE_MONTEE_V4} ».`);
  const gardes = p.gardes as GardeV4[] | undefined;
  if (!Array.isArray(gardes) || !gardes.length || gardes.some((g) => !(Number.isFinite(g?.debutSec) && Number.isFinite(g?.finSec) && g.finSec > g.debutSec && g.debutSec >= 0))) throw refus("Intervalles gardés de la prise absents ou invalides.");
  const v = p.vignette as { urlDepot?: unknown; cle?: unknown } | undefined;
  const vignette = v && typeof v.urlDepot === "string" && typeof v.cle === "string" ? { urlDepot: v.urlDepot, cle: v.cle } : undefined;
  const recadrage = lireRecadrageV4(p.recadrage);
  // Refus précoce, avant tout téléchargement : une plaquette à vidéo sans ses médias ne se rend pas (phrase qui cite la plaquette et l'instant).
  controlerMediasPlaquettesV4(plan.elementsV4);
  return { mode: "facecam-v4", plan, gardes, ...(recadrage ? { recadrage } : {}), crf: typeof p.crf === "number" ? p.crf : undefined, debitMax: typeof p.debitMax === "string" && /^\d+k$/.test(p.debitMax) ? p.debitMax : undefined, ...(vignette ? { vignette } : {}) };
}

/** Remplit `dossier` de liens vers les médias v4 (noms uniques : un doublon de nom est une erreur de déploiement). */
export async function preparerMediasV4(dossier: string, racine: string = racinePaquet()): Promise<number> {
  const { dossiers, fichiers } = sourcesMediasV4(racine);
  // Les fichiers déjà rangés dans le dossier (prise montée, vidéos d'illustration reçues) comptent : un doublon de nom est une erreur claire.
  const vus = new Set<string>(await readdir(dossier));
  const lier = async (source: string, nom: string) => {
    if (vus.has(nom)) throw new ErreurRendu({ code: "refuse", reessayable: false, message: `Médias v4 : deux fichiers portent le nom « ${nom} ».` });
    vus.add(nom);
    await symlink(source, join(dossier, nom));
  };
  for (const d of dossiers) {
    if (!existsSync(d)) throw new ErreurRendu({ code: "indisponible", reessayable: false, message: `Médias v4 introuvables dans l'image de rendu (${d.split("/").slice(-3).join("/")}).` });
    for (const nom of (await readdir(d)).sort()) if (MEDIA.test(nom)) await lier(join(d, nom), nom);
  }
  for (const f of fichiers) {
    if (!existsSync(f)) throw new ErreurRendu({ code: "indisponible", reessayable: false, message: `Police v4 introuvable dans l'image de rendu (${f.split("/").pop()}).` });
    await lier(f, f.split("/").pop() as string);
  }
  return vus.size;
}

/** Noms des fichiers servis (le serveur de fichiers répond par nom de fichier, sans dossier). */
async function nomsServis(dossier: string): Promise<Set<string>> {
  return new Set(await readdir(dossier));
}

async function dureeFichier(chemin: string, signal: AbortSignal): Promise<number> {
  return Number((await executer(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", chemin], signal)).trim());
}

export async function compositionFacecamV4(demande: DemandeRendu, contexte: ContexteOperation) {
  const p = lireParametresFacecamV4(demande.parametres);
  const url = demande.entrees.prise;
  if (!url) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Entrée « prise » absente." });
  const temps: Record<string, number> = {};
  const chrono = (cle: string, depuis: number) => (temps[cle] = +((Date.now() - depuis) / 1000).toFixed(1));
  const dossier = contexte.dossier;
  const medias = join(dossier, `medias-${Date.now().toString(36)}`);
  await mkdir(medias, { recursive: true });

  // 1. Prise brute → prise montée.
  let t = Date.now();
  const brute = join(dossier, "prise-brute.mp4");
  await telecharger(url, brute, contexte.signal);
  const script = join(dossier, "filtre-montage-v4.txt");
  await writeFile(script, filtreMontageV4(p.gardes, p.recadrage));
  const montee = join(medias, PRISE_MONTEE_V4);
  await executer(FFMPEG, ["-hide_banner", "-v", "error", "-y", "-i", brute, "-filter_complex_script", script, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "17", "-preset", "fast", "-pix_fmt", "yuv420p", "-r", "30", "-g", "30", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", montee], contexte.signal);
  const dureeMonteeSec = await dureeFichier(montee, contexte.signal);
  chrono("tempsMontageSec", t);
  contexte.progression(8);

  // 2. Médias servis par adresse complète.
  // Vidéos d'illustration des plaquettes (entrées « broll: »), rangées sous leur nom AVANT les médias maison (un doublon de nom donne une erreur claire).
  const nombreIllustrations = await telechargerVideosIllustrationV4(demande.entrees, medias, (u, f) => telecharger(u, f, contexte.signal));
  const nombreMedias = await preparerMediasV4(medias);
  // Chaque média d'une plaquette à vidéo doit être servi : sinon refus net ici, pas un 404 à 99 % du rendu.
  controlerMediasPlaquettesV4(p.plan.elementsV4 ?? [], await nomsServis(medias));
  const serveur = await servirDossier(medias);
  try {
    t = Date.now();
    const inputProps = { ...p.plan, mediasBase: serveur.base };
    const { makeCancelSignal, renderMedia, selectComposition } = await import("@remotion/renderer");
    const serveUrl = await paquetCompositions();
    const choisie = await selectComposition({ ...REGLAGES_RENDU, serveUrl, id: ID_COMPOSITION_FACECAM_V4, inputProps }).catch((e: Error) => {
      throw new ErreurRendu({ code: "refuse", reessayable: false, message: `Composition « ${ID_COMPOSITION_FACECAM_V4} » introuvable : ${e.message}` });
    });
    const { cancelSignal, cancel } = makeCancelSignal();
    contexte.signal.addEventListener("abort", () => cancel());
    const rendu = join(dossier, "rendu-v4.mp4");
    await renderMedia({
      ...REGLAGES_RENDU, composition: choisie, serveUrl, codec: "h264", crf: Math.max(0, Math.min(51, Math.round(p.crf ?? 18))), pixelFormat: "yuv420p", audioCodec: "aac", audioBitrate: "160k",
      outputLocation: rendu, inputProps, cancelSignal, timeoutInMilliseconds: 300_000, offthreadVideoCacheSizeInBytes: CACHE_VIDEO_RENDU_OCTETS, mediaCacheSizeInBytes: CACHE_VIDEO_RENDU_OCTETS, onProgress: ({ progress }) => contexte.progression(8 + progress * 82),
    });
    chrono("tempsRenduSec", t);

    // 3. Ré-encodage final (comme la répétition validée) puis dépôt.
    t = Date.now();
    const finale = join(dossier, "video.mp4");
    // Son : normalisation à -14 LUFS (deux passes + contrôle après AAC), uniquement pour ce format ; la vidéo est ré-encodée sans toucher au son.
    const sonFinal = join(dossier, "son-final.m4a");
    const son = await normaliserSonV4(rendu, sonFinal, contexte.signal);
    await executer(FFMPEG, ["-hide_banner", "-v", "error", "-y", "-i", rendu, "-i", sonFinal, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-maxrate", p.debitMax ?? "3400k", "-bufsize", "7000k", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "copy", "-shortest", "-movflags", "+faststart", finale], contexte.signal);
    chrono("tempsExportSec", t);
    contexte.progression(96);
    const dureeSec = await dureeFichier(finale, contexte.signal);
    const { size } = await stat(finale);
    await deposer(demande.sortie.urlDepot, finale, "video/mp4", contexte.signal);
    if (p.vignette) {
      const vignette = join(dossier, "vignette.jpg");
      await executer(FFMPEG, ["-hide_banner", "-v", "error", "-y", "-ss", Math.min(1.5, dureeSec / 2).toFixed(2), "-i", finale, "-frames:v", "1", "-vf", "scale=540:-2", "-q:v", "3", vignette], contexte.signal);
      await deposer(p.vignette.urlDepot, vignette, "image/jpeg", contexte.signal);
    }
    return { mesures: { images: choisie.durationInFrames, fps: choisie.fps, dureeSec: +dureeSec.toFixed(3), taille: size, dureeMonteeSec: +dureeMonteeSec.toFixed(3), gardes: p.gardes.length, medias: nombreMedias, illustrations: nombreIllustrations, lufs: son.lufs, picVraiDbtp: son.creteVraieDbtp, margePicDb: son.margeDb, ...temps } };
  } finally {
    await serveur.fermer();
  }
}
