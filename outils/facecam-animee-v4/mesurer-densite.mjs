/**
 * MESURE de la densité d'événements graphiques SUR LE RENDU (et pas sur les fiches) : la vidéo est rendue SANS la prise (fond uni) et SANS
 * sous-titres ; chaque image est comparée à la précédente ; un « événement » est une salve de changement dont l'écart moyen dépasse
 * `seuil` (niveaux de gris sur 255), séparée de la précédente par au moins 4 images (≈ 0,13 s). Même idée que le comptage de la référence
 * (événements hors sous-titres), à une réserve près : un changement lent mais continu (compteur qui défile) compte comme un seul événement.
 *   node outils/facecam-animee-v4/mesurer-densite.mjs <video-sans-prise.mp4> [seuil=0.35]
 * DEUX comptes sont rendus (17/10) : `evenements` / `densiteMoyenne` = la définition d'origine (salves séparées par ≥ 4 images calmes : un enchaînement continu de mouvements
 * ne compte que pour UN événement) ; `evenementsPics` / `densitePics` = une salve par PIC de mouvement séparé du précédent par un vrai creux (le mouvement retombe
 * sous 50 % du plus petit des deux pics) — ce qu'un spectateur voit comme « quelque chose qui arrive » (chaque pastille, chaque ligne, chaque saut).
 * Sortie : JSON { images, evenements, densiteMoyenne, densiteMinFenetre5s, pireFenetre, plusLongCalmeSec, calmes: [[debut, fin]…] }.
 */
import { spawnSync } from "node:child_process";

const [video, seuilArg] = process.argv.slice(2);
const seuil = Number(seuilArg ?? 0.35);
const r = spawnSync("ffmpeg", ["-v", "error", "-i", video, "-vf", "fps=30,scale=135:240,format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-", "-an", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 28 });
const valeurs = [...r.stdout.matchAll(/lavfi\.signalstats\.YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
const FPS = 30;
const evts = [];
let dernier = -99;
valeurs.forEach((v, i) => { if (v > seuil && i - dernier >= 4) { evts.push(i / FPS); dernier = i; } else if (v > seuil) dernier = i; });
const duree = valeurs.length / FPS;
// Pics : maximum local sur ±2 images, au-dessus du seuil, à ≥ 4 images du pic précédent, avec un creux net entre les deux.
const pics = [];
for (let i = 0; i < valeurs.length; i++) {
  const v = valeurs[i];
  if (v <= seuil) continue;
  let max = true;
  for (let k = Math.max(0, i - 2); k <= Math.min(valeurs.length - 1, i + 2); k++) if (valeurs[k] > v || (valeurs[k] === v && k < i)) max = false;
  if (!max) continue;
  const prec = pics[pics.length - 1];
  if (prec === undefined) { pics.push(i); continue; }
  if (i - prec < 4) continue;
  const creux = Math.min(...valeurs.slice(prec, i + 1));
  if (creux <= 0.5 * Math.min(v, valeurs[prec]) || creux <= seuil) pics.push(i);
}
let minPics = Infinity, pireFenetrePics = 0;
for (let w = 0; w + 5 <= duree + 1e-9; w += 0.1) { const q = pics.filter((e) => e / FPS >= w && e / FPS < w + 5).length / 5; if (q < minPics) { minPics = q; pireFenetrePics = w; } }
let min = Infinity, pire = 0;
for (let w = 0; w + 5 <= duree + 1e-9; w += 0.1) {
  const n = evts.filter((e) => e >= w && e < w + 5).length / 5;
  if (n < min) { min = n; pire = w; }
}
const calmes = [];
let debut = null;
valeurs.forEach((v, i) => { const calme = v <= seuil; if (calme && debut === null) debut = i; if (!calme && debut !== null) { calmes.push([debut / FPS, i / FPS]); debut = null; } });
if (debut !== null) calmes.push([debut / FPS, valeurs.length / FPS]);
const longs = calmes.filter(([a, b]) => b - a > 0.5);
console.log(JSON.stringify({ images: valeurs.length, evenements: evts.length, densiteMoyenne: +(evts.length / duree).toFixed(2), densiteMinFenetre5s: +min.toFixed(2), evenementsPics: pics.length, densitePics: +(pics.length / duree).toFixed(2), densitePicsMinFenetre5s: +minPics.toFixed(2), pireFenetrePics: +pireFenetrePics.toFixed(1), pireFenetre: +pire.toFixed(1), plusLongCalmeSec: +Math.max(0, ...calmes.map(([a, b]) => b - a)).toFixed(2), calmesDePlusDeMoitieSeconde: longs.map(([a, b]) => [+a.toFixed(2), +b.toFixed(2)]) }));
