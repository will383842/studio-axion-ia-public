/**
 * Rend les stills transparents et les extraits vidéo de 2 s du lot 4 (verrou pris par l'appelant).
 * Usage : npx tsx .../planche/rendre.ts <dossierStills> <dossierExtraits> <dossierPublic(prise.jpg)> [id…]
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

// Données seules (sans composants : tsx ne sait pas charger les .ttf). Gardées identiques à elements.tsx.
const ELEMENTS = [
  { id: "eclat-mot", debut: 0.2, instants: [1, 3, 5, 9, 30] },
  { id: "eclat-chiffre", debut: 0.1, instants: [0, 3, 8, 13, 24] },
  { id: "onde-de-choc", debut: 0.2, instants: [0, 3, 6, 10, 16] },
  { id: "traits-vitesse", debut: 0.2, instants: [0, 3, 7, 10, 24] },
  { id: "gerbe-formes", debut: 0.2, instants: [0, 3, 8, 12, 30] },
];

const [sortie, extraits, publicDir, ...ids] = process.argv.slice(2);
mkdirSync(sortie, { recursive: true });
mkdirSync(extraits, { recursive: true });
const serveUrl = await bundle({ entryPoint: resolve(import.meta.dirname, "Racine4.tsx"), publicDir });
for (const e of ELEMENTS) {
  if (ids.length && !ids.includes(e.id)) continue;
  for (const [n, k] of e.instants.entries()) {
    const props = { t: e.debut + k / 30 };
    const composition = await selectComposition({ serveUrl, id: e.id, inputProps: props });
    await renderStill({ composition, serveUrl, output: resolve(sortie, `${e.id}-${n}.png`), frame: 0, inputProps: props, imageFormat: "png" });
  }
  const video = await selectComposition({ serveUrl, id: `${e.id}-video`, inputProps: {} });
  await renderMedia({ composition: video, serveUrl, codec: "h264", crf: 26, pixelFormat: "yuv420p", muted: true, outputLocation: resolve(extraits, `${e.id}.mp4`), inputProps: {}, concurrency: 2 });
  console.log(e.id, "ok");
}
