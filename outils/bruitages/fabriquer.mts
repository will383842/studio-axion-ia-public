/**
 * BANQUE DE BRUITAGES MODERNES — fabriqués par SYNTHÈSE, ici, sans aucun service ni aucun enregistrement d'autrui
 * (lot du 02/10, D1 ; consigne `INTENSITE-ET-BRUITAGES.md` §2). Ce sont des créations originales du studio : libres
 * de droits, usage commercial permis, versées au domaine public (CC0 1.0) ; la licence est écrite par fichier dans
 * `src/donnees/bruitages.ts`.
 *
 * Cinq sons, quatre variantes chacun (la règle demande 3 à 5) :
 *   chiffre            « tic » net et sourd               < 150 ms
 *   document           papier léger qui glisse            < 400 ms
 *   telephone          vibration discrète (deux impulsions, aucune sonnerie)  < 400 ms
 *   illustration-forte souffle très court                 < 300 ms
 *   impact             « pop » grave et sourd             < 200 ms
 * Lot I : + verre-1 (verre brisé, 400 ms), réservé à l'effet spécial « vitre qui se brise » demandé par Will.
 * Interdits volontairement absents : whoosh long, « ding », caisse enregistreuse, sons de mèmes, machine à écrire,
 * dessin animé, sonneries de marque.
 *
 * Sonie normalisée à la fabrication : niveau actif (RMS des trames de 10 ms à moins de 30 dB de la plus forte)
 * à −20 dBFS, crête ≤ −3 dBFS. Le mixage les pose ensuite 18 à 24 dB sous la voix.
 *
 * Usage (racine du dépôt) : `pnpm exec tsx outils/bruitages/fabriquer.mts` → public/bruitages/*.wav + manifeste.json
 * Déterministe : mêmes fichiers octet pour octet à chaque passage (graine fixe).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { synthetiserVerre } from "../../src/briques/effets-speciaux/son-verre.ts";

const ICI = dirname(fileURLToPath(import.meta.url));
const SORTIE = resolve(ICI, "..", "..", "public", "bruitages");
mkdirSync(SORTIE, { recursive: true });
const F = 48000;

function hasard(graine: number) {
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

/** Filtre biquad (formules RBJ) appliqué en place. */
function biquad(x: Float32Array, type: "passe-bas" | "passe-haut" | "passe-bande", f0: number | ((i: number) => number), q = Math.SQRT1_2): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const f = typeof f0 === "function" ? f0(i) : f0;
    const w = (2 * Math.PI * f) / F;
    const cw = Math.cos(w);
    const a = Math.sin(w) / (2 * q);
    let b0: number, b1: number, b2: number;
    if (type === "passe-bas") [b0, b1, b2] = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2];
    else if (type === "passe-haut") [b0, b1, b2] = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2];
    else [b0, b1, b2] = [a, 0, -a];
    const a0 = 1 + a;
    const v = (b0 * x[i] + b1 * x1 + b2 * x2 + 2 * cw * y1 - (1 - a) * y2) / a0;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

/** Niveau actif (dBFS), même mesure que le mixage (`studio-rendu/src/son/bruitages.ts`). */
function niveauActif(x: Float32Array): number {
  const t = F / 100;
  const e: number[] = [];
  for (let i = 0; i + t <= x.length; i += t) {
    let s = 0;
    for (let k = i; k < i + t; k++) s += x[k] * x[k];
    e.push(s / t);
  }
  const max = Math.max(...e);
  const act = e.filter((v) => v >= max / 1000);
  return 10 * Math.log10(act.reduce((a, b) => a + b, 0) / act.length);
}

/** Normalise (niveau actif −20 dBFS, crête ≤ −3 dBFS) et adoucit les bords (4 ms). */
function finir(x: Float32Array): Float32Array {
  const fondu = Math.round(0.004 * F);
  for (let i = 0; i < fondu && i < x.length; i++) {
    x[i] *= i / fondu;
    x[x.length - 1 - i] *= i / fondu;
  }
  let g = Math.pow(10, (-20 - niveauActif(x)) / 20);
  const crete = Math.max(...Array.from(x, (v) => Math.abs(v))) * g;
  if (crete > Math.pow(10, -3 / 20)) g *= Math.pow(10, -3 / 20) / crete;
  return x.map((v) => v * g);
}

function wav16(x: Float32Array): Buffer {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + x.length * 2, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(F, 24);
  b.writeUInt32LE(F * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  return b;
}

const n = (sec: number) => Math.round(sec * F);

/** « Tic » net et sourd : sinusoïde très amortie + transitoire de 2 ms, passe-bas doux. */
function tic(v: number): Float32Array {
  const f = [1500, 1680, 1820, 1960][v];
  const tau = [0.011, 0.013, 0.01, 0.012][v];
  const r = hasard(11 + v);
  const x = new Float32Array(n(0.09));
  for (let i = 0; i < x.length; i++) {
    const t = i / F;
    x[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t / tau) + (t < 0.002 ? (r() * 2 - 1) * 0.6 * (1 - t / 0.002) : 0);
  }
  return finir(biquad(x, "passe-bas", 4200));
}

/** Papier léger : bruit en bande (2-5 kHz) qui glisse, grain irrégulier, enveloppe douce. */
function papier(v: number): Float32Array {
  const d = [0.3, 0.33, 0.28, 0.35][v];
  const r = hasard(23 + v);
  const x = new Float32Array(n(d));
  let grain = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / F;
    if (i % 480 === 0) grain = 0.55 + r() * 0.45;
    const env = Math.min(1, t / 0.05) * Math.pow(Math.max(0, 1 - t / d), 1.6);
    x[i] = (r() * 2 - 1) * env * grain;
  }
  const debut = [2400, 2600, 2200, 2800][v];
  return finir(biquad(x, "passe-bande", (i) => debut + (1200 * i) / x.length, 0.9));
}

/** Vibration discrète : deux impulsions d'un bourdon grave (aucune sonnerie). */
function vibration(v: number): Float32Array {
  const f = [165, 172, 158, 180][v];
  const imp = [0.12, 0.11, 0.13, 0.1][v];
  const pause = [0.07, 0.08, 0.06, 0.09][v];
  const d = 2 * imp + pause;
  const x = new Float32Array(n(d));
  for (let i = 0; i < x.length; i++) {
    const t = i / F;
    const dans = t < imp ? t : t >= imp + pause ? t - imp - pause : -1;
    if (dans < 0) continue;
    const env = Math.min(1, dans / 0.012) * Math.min(1, (imp - dans) / 0.02);
    let s = 0;
    for (let h = 1; h <= 4; h++) s += Math.sin(2 * Math.PI * f * h * t) / (h * h);
    x[i] = s * env * (0.75 + 0.25 * Math.sin(2 * Math.PI * 24 * t));
  }
  return finir(biquad(x, "passe-bas", 1400));
}

/** Souffle très court : bruit dont le passe-bas descend (6 kHz → 1,5 kHz), montée 60 ms. */
function souffle(v: number): Float32Array {
  const d = [0.24, 0.26, 0.22, 0.28][v];
  const r = hasard(41 + v);
  const x = new Float32Array(n(d));
  for (let i = 0; i < x.length; i++) {
    const t = i / F;
    const env = Math.min(1, t / 0.06) * Math.pow(Math.max(0, 1 - t / d), 2);
    x[i] = (r() * 2 - 1) * env;
  }
  const haut = [6000, 5200, 6800, 5600][v];
  return finir(biquad(biquad(x, "passe-bas", (i) => haut - ((haut - 1500) * i) / x.length, 0.8), "passe-haut", 300));
}

/** « Pop » grave et sourd : glissé de fréquence 260 → 140 Hz, très amorti, petit clic d'attaque. */
function pop(v: number): Float32Array {
  const [f0, f1] = [[260, 140], [240, 135], [280, 150], [250, 145]][v];
  const d = [0.16, 0.17, 0.15, 0.18][v];
  const x = new Float32Array(n(d));
  let phase = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / F;
    const f = f1 + (f0 - f1) * Math.exp(-t / 0.03);
    phase += (2 * Math.PI * f) / F;
    x[i] = Math.sin(phase) * Math.exp(-t / 0.045) + (t < 0.0015 ? 0.3 * (1 - t / 0.0015) : 0);
  }
  return finir(biquad(x, "passe-bas", 900));
}

const SONS = [
  { declencheur: "chiffre", nom: "Tic", fabrique: tic },
  { declencheur: "document", nom: "Papier", fabrique: papier },
  { declencheur: "telephone", nom: "Vibration", fabrique: vibration },
  { declencheur: "illustration-forte", nom: "Souffle court", fabrique: souffle },
  { declencheur: "impact", nom: "Pop grave", fabrique: pop },
] as const;

const manifeste: { fichier: string; declencheur: string; nom: string; variante: number; dureeSec: number; niveauActifDb: number; creteDb: number }[] = [];
for (const s of SONS) {
  for (let v = 0; v < 4; v++) {
    const x = s.fabrique(v);
    const fichier = `${s.declencheur}-${v + 1}.wav`;
    writeFileSync(join(SORTIE, fichier), wav16(x));
    manifeste.push({ fichier, declencheur: s.declencheur, nom: `${s.nom} ${v + 1}`, variante: v + 1, dureeSec: +(x.length / F).toFixed(3), niveauActifDb: +niveauActif(x).toFixed(2), creteDb: +(20 * Math.log10(Math.max(...Array.from(x, (k) => Math.abs(k))))).toFixed(2) });
  }
}
// Lot I : verre brisé (effet spécial « vitre qui se brise », facecam lot F3), même synthèse que la brique
// `src/briques/effets-speciaux/son-verre.ts`, ramenée à 0,4 s (le mixage ne pose pas plus long : impact, craquement
// et premiers tintements). Posé SEULEMENT par l'effet demandé, jamais par le chef d'orchestre (déclencheur « verre »).
{
  const x = finir(synthetiserVerre(F, 0.4));
  writeFileSync(join(SORTIE, "verre-1.wav"), wav16(x));
  manifeste.push({ fichier: "verre-1.wav", declencheur: "verre", nom: "Verre brisé 1", variante: 1, dureeSec: +(x.length / F).toFixed(3), niveauActifDb: +niveauActif(x).toFixed(2), creteDb: +(20 * Math.log10(Math.max(...Array.from(x, (k) => Math.abs(k))))).toFixed(2) });
}
// 11/10 : les trois sons du tableau animé, style « blocs/2 » (trait, toc, validation). Ils viennent de la vidéo modèle
// (`maquettes/tableau-design-v2/video/formation/bruitages/fabriquer.sh`) et ne sont PAS refabriqués ici : ils sont lus
// (WAV 16 bits mono 48 kHz) et mesurés, pour que le manifeste liste toute la banque.
for (const [famille, nom] of [["trait", "Trait de crayon"], ["toc", "Toc"], ["validation", "Validation"]] as const) {
  const fichier = `tableau-${famille}.wav`;
  const brut = readFileSync(join(SORTIE, fichier));
  const donnees = brut.indexOf("data") + 8;
  const n = Math.floor((brut.length - donnees) / 2);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = brut.readInt16LE(donnees + 2 * i) / 32768;
  manifeste.push({ fichier, declencheur: `tableau-${famille}`, nom: `${nom} (tableau) 1`, variante: 1, dureeSec: +(x.length / F).toFixed(3), niveauActifDb: +niveauActif(x).toFixed(2), creteDb: +(20 * Math.log10(Math.max(...Array.from(x, (k) => Math.abs(k))))).toFixed(2) });
}
writeFileSync(join(SORTIE, "manifeste.json"), JSON.stringify({ outil: "outils/bruitages/fabriquer.mts", licence: "CC0 1.0 — création originale du studio par synthèse, usage commercial permis, aucune attribution", sons: manifeste }, null, 2) + "\n");
console.log(`${manifeste.length} sons → ${SORTIE}`);
for (const m of manifeste) console.log(`  ${m.fichier.padEnd(26)} ${String(Math.round(m.dureeSec * 1000)).padStart(4)} ms  ${m.niveauActifDb} dBFS  crête ${m.creteDb}`);
