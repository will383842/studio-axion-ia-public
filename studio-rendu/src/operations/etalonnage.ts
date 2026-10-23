/**
 * Opération `etalonnage` (lot R5, 03/10) : une LUT `.cube` appliquée à une IMAGE (file courte : l'image « après »
 * d'une LUT importée dans la Bibliothèque) ou à une VIDÉO (file longue). L'original n'est jamais modifié : un NOUVEAU
 * fichier est déposé à `sortie.urlDepot`.
 * Entrées : `lut` (.cube) et `image` OU `video` (adresses signées).
 * Paramètres : `intensite` (0-1, défaut 1) ; `format` (« jpeg » ou « png », image seulement ; défaut « jpeg »).
 * Même calcul que le montage (`composition`) : la LUT est d'abord MÉLANGÉE à l'identité selon l'intensité
 * (`melangerAvecIdentite`, exact car linéaire), puis appliquée par FFmpeg `lut3d` en interpolation tétraédrique,
 * en RVB. Intensité 0 : aucune LUT, l'image ressort telle quelle.
 * Mesures : taille de la LUT, intensité, largeur, hauteur.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ecrireCube, melangerAvecIdentite } from "../../../src/lib/qc-lut.js";
import { ErreurRendu, type Operation } from "../contrat.js";
import { lireCubeFichier } from "../lut.js";
import { deposer, executer, executerAvecErreurs, FFMPEG, FFPROBE, FORMATS_IMAGE, FORMATS_VIDEO, formatFichier, lectureLocale, telecharger, type FormatEntree } from "../outils.js";

/** Plafonds de téléchargement : une LUT 65³ pèse 7,4 Mo ; au-delà de 50 Mo ce n'est pas une LUT. */
export const OCTETS_MAX_LUT = 50 * 1024 * 1024;
export const OCTETS_MAX_IMAGE = 100 * 1024 * 1024;
/** Vidéo à étalonner (relecture sécurité R45 n° 7) : 4 Go au plus. */
export const OCTETS_MAX_VIDEO = 4 * 1024 * 1024 * 1024;

/** Intensité bornée à [0 ; 1] (un nombre illisible vaut 1 : la LUT entière). PUR. */
export function intensiteBornee(v: unknown): number {
  const n = Number(v ?? 1);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
}

/**
 * Filtre FFmpeg des couleurs (fichier de LUT RELATIF au dossier de travail : un chemin Windows « C:\… » casserait la
 * syntaxe des filtres). `null` : aucune LUT (intensité 0). Vidéo : passage YUV BT.709 → RVB → YUV, comme le montage. PUR.
 */
export function filtreEtalonnage(fichierLut: string | null, nature: "image" | "video"): string {
  const lut = fichierLut ? [`lut3d=file=${fichierLut}:interp=tetrahedral`] : [];
  if (nature === "image") return ["format=gbrp", ...lut, "format=rgb24"].join(",");
  // `setparams` : depuis FFmpeg 7.1, `-color_primaries` / `-color_trc` en sortie ne passent plus à libx264 derrière un filtre.
  return ["scale=in_color_matrix=bt709:in_range=tv", "format=gbrp", ...lut, "scale=out_color_matrix=bt709:out_range=tv", "format=yuv420p", "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv"].join(",");
}

/** Arguments de l'étalonnage d'une vidéo (H.264 CRF 17, son recopié, `+faststart`). PUR (exécuté par le contrôle réel). */
export function argumentsEtalonnageVideo(avantEntree: string[], original: string, filtre: string, sortie: string): string[] {
  return ["-hide_banner", "-v", "error", "-y", ...avantEntree, "-i", original, "-map", "0:v:0", "-map", "0:a?", "-vf", filtre, "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-c:a", "copy", "-movflags", "+faststart", sortie];
}

async function dimensions(chemin: string, format: FormatEntree, signal: AbortSignal): Promise<{ largeur: number; hauteur: number }> {
  const json = await executer(FFPROBE, ["-v", "error", ...lectureLocale(format), "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", chemin], signal);
  const s = (JSON.parse(json) as { streams?: { width?: number; height?: number }[] }).streams?.[0];
  if (!s?.width || !s.height) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Image ou vidéo illisible." });
  return { largeur: s.width, hauteur: s.height };
}

export const etalonnage: Operation = async (demande, contexte) => {
  const nature: "image" | "video" | null = demande.entrees.image ? "image" : demande.entrees.video ? "video" : null;
  if (!nature) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Entrée « image » ou « video » manquante." });
  if (!demande.entrees.lut) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Entrée « lut » manquante." });
  const k = intensiteBornee(demande.parametres.intensite);

  // 1. La LUT, lue et vérifiée (une LUT cassée est refusée clairement), puis mélangée à l'intensité.
  const cheminLut = join(contexte.dossier, "lut.cube");
  await telecharger(demande.entrees.lut, cheminLut, contexte.signal, OCTETS_MAX_LUT);
  let taille = 0;
  let fichierLut: string | null = null;
  try {
    const lut = await lireCubeFichier(cheminLut);
    taille = lut.taille;
    if (k > 0) {
      fichierLut = "lut-melangee.cube";
      await writeFile(join(contexte.dossier, fichierLut), ecrireCube(k === 1 ? lut : melangerAvecIdentite(lut, k)));
    }
  } catch (e) {
    throw new ErreurRendu({ code: "refuse", reessayable: false, message: `LUT illisible : ${e instanceof Error ? e.message : "fichier .cube invalide"}` });
  }
  contexte.progression(15);

  // 2. L'original (jamais modifié), puis le nouveau fichier.
  const original = join(contexte.dossier, nature === "image" ? "original" : "original-video");
  await telecharger(nature === "image" ? demande.entrees.image : demande.entrees.video, original, contexte.signal, nature === "image" ? OCTETS_MAX_IMAGE : OCTETS_MAX_VIDEO);
  // Relecture sécurité R45 n° 6 : format reconnu à ses premiers octets puis IMPOSÉ, fichier local seulement.
  const format = await formatFichier(original, nature === "image" ? FORMATS_IMAGE : FORMATS_VIDEO);
  const { largeur, hauteur } = await dimensions(original, format, contexte.signal);
  contexte.progression(30);
  const filtre = filtreEtalonnage(fichierLut, nature);
  let sortie: string;
  let mime: string;
  if (nature === "image") {
    const png = demande.parametres.format === "png";
    sortie = join(contexte.dossier, png ? "apres.png" : "apres.jpg");
    mime = png ? "image/png" : "image/jpeg";
    await executerAvecErreurs(FFMPEG, ["-hide_banner", "-v", "error", "-y", ...lectureLocale(format), "-i", original, "-vf", filtre, "-frames:v", "1", ...(png ? [] : ["-q:v", "2"]), sortie], contexte.signal, contexte.dossier);
  } else {
    sortie = join(contexte.dossier, "apres.mp4");
    mime = "video/mp4";
    await executerAvecErreurs(
      FFMPEG,
      argumentsEtalonnageVideo(lectureLocale(format), original, filtre, sortie),
      contexte.signal,
      contexte.dossier,
    );
  }
  contexte.progression(85);
  await deposer(demande.sortie.urlDepot, sortie, mime, contexte.signal);
  return { mesures: { tailleLut: taille, intensite: k, largeur, hauteur } };
};
