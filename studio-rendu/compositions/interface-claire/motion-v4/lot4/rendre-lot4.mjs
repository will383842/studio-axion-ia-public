/**
 * Rend les extraits du lot 4 (v4) : un extrait par élément et par palette, l'enchaînement de 15 s, des images fixes de contrôle.
 * Rendu dans le cloud uniquement, un à la fois. Usage :
 *   node rendre-lot4.mjs <public> <sortie> <bundle-temporaire> <tache> [tache ...]
 *   tâches (palette B seule, tour 2) : extrait:<id>   ench   fonds:<id>:<image> (4 images fixes : prise, blanc, noir, b-roll, dans <sortie>/fonds/)   images:<id>:<n1,n2,..> (images fixes de contrôle de l'extrait)
 * Le dossier de bundle est le SEUL à effacer ensuite.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const [publicDir, sortie, bundleDir, ...taches] = process.argv.slice(2);
mkdirSync(sortie, { recursive: true });
const serveUrl = await bundle({ entryPoint: resolve(import.meta.dirname, "entree-lot4.tsx"), publicDir: resolve(publicDir), outDir: resolve(bundleDir) });
const CHROME = process.env.CHROME_BIN || "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const commun = { browserExecutable: CHROME, chromiumOptions: { gl: "angle" }, codec: "h264", crf: 28, scale: 0.5, pixelFormat: "yuv420p", x264Preset: "medium", audioBitrate: "128k", concurrency: 4 };
const NOMS = { "fenetre-plein-cadre": "FenetrePleinCadre", "fenetre-telephone": "FenetreTelephone", "fenetre-double": "FenetreDouble", "bande-video": "BandeVideo", "cercle-epaule": "CercleEpaule", "mosaique-videos": "MosaiqueVideos", "avant-apres": "AvantApres" };
const PAL = "B";
const stillOpts = { browserExecutable: CHROME, chromiumOptions: { gl: "angle" }, scale: 0.5, imageFormat: "jpeg", jpegQuality: 80 };
for (const tache of taches) {
  const [genre, a, b] = tache.split(":");
  const debut = Date.now();
  if (genre === "extrait") {
    const props = { element: a, palette: PAL, fond: "prise" };
    const composition = await selectComposition({ serveUrl, browserExecutable: CHROME, id: "ExtraitLot4", inputProps: props });
    await renderMedia({ composition, serveUrl, ...commun, outputLocation: resolve(sortie, `${NOMS[a]}-B.mp4`), inputProps: props });
  } else if (genre === "ench") {
    const props = { palette: PAL };
    const composition = await selectComposition({ serveUrl, browserExecutable: CHROME, id: "EnchainementLot4", inputProps: props });
    await renderMedia({ composition, serveUrl, ...commun, outputLocation: resolve(sortie, `lot4-enchainement-15s-B.mp4`), inputProps: props });
  } else if (genre === "fonds") {
    mkdirSync(resolve(sortie, "fonds"), { recursive: true });
    for (const fond of ["prise", "blanc", "noir", "broll"]) {
      const props = { element: a, palette: PAL, fond };
      const composition = await selectComposition({ serveUrl, browserExecutable: CHROME, id: "ExtraitLot4", inputProps: props });
      await renderStill({ composition, serveUrl, ...stillOpts, frame: Number(b), output: resolve(sortie, "fonds", `${NOMS[a]}-${fond}.jpg`), inputProps: props });
    }
  } else if (genre === "images") {
    mkdirSync(resolve(sortie, "images"), { recursive: true });
    const props = { element: a, palette: PAL, fond: "prise" };
    const composition = await selectComposition({ serveUrl, browserExecutable: CHROME, id: "ExtraitLot4", inputProps: props });
    for (const n of b.split(",")) await renderStill({ composition, serveUrl, ...stillOpts, frame: Number(n), output: resolve(sortie, "images", `${NOMS[a]}-${n}.jpg`), inputProps: props });
  }
  console.log(tache, "ok", ((Date.now() - debut) / 1000).toFixed(1), "s");
}
