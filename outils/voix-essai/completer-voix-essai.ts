/**
 * Complète le fichier de test fabriqué par `fabriquer-voix-essai.ps1` (voix de synthèse Windows, sans service payant) :
 * Windows donne le DÉBUT de chaque mot ; la FIN est mesurée sur le son lui-même (dernière trame de 10 ms au-dessus
 * de −40 dBFS avant le mot suivant). Écrit `tests/fixtures/voix-essai.json`, au même contrat que la synthèse HeyGen
 * (`word_timestamps` : mot, début, fin), sur le texte ENVOYÉ (prononciations substituées).
 *
 * Usage : pnpm exec tsx outils/voix-essai/completer-voix-essai.ts
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "tests/fixtures/voix-essai";
const TEXTE_VALIDE = "Vous recevez un PV de 135 € ? Surtout, ne le payez pas tout de suite. Je vous explique pourquoi, en trois points.";
const PRONONCIATIONS = [
  { mot: "PV", prononciation: "pé vé" },
  { mot: "135 €", prononciation: "cent trente-cinq euros" },
];
// Texte réellement lu par la voix (voir le SSML du script PowerShell), découpé comme HeyGen renvoie ses mots.
const TEXTE_ENVOYE = "Vous recevez un pé vé de cent trente-cinq euros ? Surtout, ne le payez pas tout de suite. Je vous explique pourquoi, en trois points.";

const debuts = (JSON.parse(readFileSync(`${BASE}.debuts.json`, "utf8").replace(/^﻿/, "")) as { debutSec: number }[]).map((d) => d.debutSec);
const mots = TEXTE_ENVOYE.split(/\s+/).reduce<string[]>((acc, m) => {
  if (/^[?!:;]$/.test(m) && acc.length) acc[acc.length - 1] += ` ${m}`;
  else acc.push(m);
  return acc;
}, []);
if (mots.length !== debuts.length) throw new Error(`${mots.length} mots pour ${debuts.length} débuts`);

const sr = 48000;
const pcm = spawnSync("ffmpeg", ["-v", "error", "-i", `${BASE}.wav`, "-f", "f32le", "-ac", "1", "-ar", String(sr), "-"], { maxBuffer: 1 << 28 }).stdout;
const echantillons = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 4);
const dureeSec = echantillons.length / sr;
const trame = sr / 100;
const db = (i: number) => {
  let s = 0;
  for (let k = i; k < Math.min(i + trame, echantillons.length); k++) s += echantillons[k] * echantillons[k];
  return 10 * Math.log10(s / trame + 1e-12);
};

const sortie = mots.map((mot, i) => {
  const debutSec = debuts[i];
  const limite = i + 1 < debuts.length ? debuts[i + 1] : dureeSec;
  let finSec = debutSec + 0.05;
  for (let t = Math.floor(debutSec * sr); t < Math.floor(limite * sr) - trame; t += trame) if (db(t) > -40) finSec = (t + trame) / sr;
  return { mot, debutSec, finSec: +Math.min(limite, finSec).toFixed(3) };
});

writeFileSync(
  `${BASE}.json`,
  JSON.stringify({ source: "Voix de synthèse Windows « Hortense » (fr-FR), 48 kHz mono", texteValide: TEXTE_VALIDE, texteEnvoye: TEXTE_ENVOYE, prononciations: PRONONCIATIONS, dureeSec: +dureeSec.toFixed(3), mots: sortie }, null, 2) + "\n",
);
console.log(`${sortie.length} mots, ${dureeSec.toFixed(2)} s → ${BASE}.json`);
