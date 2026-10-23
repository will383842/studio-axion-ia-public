/**
 * Traitement du son en mémoire (lot M1) : décodage par FFmpeg en PCM flottant mono, coupures en fondu enchaîné
 * recalées sur un passage par zéro, reconnaissance des respirations, écriture d'un WAV. Les fonctions de calcul sont
 * PURES (testées sur des sons fabriqués) ; seules `decoderPcm` et `ecrireWav` touchent aux fichiers.
 */
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { ErreurRendu } from "../contrat.js";
import { FFMPEG } from "../outils.js";

export const FREQUENCE = 48_000;

export interface Intervalle {
  debutSec: number;
  finSec: number;
}

/** Décode n'importe quel son (MP3 HeyGen, WAV…) en PCM flottant 32 bits, mono, 48 kHz (ou `frequence`). */
export function decoderPcm(source: string, signal?: AbortSignal, frequence = FREQUENCE): Promise<Float32Array> {
  return new Promise((ok, ko) => {
    const p = spawn(FFMPEG, ["-v", "error", "-i", source, "-f", "f32le", "-ac", "1", "-ar", String(frequence), "-"], { signal, windowsHide: true });
    const morceaux: Buffer[] = [];
    let erreurs = "";
    p.stdout.on("data", (d: Buffer) => morceaux.push(d));
    p.stderr.on("data", (d: Buffer) => (erreurs = (erreurs + d.toString()).slice(-2000)));
    p.on("error", (e) => ko(new ErreurRendu({ code: "inconnu", reessayable: true, message: `ffmpeg : ${e.message}` })));
    p.on("close", (code) => {
      if (code !== 0) return ko(new ErreurRendu({ code: "inconnu", reessayable: false, message: `Son illisible : ${erreurs.trim().split("\n").pop() ?? code}` }));
      const b = Buffer.concat(morceaux);
      // Copie alignée (un Buffer peut commencer à un décalage non multiple de 4).
      const copie = new Float32Array(b.byteLength / 4);
      new Uint8Array(copie.buffer).set(b.subarray(0, copie.byteLength));
      ok(copie);
    });
  });
}

/** WAV PCM 16 bits mono : lisible par HeyGen (`audio_url`), par le navigateur et par Remotion. */
export function versWav(echantillons: Float32Array, frequence = FREQUENCE): Buffer {
  const donnees = echantillons.length * 2;
  const b = Buffer.alloc(44 + donnees);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + donnees, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(frequence, 24);
  b.writeUInt32LE(frequence * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(donnees, 40);
  for (let i = 0; i < echantillons.length; i++) {
    const x = Math.max(-1, Math.min(1, echantillons[i]));
    b.writeInt16LE(Math.round(x < 0 ? x * 0x8000 : x * 0x7fff), 44 + i * 2);
  }
  return b;
}

export async function ecrireWav(chemin: string, echantillons: Float32Array, frequence = FREQUENCE): Promise<void> {
  await writeFile(chemin, versWav(echantillons, frequence));
}

/** Passage par zéro le plus proche de `i`, à ± `fenetre` échantillons ; `i` lui-même s'il n'y en a pas. */
export function passageParZero(x: Float32Array, i: number, fenetre: number): number {
  for (let d = 0; d <= fenetre; d++) {
    for (const k of [i - d, i + d]) {
      if (k <= 0 || k >= x.length) continue;
      if (x[k] === 0 || Math.sign(x[k]) !== Math.sign(x[k - 1])) return k;
    }
  }
  return Math.max(0, Math.min(x.length, i));
}

export interface CoupureAppliquee extends Intervalle {
  /** Décalage dû au recalage sur un passage par zéro (ms). */
  recalageMs: number;
}

/**
 * Retire les intervalles demandés. Chaque raccord est recalé sur un passage par zéro (± 2 ms), puis fondu en enchaîné
 * CENTRÉ sur le raccord (`fonduMs`, à puissance constante) : la durée de sortie est exactement la durée de la source
 * moins les morceaux retirés, ce qui garde les horodatages calculés par le studio.
 */
export function appliquerCoupures(x: Float32Array, coupures: Intervalle[], fonduMs: number, frequence = FREQUENCE): { echantillons: Float32Array; appliquees: CoupureAppliquee[] } {
  const fenetre = Math.round(0.002 * frequence);
  const demi = Math.max(1, Math.round((fonduMs / 2000) * frequence));
  const triees = [...coupures].filter((c) => c.finSec > c.debutSec).sort((a, b) => a.debutSec - b.debutSec);
  const appliquees: CoupureAppliquee[] = [];
  const bornes: { a: number; b: number }[] = [];
  let precedent = 0;
  for (const c of triees) {
    const a0 = Math.round(c.debutSec * frequence);
    const b0 = Math.round(c.finSec * frequence);
    const a = Math.max(precedent, passageParZero(x, a0, fenetre));
    const b = Math.min(x.length, Math.max(a, passageParZero(x, b0, fenetre)));
    if (b <= a) continue;
    bornes.push({ a, b });
    appliquees.push({ debutSec: a / frequence, finSec: b / frequence, recalageMs: +(((a - a0 + (b - b0)) / frequence) * 500).toFixed(2) });
    precedent = b;
  }
  const retire = bornes.reduce((s, c) => s + (c.b - c.a), 0);
  const sortie = new Float32Array(x.length - retire);
  let o = 0;
  let lu = 0;
  for (const { a, b } of bornes) {
    sortie.set(x.subarray(lu, a), o);
    o += a - lu;
    lu = b;
    // Fondu centré sur le raccord : la fin de ce qui précède (après a) se mélange au début de ce qui suit (avant b).
    for (let k = -demi; k < demi; k++) {
      const pos = o + k;
      if (pos < 0 || pos >= sortie.length) continue;
      const p = (k + demi) / (2 * demi); // 0 → 1
      const gauche = a + k >= 0 && a + k < x.length ? x[a + k] : 0;
      const droite = b + k >= 0 && b + k < x.length ? x[b + k] : 0;
      sortie[pos] = gauche * Math.cos((p * Math.PI) / 2) + droite * Math.sin((p * Math.PI) / 2);
    }
  }
  sortie.set(x.subarray(lu), o);
  return { echantillons: sortie, appliquees };
}

/** Filtre passe-bande (biquad RBJ, Q ≈ 0,7) : énergie d'un souffle entre 1 et 5 kHz. */
export function passeBande(x: Float32Array, basHz: number, hautHz: number, frequence = FREQUENCE): Float32Array {
  const centre = Math.sqrt(basHz * hautHz);
  const largeur = Math.log2(hautHz / basHz);
  const w0 = (2 * Math.PI * centre) / frequence;
  const alpha = Math.sin(w0) * Math.sinh(((Math.log(2) / 2) * largeur * w0) / Math.sin(w0));
  const a0 = 1 + alpha;
  const b0 = alpha / a0;
  const b2 = -alpha / a0;
  const a1 = (-2 * Math.cos(w0)) / a0;
  const a2 = (1 - alpha) / a0;
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

const db = (energie: number) => 10 * Math.log10(energie + 1e-12);

/**
 * Respirations dans des blancs (plan B.4, v3.2) : un souffle est un bruit SANS voix, dont l'énergie est surtout entre
 * 1 et 5 kHz, entre −45 et −30 dB, pendant au moins 80 ms. Trames de 20 ms. Renvoie, par blanc, le plus long souffle.
 */
export function detecterRespirations(x: Float32Array, blancs: Intervalle[], frequence = FREQUENCE): Intervalle[] {
  const trame = Math.round(0.02 * frequence);
  const bande = passeBande(x, 1000, 5000, frequence);
  const sortie: Intervalle[] = [];
  for (const blanc of blancs) {
    const debut = Math.max(0, Math.round(blanc.debutSec * frequence));
    const fin = Math.min(x.length, Math.round(blanc.finSec * frequence));
    let meilleur: Intervalle | null = null;
    let courant: number | null = null;
    const clore = (jusqua: number) => {
      if (courant === null) return;
      const d = { debutSec: courant / frequence, finSec: jusqua / frequence };
      if (d.finSec - d.debutSec >= 0.08 && (!meilleur || d.finSec - d.debutSec > meilleur.finSec - meilleur.debutSec)) meilleur = d;
      courant = null;
    };
    for (let i = debut; i + trame <= fin; i += trame) {
      let total = 0;
      let haut = 0;
      let passages = 0;
      for (let k = i; k < i + trame; k++) {
        total += x[k] * x[k];
        haut += bande[k] * bande[k];
        if (k > i && Math.sign(x[k]) !== Math.sign(x[k - 1])) passages++;
      }
      const niveau = db(total / trame);
      const souffle = niveau >= -45 && niveau <= -30 && haut / Math.max(total, 1e-12) >= 0.45 && passages / trame >= 0.08;
      if (souffle && courant === null) courant = i;
      if (!souffle) clore(i);
    }
    clore(Math.floor((fin - debut) / trame) * trame + debut);
    if (meilleur) sortie.push(meilleur);
  }
  return sortie;
}

/** Niveau (dBFS) d'un intervalle : sert aux contrôles des pauses. */
export function niveauDb(x: Float32Array, intervalle: Intervalle, frequence = FREQUENCE): number {
  const a = Math.max(0, Math.round(intervalle.debutSec * frequence));
  const b = Math.min(x.length, Math.round(intervalle.finSec * frequence));
  let s = 0;
  for (let i = a; i < b; i++) s += x[i] * x[i];
  return db(s / Math.max(1, b - a));
}
