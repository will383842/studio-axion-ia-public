/**
 * Rend les EXTRAITS de 2 s (60 images, 540 × 960, 30 i/s) du lot 1 sur la prise commune.
 *   npx tsx <ce fichier> <dossierSortie> <dossierPublic contenant prise.png>
 */
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, selectComposition } from "@remotion/renderer";

const racine = resolve(import.meta.dirname, "../../../../../..");
const sortie = resolve(process.argv[2]);
const publicDir = resolve(process.argv[3]);
mkdirSync(sortie, { recursive: true });
const ids = ["autocollant-mot", "scotch-postit", "tampon-dechirure", "fleche-feutre", "ticket-dechire-haut"];
const dossierBundle = resolve(publicDir, "../_bundle-lot1-extraits");
const serveUrl = await bundle({ entryPoint: resolve(import.meta.dirname, "entree-lot1.tsx"), rootDir: racine, outDir: dossierBundle, publicDir });
const navigateur = await openBrowser("chrome", { chromiumOptions: { gl: "swangle" } });
try {
  for (const id of ids) {
    const inputProps = { fond: true, debutImg: 8, visible: 34 };
    const composition = await selectComposition({ serveUrl, id, puppeteerInstance: navigateur, inputProps });
    await renderMedia({
      composition: { ...composition, durationInFrames: 60 },
      serveUrl,
      codec: "h264",
      crf: 28,
      scale: 0.5,
      inputProps,
      outputLocation: resolve(sortie, `${id}.mp4`),
      puppeteerInstance: navigateur,
      pixelFormat: "yuv420p",
    });
    console.log(`${id} : extrait fait`);
  }
} finally {
  await navigateur.close({ silent: true });
  rmSync(dossierBundle, { recursive: true, force: true });
}
