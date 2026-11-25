/**
 * Opération `collage-chapitres` (fiche VL-05, générateur « Vidéo longue »). Colle bout à bout les morceaux MUETS rendus
 * un par un (mode « plage » de `composition`), SANS réencodage de l'image (`-c copy`), puis pose la voix entière à la fin.
 *
 *  - passe 1 : `concat` + `-c copy` + `-an` → `video-muette.mp4` (les morceaux sortent tous du même rendu : mêmes réglages) ;
 *  - passe 2 (si `voix` est donnée) : l'image est recopiée telle quelle (`-c:v copy`), la voix est encodée en AAC 256 kb/s.
 * L'opération `assemblage` existante ne convient pas : elle lit la piste son de chaque morceau et réencode la vidéo.
 *
 * Paramètres : `morceaux` : noms d'entrées, dans l'ordre (au moins un) ; `voix` : nom d'entrée facultatif (WAV/MP3…).
 * Entrées : une adresse signée par nom. Mesures : `morceaux`, `voix` (0 ou 1) et `taille` (octets du fichier déposé).
 * Déclarée dans `contrat.ts` (union `OperationRendu`, liste `OPERATIONS`) et aiguillée vers cette fonction.
 * Au plus `MAX_MORCEAUX` morceaux par demande (refus net au-delà).
 */
import { join } from "node:path";
import { stat, writeFile } from "node:fs/promises";
import { ErreurRendu, type Operation } from "../contrat.js";
import { deposer, executer, FFMPEG, telecharger } from "../outils.js";

export interface ParametresCollage {
  morceaux: string[];
  voix?: string;
}

/** Plafond du nombre de morceaux d'une demande de collage. */
export const MAX_MORCEAUX = 200;

const refuser = (message: string): never => {
  throw new ErreurRendu({ code: "refuse", reessayable: false, message });
};

/** Lit et contrôle les paramètres (PUR). */
export function lireParametresCollage(p: Record<string, unknown>): ParametresCollage {
  if (!Array.isArray(p.morceaux) || !p.morceaux.length) return refuser("Aucun morceau à coller.");
  if (p.morceaux.length > MAX_MORCEAUX) return refuser(`Trop de morceaux à coller (${MAX_MORCEAUX} au plus).`);
  const morceaux = p.morceaux.map((m) => (typeof m === "string" && m.trim() ? m : refuser("Nom de morceau invalide.")));
  if (new Set(morceaux).size !== morceaux.length) return refuser("Un morceau est cité deux fois.");
  if (p.voix !== undefined && (typeof p.voix !== "string" || !p.voix.trim())) return refuser("Nom de voix invalide.");
  if (typeof p.voix === "string" && morceaux.includes(p.voix)) return refuser("La voix ne peut pas être aussi un morceau.");
  return { morceaux, ...(typeof p.voix === "string" ? { voix: p.voix } : {}) };
}

/** Contenu du fichier de liste de `concat` (PUR) : une ligne `file '…'` par chemin, apostrophes protégées. */
export function contenuListe(chemins: string[]): string {
  return chemins.map((c) => `file '${c.replace(/'/g, "'\\''")}'`).join("\n") + "\n";
}

/** Passe 1 : collage sans réencodage, sans piste son. */
export function argumentsCollage(liste: string, sortie: string): string[] {
  return ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", liste, "-c", "copy", "-an", "-movflags", "+faststart", sortie];
}

/** Passe 2 : l'image recopiée telle quelle, la voix entière posée en AAC. */
export function argumentsPoseVoix(video: string, voix: string, sortie: string): string[] {
  return ["-v", "error", "-y", "-i", video, "-i", voix, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-movflags", "+faststart", sortie];
}

export const collageChapitres: Operation = async (demande, contexte) => {
  const p = lireParametresCollage(demande.parametres);
  const noms = p.voix ? [...p.morceaux, p.voix] : p.morceaux;
  const fichiers: Record<string, string> = {};
  for (const [i, nom] of noms.entries()) {
    const url = Object.hasOwn(demande.entrees, nom) ? demande.entrees[nom] : undefined;
    if (typeof url !== "string" || !url) return refuser(`Entrée « ${nom} » manquante.`);
    fichiers[nom] = join(contexte.dossier, nom === p.voix ? "voix" : `morceau-${i}.mp4`);
    await telecharger(url, fichiers[nom], contexte.signal);
  }
  contexte.progression(30);
  const liste = join(contexte.dossier, "liste.txt");
  await writeFile(liste, contenuListe(p.morceaux.map((m) => fichiers[m])));
  const muette = join(contexte.dossier, "video-muette.mp4");
  await executer(FFMPEG, argumentsCollage(liste, muette), contexte.signal);
  contexte.progression(70);
  let final = muette;
  if (p.voix) {
    final = join(contexte.dossier, "collage.mp4");
    await executer(FFMPEG, argumentsPoseVoix(muette, fichiers[p.voix], final), contexte.signal);
  }
  contexte.progression(90);
  // Une mesure ne fait jamais échouer une vidéo : taille lue avant le dépôt, ignorée si illisible ou nulle.
  const taille = await stat(final).then((s) => s.size, () => undefined);
  await deposer(demande.sortie.urlDepot, final, "video/mp4", contexte.signal);
  contexte.progression(100);
  return { mesures: { morceaux: p.morceaux.length, voix: p.voix ? 1 : 0, ...(taille && taille > 0 ? { taille } : {}) } };
};
