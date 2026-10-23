/**
 * CHAÎNE DE LA VOIX ET MIXAGE (lot M4 ; plan B.4, B.7 « Son », v3.2). Ordre écrit, `traitementVoix: 'sec'` :
 *
 *   passe-haut 80 Hz (12 dB/oct) → [atténuation 1-2 dB vers 250-400 Hz, seulement si demandée]
 *   → [compression douce 3:1 au plus, SEULEMENT si l'écart fort / faible (LRA) du son brut dépasse 3 LU]
 *   → de-esser 6-8 kHz (4-6 dB au plus) → présence +1,8 dB vers 4 kHz → gain vers −14 LUFS (mesuré, linéaire)
 *   → limiteur (crête vraie visée ≤ −1,5 dBTP, avec marge pour l'encodage AAC).
 *
 * Voix en MONO centrée (export stéréo double mono). Ton de pièce continu sous la voix, de la première à la dernière
 * image, bouclé avec un fondu de 0,75 s et un départ aléatoire, à −40/−45 dB ; sans enregistrement, un ton de pièce
 * de synthèse (bruit doux, grave) le remplace pour qu'aucune pause ne tombe dans un silence numérique.
 * Les fonctions qui construisent les filtres et qui bouclent le ton sont PURES (testées) ; `preparerSon` exécute.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { decoderPcm, FREQUENCE } from "../audio/pcm.js";
import { executerAvecErreurs, FFMPEG } from "../outils.js";
import { lireLoudnorm, mesurerFichier, type MesuresSon } from "./mesure.js";
import { poserBruitages, type BruitageAMixer } from "./bruitages.js";

export interface ReglagesChaine {
  passeHautHz: number;
  /** Atténuation vers 320 Hz (dB, 0 = rien), si la voix sonne « boîte ». */
  attenuationBoiteDb?: number;
  /** Compression : seulement si `lraBrut` > `seuilLra`. */
  lraBrut?: number;
  seuilLra: number;
  ratioCompression: number;
  /** Niveau intégré du son brut (sert à placer le seuil de la compression). */
  niveauBrutLufs?: number;
}

/** Filtres FFmpeg de la chaîne de la voix (sans le gain final), dans l'ordre du plan. */
export function filtresVoix(r: ReglagesChaine): string[] {
  const f = [`highpass=f=${r.passeHautHz}:poles=2`];
  if (r.attenuationBoiteDb && r.attenuationBoiteDb > 0) f.push(`equalizer=f=320:t=q:w=1.2:g=-${Math.min(2, r.attenuationBoiteDb).toFixed(1)}`);
  if (r.lraBrut !== undefined && r.lraBrut > r.seuilLra) {
    // Seuil 4 dB au-dessus du niveau moyen : seules les syllabes fortes sont tenues (4-6 dB de réduction au plus).
    const seuilDb = Math.min(-10, (r.niveauBrutLufs ?? -20) + 4);
    f.push(`acompressor=threshold=${Math.pow(10, seuilDb / 20).toFixed(5)}:ratio=${Math.min(3, r.ratioCompression)}:attack=12:release=140:knee=4:makeup=1`);
  }
  f.push("deesser=i=0.5:m=0.5:f=0.5:s=o");
  f.push("equalizer=f=4000:t=q:w=1.0:g=1.8");
  return f;
}

/** Gain (dB) qui amène le niveau mesuré à la cible. */
export function gainVersCible(mesureLufs: number, cibleLufs: number): number {
  return +(cibleLufs - mesureLufs).toFixed(2);
}

/** Atténuation de la voix mono posée au centre d'un fichier stéréo (loi de panoramique −3 dB, chaque canal). */
export const PANORAMIQUE_DB = 3.01;
/** Voix mono centrée en stéréo, −3 dB par voie (même niveau intégré qu'en mono). */
export const PAN_VOIX_STEREO = "pan=stereo|c0=0.7071*c0|c1=0.7071*c0";

/**
 * Limiteur final, sur la voix MONO : son plafond est placé pour que, une fois la voix posée au centre du fichier
 * stéréo (−3 dB par canal) et encodée en AAC (qui ajoute des crêtes), la crête vraie reste sous la limite, avec une
 * marge. Il ne dépasse jamais −0,3 dBFS (aucun écrêtage numérique).
 */
export function filtreLimiteur(creteVraieMaxDbtp: number, margeDb = 1.2): string {
  const plafond = Math.min(Math.pow(10, -0.3 / 20), Math.pow(10, (creteVraieMaxDbtp - margeDb + PANORAMIQUE_DB) / 20));
  return `alimiter=limit=${plafond.toFixed(4)}:attack=4:release=60:level=false`;
}

/** Générateur pseudo-aléatoire stable (départ de la boucle, ton de synthèse). */
export function aleatoire(graine: number): () => number {
  let x = (graine * 2654435761) >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 0xffffffff;
  };
}

/**
 * Boucle le ton de pièce sur `longueur` échantillons : départ aléatoire, fondu enchaîné à puissance constante de
 * `fonduSec` à chaque raccord (on n'entend pas la boucle). Une source plus longue que la vidéo n'est pas bouclée.
 */
export function bouclerTon(source: Float32Array, longueur: number, graine: number, fonduSec = 0.75, frequence = FREQUENCE): Float32Array {
  const sortie = new Float32Array(longueur);
  const n = source.length;
  if (!n) return sortie;
  const fondu = Math.max(1, Math.min(Math.floor(fonduSec * frequence), Math.floor(n / 3)));
  const depart = Math.floor(aleatoire(graine)() * Math.max(1, n - fondu));
  let debut = 0;
  let lecture = depart;
  let duree = n - depart;
  let premier = true;
  while (debut < longueur) {
    for (let k = 0; k < duree && debut + k < longueur; k++) {
      const v = source[lecture + k];
      const i = debut + k;
      if (!premier && k < fondu) {
        // Fondu enchaîné à puissance constante avec la queue du passage précédent, déjà écrite.
        const a = k / fondu;
        sortie[i] = sortie[i] * Math.cos((a * Math.PI) / 2) + v * Math.sin((a * Math.PI) / 2);
      } else sortie[i] = v;
    }
    debut += Math.max(1, duree - fondu);
    lecture = 0;
    duree = n;
    premier = false;
  }
  return sortie;
}

/** Ton de pièce de SYNTHÈSE (aucun enregistrement) : bruit brun doux, filtré, au niveau RMS demandé. */
export function tonDeSynthese(longueur: number, niveauDb: number, graine: number): Float32Array {
  const r = aleatoire(graine + 17);
  const x = new Float32Array(longueur);
  let brun = 0;
  for (let i = 0; i < longueur; i++) {
    brun = 0.985 * brun + 0.15 * (r() * 2 - 1);
    x[i] = brun;
  }
  return ajusterRms(x, niveauDb);
}

/** Niveau RMS d'un signal, en dBFS. */
export function rmsDb(x: Float32Array): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return 10 * Math.log10(s / Math.max(1, x.length) + 1e-20);
}

/** Ramène le niveau RMS d'un signal à `niveauDb` (en place, renvoie le signal). */
export function ajusterRms(x: Float32Array, niveauDb: number): Float32Array {
  const g = Math.pow(10, (niveauDb - rmsDb(x)) / 20);
  for (let i = 0; i < x.length; i++) x[i] *= g;
  return x;
}

/** WAV flottant 32 bits mono (aucune perte avant l'encodage final). */
export function versWavFlottant(x: Float32Array, frequence = FREQUENCE): Buffer {
  const donnees = x.length * 4;
  const b = Buffer.alloc(44 + donnees);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + donnees, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(3, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(frequence, 24);
  b.writeUInt32LE(frequence * 4, 28);
  b.writeUInt16LE(4, 32);
  b.writeUInt16LE(32, 34);
  b.write("data", 36);
  b.writeUInt32LE(donnees, 40);
  for (let i = 0; i < x.length; i++) b.writeFloatLE(x[i], 44 + i * 4);
  return b;
}

export interface EntreeSon {
  voix: string;
  tonPiece?: string;
  dureeSec: number;
  dossier: string;
  passeHautHz: number;
  seuilLraCompression: number;
  ratioCompression: number;
  lufs: number;
  creteVraieMaxDbtp: number;
  tonPieceDb: number;
  graine: number;
  signal?: AbortSignal;
  /** Correction supplémentaire (dB) quand un premier export a dépassé la crête (boucle de l'opération). */
  correctionDb?: number;
  /** Lot « bruitages » (02/10) : sons posés sous la voix (`bruitages.ts`). Absents : chaîne identique à avant. */
  bruitages?: { chemin: string; debutSec: number; gainDb: number; passeHautHz: number }[];
}

export interface SonPrepare {
  /** WAV mono flottant : voix traitée + ton de pièce, à la durée de la vidéo. */
  chemin: string;
  lraBrut: number;
  compression: boolean;
  gainDb: number;
  tonDeSynthese: boolean;
  /** Lot « bruitages » : piste des sons seuls (`bruitages.wav`) et niveaux (voix, chaque son), si des sons sont posés. */
  bruitages?: { chemin: string; voixDb: number; sons: { debutSec: number; niveauDb: number; ecartDb: number }[] };
}

/**
 * Prépare le son final (avant l'encodage AAC) : mesure du son brut (LRA, niveau), chaîne de la voix, gain mesuré vers
 * la cible, limiteur, puis ton de pièce bouclé ajouté sous la voix sur toute la durée.
 */
export async function preparerSon(e: EntreeSon): Promise<SonPrepare> {
  const mesureLoud = async (entree: string, filtres: string[]) => {
    const { erreurs } = await executerAvecErreurs(FFMPEG, ["-hide_banner", "-nostats", "-i", entree, "-af", [...filtres, "loudnorm=I=-14:TP=-1.5:LRA=20:print_format=json"].join(","), "-f", "null", "-"], e.signal);
    return lireLoudnorm(erreurs);
  };
  const brut = await mesureLoud(e.voix, []);
  const reglages: ReglagesChaine = { passeHautHz: e.passeHautHz, lraBrut: brut.lra, niveauBrutLufs: brut.i, seuilLra: e.seuilLraCompression, ratioCompression: e.ratioCompression };
  const chaine = filtresVoix(reglages);
  const traitee = await mesureLoud(e.voix, chaine);
  let gainDb = gainVersCible(traitee.i, e.lufs) + (e.correctionDb ?? 0);
  const longueur = Math.round(e.dureeSec * FREQUENCE);
  let ton: Float32Array;
  let synthese = false;
  if (e.tonPiece) {
    const source = await decoderPcm(e.tonPiece, e.signal);
    ton = ajusterRms(bouclerTon(source, longueur, e.graine), e.tonPieceDb);
  } else {
    ton = tonDeSynthese(longueur, e.tonPieceDb, e.graine);
    synthese = true;
  }
  const voixTraitee = join(e.dossier, "voix-traitee.wav");
  const chemin = join(e.dossier, "son-final.wav");
  const sons: BruitageAMixer[] = [];
  for (const b of e.bruitages ?? []) sons.push({ pcm: await decoderPcm(b.chemin, e.signal), debutSec: b.debutSec, gainDb: b.gainDb, passeHautHz: b.passeHautHz });
  let poses: ReturnType<typeof poserBruitages> | undefined;
  // Le limiteur retire du niveau sur une voix aux crêtes marquées : on mesure le mélange et on corrige le gain
  // (au plus 3 passes), jusqu'à la cible à ± 0,3 LU.
  for (let passe = 0; passe < 3; passe++) {
    await executerAvecErreurs(
      FFMPEG,
      ["-hide_banner", "-y", "-i", e.voix, "-af", [...chaine, `volume=${gainDb.toFixed(2)}dB`, filtreLimiteur(e.creteVraieMaxDbtp), `aresample=${FREQUENCE}`, "apad", `atrim=0:${e.dureeSec.toFixed(3)}`].join(","), "-ac", "1", "-c:a", "pcm_f32le", voixTraitee],
      e.signal,
    );
    const voix = await decoderPcm(voixTraitee, e.signal);
    const mix = new Float32Array(longueur);
    for (let i = 0; i < longueur; i++) mix[i] = (voix[i] ?? 0) + ton[i];
    // Bruitages : sous la voix traitée de CETTE passe, la voix elle-même n'est jamais modifiée.
    if (sons.length) poses = poserBruitages(mix, voix.length >= longueur ? voix.subarray(0, longueur) : voix, sons);
    await writeFile(chemin, versWavFlottant(mix));
    const mesure = await mesurerFichier(chemin, [], e.signal);
    const ecart = e.lufs + (e.correctionDb ?? 0) - mesure.lufs;
    if (!Number.isFinite(ecart) || Math.abs(ecart) <= 0.3) break;
    gainDb += ecart;
  }
  let bruitages: SonPrepare["bruitages"];
  if (poses) {
    const piste = join(e.dossier, "bruitages.wav");
    await writeFile(piste, versWavFlottant(poses.piste));
    bruitages = { chemin: piste, voixDb: +poses.voixDb.toFixed(2), sons: poses.sons };
  }
  return { chemin, lraBrut: brut.lra, compression: chaine.some((f) => f.startsWith("acompressor")), gainDb, tonDeSynthese: synthese, ...(bruitages ? { bruitages } : {}) };
}

export type { MesuresSon };
export { mesurerFichier };
