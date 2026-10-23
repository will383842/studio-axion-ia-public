/**
 * Rend, pour chaque élément du lot 2 : les 5 images de la planche (PNG) et l'extrait vidéo de 2 s en 540×960 (MP4 h264).
 * À lancer SOUS LE VERROU `_VERROU-DESIGNERS-V2`. Usage :
 *   node rendre-planche.mjs <dossier-public-avec-prise.png> <dossier-de-sortie> <dossier-bundle-temporaire> [id-element ...]
 * Images : <sortie>/<id>-<n>.png ; extrait : <sortie>/<id>.mp4. Le dossier de bundle est le SEUL à effacer ensuite.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const [publicDir, sortie, bundleDir, ...ids] = process.argv.slice(2);
mkdirSync(sortie, { recursive: true });
const IMAGES = {
  "pastille-chiffre": [10, 12, 14, 18, 34],
  "bandes-diagonales": [10, 12, 14, 18, 40],
  "duel-triangles": [10, 12, 14, 18, 44],
  "demi-lune-bas": [10, 12, 14, 18, 40],
  "losange-crans": [10, 14, 30, 42, 56],
};
const choisis = ids.length ? ids : Object.keys(IMAGES);
const serveUrl = await bundle({ entryPoint: resolve(import.meta.dirname, "entree-planche.tsx"), publicDir: resolve(publicDir), outDir: resolve(bundleDir) });
for (const element of choisis) {
  for (const [n, image] of IMAGES[element].entries()) {
    const props = { element, image };
    const composition = await selectComposition({ serveUrl, id: "PlancheLot2", inputProps: props });
    await renderStill({ composition, serveUrl, output: resolve(sortie, `${element}-${n}.png`), inputProps: props, frame: 0 });
  }
  const props = { element };
  const composition = await selectComposition({ serveUrl, id: "ExtraitLot2", inputProps: props });
  await renderMedia({ composition, serveUrl, codec: "h264", crf: 30, scale: 0.5, outputLocation: resolve(sortie, `${element}.mp4`), inputProps: props, muted: true });
  console.log(element, "ok");
}
