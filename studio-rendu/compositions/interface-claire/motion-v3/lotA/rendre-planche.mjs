/**
 * Rend les extraits du lot A (v3) : extrait de 3 s par élément (MP4 540×960, 30 i/s, avec bruitages), enchaînement de 15 s,
 * images fixes de contrôle. À lancer SOUS LE VERROU `_VERROU-DESIGNERS-V3`. Usage :
 *   node rendre-planche.mjs <public> <sortie> <bundle-temporaire> <tache> [tache ...]
 *   tâches : extrait:<id>   ench   still:<id>:<n1,n2,...>   (images fixes en 1080×1920, nommées <id>-<n>.png)
 * Le dossier de bundle est le SEUL à effacer ensuite.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const [publicDir, sortie, bundleDir, ...taches] = process.argv.slice(2);
mkdirSync(sortie, { recursive: true });
const serveUrl = await bundle({ entryPoint: resolve(import.meta.dirname, "entree-planche.tsx"), publicDir: resolve(publicDir), outDir: resolve(bundleDir) });
const commun = { codec: "h264", crf: 20, scale: 0.5, pixelFormat: "yuv420p", x264Preset: "medium" };
for (const tache of taches) {
  const [genre, element, liste] = tache.split(":");
  const debut = Date.now();
  if (genre === "extrait") {
    const props = { element };
    const composition = await selectComposition({ serveUrl, id: "ExtraitLotA", inputProps: props });
    await renderMedia({ composition, serveUrl, ...commun, outputLocation: resolve(sortie, `${element}.mp4`), inputProps: props });
  } else if (genre === "ench") {
    const composition = await selectComposition({ serveUrl, id: "EnchainementLotA", inputProps: {} });
    await renderMedia({ composition, serveUrl, ...commun, outputLocation: resolve(sortie, `enchainement-lotA-15s.mp4`), inputProps: {} });
  } else if (genre === "still") {
    for (const n of liste.split(",").map(Number)) {
      const props = { element, image: n };
      const composition = await selectComposition({ serveUrl, id: "PlancheLotA", inputProps: props });
      await renderStill({ composition, serveUrl, output: resolve(sortie, `${element}-${n}.png`), inputProps: props, frame: 0 });
    }
  }
  console.log(tache, "ok", ((Date.now() - debut) / 1000).toFixed(1), "s");
}
