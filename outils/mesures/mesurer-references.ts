/**
 * MESURE DES VIDÉOS DE RÉFÉRENCE (moteur avocat, lot M1 ; plan B.10 « Mesure des références »).
 * Ce qui restait à mesurer après le 01/10 : débit, coupes, part du temps en illustrations. Sur le poste, avec FFmpeg,
 * sans aucun service payant ni réseau.
 *
 *  - COUPES : images réduites à 36×64 en niveaux de gris ; une coupe est un pic de différence entre deux images
 *    (au moins 3 fois la médiane locale sur ± 0,5 s, et au moins 9 niveaux), plans d'au moins 0,4 s. Les recadrages
 *    francs (100 → 120 %) sont des coupes, les zooms lents n'en sont pas.
 *  - ILLUSTRATIONS : chaque plan est décrit par son image du milieu (part de pixels sombres, luminance, saturation).
 *    Le plateau des références est sombre (fond noir bleu-vert) : un plan nettement plus clair ou plus coloré que la
 *    médiane des plans du plateau est compté comme une illustration. Vérifié à l'œil sur les planches.
 *  - DÉBIT : méthode des noyaux syllabiques (de Jong et Wempe, 2009) : pics d'intensité de la voix, séparés par un
 *    creux d'au moins 2 dB, au-dessus d'un seuil relatif ; syllabes par seconde sur la durée parlée (blancs de plus de
 *    0,3 s retirés). Mots par seconde = pics ÷ 1,14, rapport ÉTALONNÉ sur deux références dont les sous-titres
 *    incrustés (le texte réellement dit) ont été relus mot à mot avec leur minutage. Estimation à ± 10 %.
 *
 * Usage : pnpm exec tsx outils/mesures/mesurer-references.ts <dossier des références> [--json sortie.json]
 */
import { spawnSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const L = 36;
const H = 64;
/**
 * Pics de voix comptés par mot écrit : ÉTALONNÉ le 02/10 sur deux références dont les sous-titres incrustés ont été
 * relus mot à mot (reference-locale : 129 mots pour 142 pics ; reference-locale : 164 mots pour 193 pics).
 * La détection fusionne des syllabes voisines : ce n'est pas le nombre de syllabes du français (≈ 1,45 par mot).
 */
const PICS_PAR_MOT = 1.14;

function sonde(fichier: string): { dureeSec: number; fps: number } {
  const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate:format=duration", "-of", "json", fichier]).stdout.toString();
  const j = JSON.parse(r) as { streams: { r_frame_rate: string }[]; format: { duration: string } };
  const [n, d] = j.streams[0].r_frame_rate.split("/").map(Number);
  return { dureeSec: Number(j.format.duration), fps: n / d };
}

function images(fichier: string, format: "gray" | "rgb24"): Buffer {
  return spawnSync("ffmpeg", ["-v", "error", "-i", fichier, "-vf", `scale=${L}:${H}`, "-pix_fmt", format, "-f", "rawvideo", "-"], { maxBuffer: 1 << 30 }).stdout;
}

const mediane = (x: number[]) => {
  const t = [...x].sort((a, b) => a - b);
  return t.length ? t[Math.floor(t.length / 2)] : 0;
};

export function detecterCoupes(gris: Buffer, fps: number): number[] {
  const taille = L * H;
  const n = Math.floor(gris.length / taille);
  const diff = [0];
  for (let k = 1; k < n; k++) {
    let s = 0;
    for (let i = 0; i < taille; i++) s += Math.abs(gris[k * taille + i] - gris[(k - 1) * taille + i]);
    diff.push(s / taille);
  }
  const demi = Math.round(fps / 2);
  const coupes: number[] = [];
  for (let k = 1; k < n; k++) {
    const voisins = diff.slice(Math.max(1, k - demi), Math.min(n, k + demi + 1)).filter((_, i, a) => a[i] !== diff[k]);
    const m = mediane(voisins);
    const pic = diff[k] >= (diff[k - 1] ?? 0) && diff[k] >= (diff[k + 1] ?? 0);
    if (pic && diff[k] >= 9 && diff[k] >= 3 * Math.max(m, 1)) {
      const t = k / fps;
      // La toute première image (fondu d'entrée de l'encodeur) n'est pas une coupe.
      if (t >= 0.2 && (!coupes.length || t - coupes[coupes.length - 1] >= 0.4)) coupes.push(+t.toFixed(2));
    }
  }
  return coupes;
}

interface Plan {
  debutSec: number;
  finSec: number;
  sombre: number;
  luminance: number;
  saturation: number;
  illustration: boolean;
}

function decrirePlans(rgb: Buffer, fps: number, coupes: number[], dureeSec: number): Plan[] {
  const taille = L * H * 3;
  const bornes = [0, ...coupes, dureeSec];
  const plans: Plan[] = [];
  for (let i = 0; i + 1 < bornes.length; i++) {
    const k = Math.min(Math.floor(rgb.length / taille) - 1, Math.round(((bornes[i] + bornes[i + 1]) / 2) * fps));
    let sombre = 0;
    let lum = 0;
    let sat = 0;
    for (let p = 0; p < L * H; p++) {
      const r = rgb[k * taille + 3 * p];
      const g = rgb[k * taille + 3 * p + 1];
      const b = rgb[k * taille + 3 * p + 2];
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lum += y;
      if (y < 45) sombre++;
      sat += Math.max(r, g, b) - Math.min(r, g, b);
    }
    plans.push({ debutSec: bornes[i], finSec: bornes[i + 1], sombre: sombre / (L * H), luminance: lum / (L * H), saturation: sat / (L * H), illustration: false });
  }
  // Le plateau : la majorité du temps. Un plan bien plus clair (moins de pixels sombres) est une illustration.
  const plateau = mediane(plans.flatMap((p) => Array(Math.max(1, Math.round(p.finSec - p.debutSec))).fill(p.sombre)));
  for (const p of plans) p.illustration = p.sombre < plateau - 0.22 || p.luminance > 110;
  return plans;
}

export function syllabesParSeconde(fichier: string): { syllabes: number; dureeParleeSec: number; syllabesParSeconde: number; motsParSeconde: number } {
  const sr = 16000;
  const pcm = spawnSync("ffmpeg", ["-v", "error", "-i", fichier, "-ac", "1", "-ar", String(sr), "-af", "highpass=f=100,lowpass=f=4000", "-f", "f32le", "-"], { maxBuffer: 1 << 28 }).stdout;
  const x = new Float32Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength));
  const trame = sr / 100; // 10 ms
  const db: number[] = [];
  for (let i = 0; i + trame <= x.length; i += trame) {
    let s = 0;
    for (let k = i; k < i + trame; k++) s += x[k] * x[k];
    db.push(10 * Math.log10(s / trame + 1e-12));
  }
  // Lissage sur 50 ms.
  const lisse = db.map((_, i) => {
    const a = db.slice(Math.max(0, i - 2), i + 3);
    return a.reduce((s, v) => s + v, 0) / a.length;
  });
  const max = [...lisse].sort((a, b) => b - a)[Math.floor(lisse.length * 0.01)];
  const seuil = Math.max(mediane(lisse), max - 25);
  let syllabes = 0;
  let creux = Infinity;
  let dernierPic = -Infinity;
  for (let i = 1; i + 1 < lisse.length; i++) {
    creux = Math.min(creux, lisse[i]);
    const pic = lisse[i] > lisse[i - 1] && lisse[i] >= lisse[i + 1] && lisse[i] > seuil;
    if (pic && lisse[i] - creux >= 2 && i - dernierPic >= 6) {
      syllabes++;
      dernierPic = i;
      creux = Infinity;
    }
  }
  // Durée parlée : trames au-dessus du seuil, blancs de moins de 0,3 s comptés comme parole.
  let parle = 0;
  let blanc = 0;
  for (const v of lisse) {
    if (v > seuil - 10) {
      parle += 1 + (blanc < 30 ? blanc : 0);
      blanc = 0;
    } else blanc++;
  }
  const dureeParleeSec = parle / 100;
  const sps = syllabes / Math.max(1, dureeParleeSec);
  return { syllabes, dureeParleeSec: +dureeParleeSec.toFixed(1), syllabesParSeconde: +sps.toFixed(2), motsParSeconde: +(sps / PICS_PAR_MOT).toFixed(2) };
}

export function mesurer(fichier: string) {
  const { dureeSec, fps } = sonde(fichier);
  const coupes = detecterCoupes(images(fichier, "gray"), fps);
  const plans = decrirePlans(images(fichier, "rgb24"), fps, coupes, dureeSec);
  const durees = plans.map((p) => p.finSec - p.debutSec);
  const illus = plans.filter((p) => p.illustration);
  const tempsIllus = illus.reduce((s, p) => s + p.finSec - p.debutSec, 0);
  return {
    fichier: fichier.split(/[\\/]/).pop(),
    dureeSec: +dureeSec.toFixed(1),
    fps,
    coupes: coupes.length,
    premiereCoupeSec: coupes[0] ?? null,
    coupesAvant5s: coupes.filter((c) => c < 5).length,
    planMoyenSec: +(dureeSec / plans.length).toFixed(2),
    planMedianSec: +mediane(durees).toFixed(2),
    planMaxSec: +Math.max(...durees).toFixed(2),
    illustrations: illus.length,
    partIllustrationsPct: Math.round((100 * tempsIllus) / dureeSec),
    illustrationMoyenneSec: illus.length ? +(tempsIllus / illus.length).toFixed(2) : 0,
    ...syllabesParSeconde(fichier),
    plans: plans.map((p) => ({ de: +p.debutSec.toFixed(2), a: +p.finSec.toFixed(2), sombre: +p.sombre.toFixed(2), lum: Math.round(p.luminance), sat: Math.round(p.saturation), illustration: p.illustration })),
  };
}

if (process.argv[2]) {
  const dossier = process.argv[2];
  const resultats = readdirSync(dossier)
    .filter((f) => f.endsWith(".mp4"))
    .sort()
    .map((f) => mesurer(join(dossier, f)));
  const i = process.argv.indexOf("--json");
  if (i > 0) writeFileSync(process.argv[i + 1], JSON.stringify(resultats, null, 2) + "\n");
  for (const r of resultats) {
    const { plans, ...resume } = r;
    console.log(JSON.stringify(resume));
    if (process.argv.includes("--plans")) for (const p of plans) console.log("   ", JSON.stringify(p));
  }
}
