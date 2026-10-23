/**
 * COMMANDES FFMPEG DU FORMAT « IMAGE → VIDÉO » EXÉCUTÉES PAR LE STUDIO (panne du 15/10 : FFmpeg absent du conteneur du
 * studio, la lecture de l'image s'arrêtait). Fichier PUR et SANS IMPORT : il est copié tel quel dans l'image du studio et
 * lu par `deploiement/studio/controle-ffmpeg-iv.mjs` (Node, types effacés) qui EXÉCUTE ces commandes avant toute mise
 * en ligne (`deploiement/verifier-outils-video.sh`). Toute commande `execFile("ffmpeg", …)` du format côté studio
 * prend ses arguments ICI et figure dans `COMMANDES_FFMPEG_IV` (test `tests/image-video/ffmpeg-studio.test.ts`).
 */

/** Morceau à produire : recadrage dans l'image source puis taille exacte de sortie. */
export interface MorceauFfmpeg {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  sortieLargeur: number;
  sortieHauteur: number;
}

/** Arguments FFmpeg d'un morceau : recadrage puis mise à l'échelle exacte, une image PNG sur la sortie standard (PUR). */
export function argumentsMorceau(entree: string, m: MorceauFfmpeg): string[] {
  return ["-v", "error", "-nostdin", "-i", entree, "-frames:v", "1", "-vf", `crop=${m.largeur}:${m.hauteur}:${m.x}:${m.y},scale=${m.sortieLargeur}:${m.sortieHauteur}:flags=lanczos`, "-f", "image2pipe", "-c:v", "png", "-"];
}

/** Arguments FFmpeg : images noires et figées (0,5 s au plus attendues, Q24), sans sortie (PUR). */
export function argumentsNoirEtFige(entree: string): string[] {
  return ["-hide_banner", "-nostats", "-nostdin", "-i", entree, "-an", "-vf", "blackdetect=d=0.04:pix_th=0.10,freezedetect=n=-60dB:d=0.1", "-f", "null", "-"];
}

/**
 * Arguments FFmpeg : son BRUT (MP3 HeyGen) → WAV PCM 16 bits mono, À SA FRÉQUENCE (aucun rééchantillonnage), pour mesurer
 * ses silences (Q17, 15/10 v-dd3049053f88). Même décodeur que `studio-rendu` (même FFmpeg statique) : les silences mesurés
 * et les coupes de la recette (`atrim` sur le même MP3) sont sur la MÊME horloge ; l'en-tête LAME du MP3 (retard de
 * l'encodeur) est compensé par le décodeur. `-bitexact` : aucun bloc de métadonnées ajouté (PUR).
 */
export function argumentsSonWav(entree: string, sortie: string): string[] {
  return ["-v", "error", "-nostdin", "-y", "-i", entree, "-map", "0:a:0", "-ac", "1", "-c:a", "pcm_s16le", "-bitexact", "-f", "wav", sortie];
}

const arrondi = (x: number) => Math.round(x * 1000) / 1000;

/** Lit la plus longue image noire et la plus longue image figée dans le journal de FFmpeg (PUR). */
export function lireNoirEtFige(journal: string, dureeSec: number): { noirMaxSec: number; figeMaxSec: number } {
  const noirs = [...journal.matchAll(/black_duration:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  const figes = [...journal.matchAll(/freeze_duration:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  // Une image figée jusqu'à la fin n'a pas de durée dans le journal : elle court jusqu'à la fin du fichier.
  const debuts = [...journal.matchAll(/freeze_start:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  const fins = [...journal.matchAll(/freeze_end:\s*([\d.]+)/g)].length;
  if (debuts.length > fins) figes.push(Math.max(0, dureeSec - debuts[debuts.length - 1]));
  const max = (l: number[]) => arrondi(l.filter(Number.isFinite).reduce((a, b) => Math.max(a, b), 0));
  return { noirMaxSec: max(noirs), figeMaxSec: max(figes) };
}

/** Un passage d'image figée (FFmpeg `freezedetect`) : début et durée, en secondes. */
export interface PassageFigeIV {
  debutSec: number;
  dureeSec: number;
}

/** Les passages d'image figée du journal de FFmpeg, dans l'ordre ; un passage sans fin court jusqu'à la fin du fichier (PUR). */
export function lirePassagesFiges(journal: string, dureeSec: number): PassageFigeIV[] {
  const debuts = [...journal.matchAll(/freeze_start:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  const durees = [...journal.matchAll(/freeze_duration:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  return debuts
    .map((debutSec, k) => ({ debutSec: arrondi(debutSec), dureeSec: arrondi(k < durees.length ? durees[k] : Math.max(0, dureeSec - debutSec)) }))
    .filter((p) => Number.isFinite(p.debutSec) && Number.isFinite(p.dureeSec));
}

/**
 * Image figée PENDANT QUE LA VOIX NE PARLE PAS (décision de Will du 17/10) : pour chaque passage figé, le plus long
 * moment sans mot dit qu'il contient (bords compris) ; le plus long de tous. Un écran tenu le temps d'une phrase (la voix
 * parle, les sous-titres avancent) ne compte donc que pour ses respirations ; un passage figé dans un silence ou à la
 * fin compte en entier. `paroles` : les mots dits (début, fin), dans n'importe quel ordre (PUR).
 */
export function figeHorsVoixMaxSec(passages: readonly PassageFigeIV[], paroles: readonly { debutSec: number; finSec: number }[]): number {
  const mots = [...paroles].filter((m) => m.finSec > m.debutSec).sort((a, b) => a.debutSec - b.debutSec);
  let max = 0;
  for (const p of passages) {
    const fin = p.debutSec + p.dureeSec;
    let curseur = p.debutSec;
    let trou = 0;
    for (const m of mots) {
      if (m.finSec <= curseur) continue;
      if (m.debutSec >= fin) break;
      trou = Math.max(trou, m.debutSec - curseur);
      curseur = Math.max(curseur, m.finSec);
    }
    trou = Math.max(trou, fin - curseur);
    max = Math.max(max, trou);
  }
  return arrondi(max);
}

/** Seuils de l'image figée (décision de Will du 17/10) : 2,5 s pendant que la voix parle, 0,5 s hors voix. */
export const FIGE_IV = Object.freeze({ sousVoixMaxSec: 2.5, horsVoixMaxSec: 0.5 });

/** Les passages figés refusés par la règle : plus longs que 2,5 s, ou plus de 0,5 s sans voix (PUR). */
export function passagesFigesRefusesIV(passages: readonly PassageFigeIV[], paroles: readonly { debutSec: number; finSec: number }[]): PassageFigeIV[] {
  return passages.filter((p) => p.dureeSec > FIGE_IV.sousVoixMaxSec + 1e-9 || figeHorsVoixMaxSec([p], paroles) > FIGE_IV.horsVoixMaxSec + 1e-9);
}

/** Fabriques d'arguments exécutées par le studio ET par le contrôle avant mise en ligne (la liste fait foi). */
export const COMMANDES_FFMPEG_IV = ["argumentsMorceau", "argumentsNoirEtFige", "argumentsSonWav"] as const;
