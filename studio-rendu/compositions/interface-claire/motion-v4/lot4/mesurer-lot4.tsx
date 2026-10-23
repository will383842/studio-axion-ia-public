import React from "react";
/**
 * Mesures du lot 4 hors rendu (outil de contrôle) : calage des mots, plan de l'enchaînement, densité d'événements (R1), prise seule (R2), images de visage
 * partiel (E4). Se lance après un bundle esbuild (`--loader:.ttf=dataurl`), voir `COMPTE-RENDU.md`. Aucun rôle en production.
 */
import { EnchainementLot4, motsEnchainement, planEnchainement } from "./EnchainementLot4";
import { ELEMENTS_LOT_4, EXTRAITS, mesuresDe, motsExtrait } from "./PlancheLot4";
import { FPS, H, partCouverte, valeurDescente, YEUX, ySousTitresSurYeux } from "./commun-lot4";
import type { Rect } from "./commun-lot4";
import { FenetrePleinCadre } from "./FenetrePleinCadre";
import { FenetreTelephone } from "./FenetreTelephone";
import { FenetreDouble } from "./FenetreDouble";
import { AvantApres } from "./AvantApres";
import { MosaiqueVideos } from "./MosaiqueVideos";
import { mesuresFenetrePleinCadre } from "./FenetrePleinCadre";
import { mesuresFenetreTelephone } from "./FenetreTelephone";
import { mesuresFenetreDouble } from "./FenetreDouble";
import { mesuresAvantApres } from "./AvantApres";
import { mesuresMosaiqueVideos } from "./MosaiqueVideos";

void React;
void EnchainementLot4;
void FenetrePleinCadre;
void FenetreTelephone;
void FenetreDouble;
void AvantApres;
void MosaiqueVideos;

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const mots = motsEnchainement();
// Écrit les `mots-demo-<élément>.json` (§ I.1) dans le dossier passé en argument, s'il y en a un.
const dossierMots = process.argv[2];
if (dossierMots) {
  mkdirSync(resolve(dossierMots), { recursive: true });
  const ecrire = (nom: string, m: ReturnType<typeof motsExtrait>) =>
    writeFileSync(resolve(dossierMots, `mots-demo-${nom}.json`), JSON.stringify(m.map((x) => ({ mot: x.mot, debut: x.debut, fin: x.fin, fort: !!x.fort })), null, 1) + "\n");
  for (const id of ELEMENTS_LOT_4) ecrire(id, motsExtrait(id));
  ecrire("enchainement-15s", mots);
}
console.log("MOTS", mots.map((m) => `${m.mot}@${m.debut.toFixed(2)}`).join(" "));
const plan = planEnchainement();
for (const it of plan.items) console.log("PLAN", it.cle.padEnd(8), it.genre.padEnd(11), it.de.toFixed(2), "→", (it.de + it.duree).toFixed(2));

// Visage partiel par élément (images où le visage n'est NI entièrement visible NI entièrement couvert).
const D = (f: number, m: ReturnType<typeof mesuresDe>, duree: number, Dp = 0) => partCouverte(m.couvre(f, duree), Dp);
for (const id of ELEMENTS_LOT_4) {
  const e = EXTRAITS[id];
  const ms = motsExtrait(id);
  const m = mesuresDe(id, ms, 9);
  let partiel = 0;
  const etats: string[] = [];
  for (let f = 0; f < e.duree + 2; f++) {
    const c = D(f, m, e.duree);
    if (c > 0.02 && c < 0.98) {
      partiel++;
      etats.push(`${f}:${(c * 100).toFixed(0)}%`);
    }
  }
  console.log("VISAGE", id.padEnd(20), "images partielles:", partiel, etats.join(" "));
}
void mesuresFenetrePleinCadre;
void mesuresFenetreTelephone;
void mesuresFenetreDouble;
void mesuresAvantApres;
void mesuresMosaiqueVideos;
void (null as unknown as Rect);

// Densité (R1) et prise seule (R2) sur l'enchaînement de 15 s.
import { mesuresBandeVideo } from "./BandeVideo";
import { mesuresCercleEpaule } from "./CercleEpaule";
const ev: number[] = [];
const intervalles: Array<[number, number]> = [];
for (const it of plan.items) {
  const d = Math.round(it.duree * FPS);
  const i0 = Math.round(it.de * FPS);
  let evts: number[] = [];
  if (it.genre === "etiquette") evts = [0, ...(it.sur ? [4] : []), ...(it.interjection ? [6] : []), d - 3];
  else if (it.genre === "plein") evts = mesuresFenetrePleinCadre(-1).evenements;
  else if (it.genre === "telephone") evts = mesuresFenetreTelephone.evenements;
  else if (it.genre === "double") evts = mesuresFenetreDouble.evenements;
  else if (it.genre === "bande") evts = mesuresBandeVideo.evenements;
  else if (it.genre === "cercle") evts = mesuresCercleEpaule.evenements;
  else if (it.genre === "avantapres") evts = mesuresAvantApres(18).evenements;
  else if (it.genre === "mosaique") evts = mesuresMosaiqueVideos(24).evenements;
  for (const e of evts) ev.push(i0 + (e < 0 ? d + e : e));
  intervalles.push([i0, i0 + d]);
}
for (const s of plan.descente) ev.push(s.de);
ev.sort((a, b) => a - b);
let minDens = 99;
let pire = 0;
for (let a = 0; a + 150 <= 450; a += 5) {
  const n = ev.filter((e) => e >= a && e < a + 150).length;
  if (n / 5 < minDens) {
    minDens = n / 5;
    pire = a;
  }
}
console.log("DENSITE", "événements:", ev.length, "moyenne", (ev.length / 15).toFixed(2), "/s ; pire fenêtre de 5 s:", minDens.toFixed(2), "/s à", (pire / FPS).toFixed(1), "s ; événements 0-5 s:", ev.filter((e) => e < 150).length);
// prise seule : trous entre objets
let t = 0;
let gapMax = 0;
let gapAt = 0;
const tri = intervalles.sort((a, b) => a[0] - b[0]);
for (const [a, b] of tri) {
  if (a - t > gapMax) {
    gapMax = a - t;
    gapAt = t;
  }
  t = Math.max(t, b);
}
if (450 - t > gapMax) {
  gapMax = 450 - t;
  gapAt = t;
}
console.log("PRISE SEULE (plus long trou sans objet):", (gapMax / FPS).toFixed(2), "s à", (gapAt / FPS).toFixed(2), "s");

// Sous-titres jamais sur les yeux : à CHAQUE image de l'enchaînement, la boîte (± 0,035 H) ne touche pas les yeux (0,25-0,38 H + D réel, marge 0,02 H).
let violations = 0;
for (let f = 0; f < 450; f++) {
  const t = f / FPS;
  let y = plan.positions[0].y;
  for (const p of plan.positions) if (t >= p.de - 1e-6) y = p.y;
  const Df = valeurDescente(f, plan.descente);
  const yf = ySousTitresSurYeux(y, Df) / H;
  if (yf + 0.035 > YEUX.y0 + Df && yf - 0.035 < YEUX.y1 + Df) violations++;
}
console.log("YEUX: images où le sous-titre touche les yeux:", violations, "/ 450");
// Extraits : mêmes assertions (la prise ne descend pas, D = 0).
for (const id of ELEMENTS_LOT_4) {
  let v = 0;
  for (let f = 0; f < EXTRAITS[id].total; f++) {
    const y = (id === "fenetre-plein-cadre" ? (f - 9 >= 20 ? 0.795 : 0.72) : id === "bande-video" || id === "cercle-epaule" ? 0.075 : id === "fenetre-double" ? 0.91 : id === "mosaique-videos" ? 0.82 : id === "fenetre-telephone" || id === "avant-apres" ? 0.745 : 0.72) as number;
    if (y + 0.035 > YEUX.y0 && y - 0.035 < YEUX.y1) v++;
  }
  console.log("YEUX extrait", id.padEnd(20), v);
}
