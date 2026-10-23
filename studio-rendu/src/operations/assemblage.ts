/**
 * Opération `assemblage` (file courte, générateur G6 et G6b). Met bout à bout des MORCEAUX pris dans plusieurs
 * entrées, chacun coupé sur une coupe calculée par le studio (`src/briques/declinaison`) ; rien n'est décidé ici.
 *
 *  - `parametres.sortie = "wav"` (G6, version par réseau) : morceaux de SONS (audio maître de la mère pour le corps,
 *    son neuf pour le début et la fin). Le corps garde les échantillons de la mère tels quels ; chaque raccord est
 *    recalé sur un passage par zéro et fondu (`fonduMs`, 6-20 ms) aux deux bords seulement. WAV 48 kHz mono.
 *  - `parametres.sortie = "mp4"` (G6b, « je lis ») : morceaux de PRISES filmées (image et son), recadrés au format
 *    demandé (`video.largeur` × `video.hauteur`, `video.fps`), son fondu aux raccords ; H.264 CRF 17, AAC 256 kb/s.
 *
 * Option `tempo` (sortie `wav` seulement, 0,90 à 1,25) : le WAV assemblé passe ensuite par `atempo` de FFmpeg (son
 * accéléré ou ralenti, hauteur gardée). Absente : aucune passe de plus, fichier inchangé.
 *
 * Mesures : `dureeSec`, `morceaux`, et la place de chaque morceau dans le fichier produit (`morceau.<i>.debut`) ; avec
 * `tempo`, ces durées et places sont celles d'APRÈS la passe, plus `tempo` et `dureeAvantTempoSec`.
 * Entrées : une adresse signée par nom (`morceaux[i].entree`).
 */
import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { ErreurRendu, type Operation } from "../contrat.js";
import { decoderPcm, FREQUENCE, passageParZero, versWav } from "../audio/pcm.js";
import { optionsEntreePrise } from "../entrees-video.js";
import { deposer, executer, FFMPEG, telecharger } from "../outils.js";

export interface MorceauAssemblage {
  entree: string;
  deSec: number;
  aSec: number;
}

export interface ParametresAssemblage {
  sortie: "wav" | "mp4";
  morceaux: MorceauAssemblage[];
  fonduMs?: number;
  video?: { largeur: number; hauteur: number; fps: number };
  /**
   * Facecam lot C (B.8) : prises 10 bits (sortie de la passe image) → assemblage en intermédiaire 10 bits quasi sans
   * perte (x264 10 bits, CRF 8) : aucune compression 8 bits avant la composition. Absent : H.264 8 bits CRF 17 (inchangé).
   */
  source10bits?: boolean;
  /** Son accéléré (> 1) ou ralenti (< 1) après assemblage, sortie `wav` seulement, de 0,90 à 1,25. */
  tempo?: number;
}

/** Bornes de l'option `tempo`. */
export const TEMPO = { min: 0.9, max: 1.25 };

function lireParametres(p: Record<string, unknown>): ParametresAssemblage {
  const sortie = p.sortie;
  if (sortie !== "wav" && sortie !== "mp4") throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Sortie d'assemblage inconnue." });
  if (!Array.isArray(p.morceaux) || !p.morceaux.length) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Aucun morceau à assembler." });
  const morceaux = p.morceaux.map((m) => {
    const x = m as Partial<MorceauAssemblage>;
    if (typeof x.entree !== "string" || typeof x.deSec !== "number" || typeof x.aSec !== "number" || !(x.aSec > x.deSec) || x.deSec < 0) {
      throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Morceau invalide." });
    }
    return { entree: x.entree, deSec: x.deSec, aSec: x.aSec };
  });
  const fonduMs = Number(p.fonduMs ?? 12);
  if (!(fonduMs >= 6 && fonduMs <= 20)) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Fondu hors limites (6 à 20 ms)." });
  const v = p.video as ParametresAssemblage["video"] | undefined;
  if (sortie === "mp4" && (!v || !(v.largeur > 0) || !(v.hauteur > 0) || !(v.fps > 0))) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Format d'image manquant." });
  if (p.tempo !== undefined) {
    if (sortie !== "wav") throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Le tempo ne s'applique qu'au son (sortie wav)." });
    if (typeof p.tempo !== "number" || !(p.tempo >= TEMPO.min && p.tempo <= TEMPO.max)) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Tempo hors limites (0,90 à 1,25)." });
  }
  return { sortie, morceaux, fonduMs, video: v, ...(p.source10bits === true ? { source10bits: true } : {}), ...(typeof p.tempo === "number" ? { tempo: p.tempo } : {}) };
}

/** Arguments FFmpeg de la passe de tempo : WAV 48 kHz mono 16 bits, en-tête sans métadonnées. */
export function argumentsTempo(entree: string, sortie: string, tempo: number): string[] {
  return ["-v", "error", "-y", "-i", entree, "-af", `atempo=${tempo}`, "-ar", String(FREQUENCE), "-ac", "1", "-c:a", "pcm_s16le", "-map_metadata", "-1", "-bitexact", sortie];
}

/** Durée d'un WAV PCM d'après ses blocs `fmt ` et `data` (s). PUR. */
export function dureeWav(b: Buffer): number {
  let octetsParSec = 0;
  for (let i = 12; i + 8 <= b.length; ) {
    const nom = b.toString("ascii", i, i + 4);
    const taille = b.readUInt32LE(i + 4);
    if (nom === "fmt ") octetsParSec = b.readUInt32LE(i + 16);
    if (nom === "data") {
      if (!octetsParSec) break;
      return Math.min(taille, b.length - i - 8) / octetsParSec;
    }
    i += 8 + taille + (taille % 2);
  }
  throw new ErreurRendu({ code: "inconnu", reessayable: false, message: "WAV illisible après le tempo." });
}

/**
 * Sons bout à bout (PUR sur les échantillons) : chaque morceau est copié tel quel, ses deux bords recalés sur un passage
 * par zéro (± 2 ms) et fondus. Renvoie aussi le début de chaque morceau dans le résultat.
 */
export function assemblerEchantillons(sources: Record<string, Float32Array>, morceaux: MorceauAssemblage[], fonduMs = 12, frequence = FREQUENCE): { echantillons: Float32Array; debuts: number[] } {
  const fondu = Math.round((fonduMs / 1000) * frequence);
  const fenetre = Math.round(0.002 * frequence);
  const parts: Float32Array[] = [];
  const debuts: number[] = [];
  let total = 0;
  for (const m of morceaux) {
    const x = sources[m.entree];
    if (!x) throw new ErreurRendu({ code: "refuse", reessayable: false, message: `Entrée « ${m.entree} » manquante.` });
    const a = Math.max(0, passageParZero(x, Math.round(m.deSec * frequence), fenetre));
    const b = Math.min(x.length, passageParZero(x, Math.round(m.aSec * frequence), fenetre));
    const part = x.slice(a, Math.max(a, b));
    const n = Math.min(fondu, Math.floor(part.length / 2));
    for (let i = 0; i < n; i++) {
      const g = i / n;
      part[i] *= g;
      part[part.length - 1 - i] *= g;
    }
    debuts.push(total / frequence);
    parts.push(part);
    total += part.length;
  }
  const echantillons = new Float32Array(total);
  let k = 0;
  for (const p of parts) {
    echantillons.set(p, k);
    k += p.length;
  }
  return { echantillons, debuts };
}

/**
 * Arguments FFmpeg des prises bout à bout (image recadrée au format, son fondu aux raccords). `optionsEntrees[i]` :
 * options placées avant le `-i` de la prise i (format imposé, fichier local seulement : `entrees-video.ts`).
 */
export function argumentsAssemblageVideo(fichiers: string[], morceaux: MorceauAssemblage[], video: NonNullable<ParametresAssemblage["video"]>, fonduMs: number, sortie: string, optionsEntrees: string[][] = [], source10bits = false): string[] {
  const entrees = [...new Set(morceaux.map((m) => m.entree))];
  const args = ["-v", "error", "-y"];
  fichiers.forEach((f, i) => args.push(...(optionsEntrees[i] ?? []), "-i", f));
  const f = fonduMs / 1000;
  const filtres: string[] = [];
  morceaux.forEach((m, i) => {
    const k = entrees.indexOf(m.entree);
    const d = (m.aSec - m.deSec).toFixed(3);
    filtres.push(
      `[${k}:v]trim=start=${m.deSec.toFixed(3)}:end=${m.aSec.toFixed(3)},setpts=PTS-STARTPTS,scale=${video.largeur}:${video.hauteur}:force_original_aspect_ratio=increase,crop=${video.largeur}:${video.hauteur},fps=${video.fps},setsar=1[v${i}]`,
      `[${k}:a]atrim=start=${m.deSec.toFixed(3)}:end=${m.aSec.toFixed(3)},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=mono,afade=t=in:d=${f},afade=t=out:st=${Math.max(0, +d - f).toFixed(3)}:d=${f}[a${i}]`,
    );
  });
  filtres.push(`${morceaux.map((_, i) => `[v${i}][a${i}]`).join("")}concat=n=${morceaux.length}:v=1:a=1[v][a]`);
  const codec = source10bits ? ["-c:v", "libx264", "-crf", "8", "-preset", "medium", "-pix_fmt", "yuv420p10le", "-profile:v", "high10"] : ["-c:v", "libx264", "-crf", "17", "-preset", "medium", "-pix_fmt", "yuv420p"];
  args.push("-filter_complex", filtres.join(";"), "-map", "[v]", "-map", "[a]", ...codec, "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-movflags", "+faststart", sortie);
  return args;
}

/** Le travail lui-même, sur des fichiers locaux (nom d'entrée → chemin) : sert à l'opération ET aux outils du poste. */
export async function assemblerFichiers(fichiers: Record<string, string>, brut: Record<string, unknown>, dossier: string, signal?: AbortSignal): Promise<{ chemin: string; mesures: Record<string, number> }> {
  const p = lireParametres(brut);
  const entrees = [...new Set(p.morceaux.map((m) => m.entree))];
  for (const e of entrees) if (!fichiers[e]) throw new ErreurRendu({ code: "refuse", reessayable: false, message: `Entrée « ${e} » manquante.` });
  if (p.sortie === "wav") {
    const sources: Record<string, Float32Array> = {};
    for (const e of entrees) sources[e] = await decoderPcm(fichiers[e], signal);
    const { echantillons, debuts } = assemblerEchantillons(sources, p.morceaux, p.fonduMs);
    const chemin = join(dossier, "assemblage.wav");
    if (p.tempo === undefined) {
      await writeFile(chemin, versWav(echantillons));
      return { chemin, mesures: { dureeSec: echantillons.length / FREQUENCE, morceaux: p.morceaux.length, ...Object.fromEntries(debuts.map((d, i) => [`morceau.${i}.debut`, +d.toFixed(4)])) } };
    }
    // Tempo : le WAV assemblé est écrit à part, puis une passe `atempo` produit le fichier rendu.
    const avant = join(dossier, "assemblage-avant-tempo.wav");
    await writeFile(avant, versWav(echantillons));
    await executer(FFMPEG, argumentsTempo(avant, chemin, p.tempo), signal);
    const t = p.tempo;
    return {
      chemin,
      mesures: {
        dureeSec: dureeWav(await readFile(chemin)),
        morceaux: p.morceaux.length,
        ...Object.fromEntries(debuts.map((d, i) => [`morceau.${i}.debut`, +(d / t).toFixed(4)])),
        tempo: t,
        dureeAvantTempoSec: echantillons.length / FREQUENCE,
      },
    };
  }
  const chemin = join(dossier, "assemblage.mp4");
  // Lot R7 (sécurité n° 3) : chaque prise est relue d'après ses premiers octets, en fichier local seulement.
  const locaux = entrees.map((e) => fichiers[e]);
  const options = await Promise.all(locaux.map(optionsEntreePrise));
  await executer(FFMPEG, argumentsAssemblageVideo(locaux, p.morceaux, p.video!, p.fonduMs ?? 12, chemin, options, !!p.source10bits), signal);
  let t = 0;
  const debuts: Record<string, number> = {};
  p.morceaux.forEach((m, i) => {
    debuts[`morceau.${i}.debut`] = +t.toFixed(4);
    t += m.aSec - m.deSec;
  });
  return { chemin, mesures: { dureeSec: +t.toFixed(4), morceaux: p.morceaux.length, ...debuts } };
}

export const assemblage: Operation = async (demande, contexte) => {
  const p = lireParametres(demande.parametres);
  const fichiers: Record<string, string> = {};
  for (const nom of new Set(p.morceaux.map((m) => m.entree))) {
    const url = demande.entrees[nom];
    if (!url) throw new ErreurRendu({ code: "refuse", reessayable: false, message: `Entrée « ${nom} » manquante.` });
    fichiers[nom] = join(contexte.dossier, `entree-${nom}`);
    await telecharger(url, fichiers[nom], contexte.signal);
  }
  contexte.progression(30);
  const r = await assemblerFichiers(fichiers, demande.parametres, contexte.dossier, contexte.signal);
  contexte.progression(85);
  await deposer(demande.sortie.urlDepot, r.chemin, p.sortie === "wav" ? "audio/wav" : "video/mp4", contexte.signal);
  contexte.progression(100);
  return { mesures: r.mesures };
};
