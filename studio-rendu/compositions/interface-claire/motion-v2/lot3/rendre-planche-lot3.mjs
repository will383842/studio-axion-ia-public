/**
 * Rend l'aperçu du lot 3 : une bande de 5 images fixes par élément ET un extrait MP4 de 2 s (540x960, 30 i/s) par élément.
 * `node rendre-planche-lot3.mjs <dossier-public> <dossier-images> <dossier-extraits>`
 * <dossier-public> contient `prise-commune.png` (prise commune des planches v2). Sorties : <id>-<k>.jpg et <id>.mp4.
 * À lancer sous le verrou des designers ; supprimer ensuite les `remotion-*` temporaires créés.
 */
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const [pub, sortie, extraits] = process.argv.slice(2);
mkdirSync(sortie, { recursive: true });
mkdirSync(extraits, { recursive: true });
const entree = resolve(import.meta.dirname, "entree-lot3.ts");
const DEBUT = 15; // 0,5 s à 30 i/s
const BANDES = {
  "mot-saute": [2, 7, 10, 19, 40],
  "mot-vertical-bord": [2, 4, 6, 10, 45],
  "rafale-trois-mots": [3, 11, 21, 29, 37],
  "pile-de-lettres": [1, 3, 6, 30, 68],
  "mot-barre-remplace": [3, 17, 23, 40, 63],
};
const serveUrl = await bundle({ entryPoint: entree, publicDir: pub });
for (const [element, ks] of Object.entries(BANDES)) {
  if (process.env.SEUL && process.env.SEUL !== element) continue;
  const composition = await selectComposition({ serveUrl, id: "ApercuLot3", inputProps: { element } });
  for (const k of ks) {
    await renderStill({ composition, serveUrl, frame: DEBUT + k, output: resolve(sortie, `${element}-${String(k).padStart(2, "0")}.jpg`), imageFormat: "jpeg", jpegQuality: 90, inputProps: { element } });
  }
  // Extrait de 2 s : 0,4 s de prise seule puis l'élément (1,6 s, sortie comprise).
  const props = { element, duree: 1.6 };
  const c2 = await selectComposition({ serveUrl, id: "ApercuLot3", inputProps: props });
  await renderMedia({ composition: c2, serveUrl, codec: "h264", crf: 30, scale: 0.5, frameRange: [12, 71], outputLocation: resolve(extraits, `${element}.mp4`), inputProps: props, concurrency: 2, pixelFormat: "yuv420p", muted: true });
  console.log(element, "ok");
}
