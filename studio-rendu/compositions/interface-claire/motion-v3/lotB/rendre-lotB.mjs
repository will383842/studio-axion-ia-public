/**
 * Rend le lot B : pour chaque élément un extrait MP4 540×960 30 i/s , l'enchaînement de 15 s, ou les deux.
 * À lancer SOUS LE VERROU `_VERROU-DESIGNERS-V3`. Usage :
 *   node rendre-lotB.mjs <public(prise.png + broll/)> <sortie> <bundle-temporaire> [extraits|enchainement|tout] [id-element ...]
 * Le dossier de bundle est le SEUL à effacer ensuite.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const [publicDir, sortie, bundleDir, mode = "tout", ...ids] = process.argv.slice(2);
mkdirSync(sortie, { recursive: true });
const TOUS = ["pilule-cote", "cercle-epaule", "bande-video", "arche-bas"];
const choisis = ids.length ? ids : TOUS;
const serveUrl = await bundle({ entryPoint: resolve(import.meta.dirname, "entree-lotB.tsx"), publicDir: resolve(publicDir), outDir: resolve(bundleDir) });
const commun = { codec: "h264", crf: 22, scale: 0.5, muted: false, concurrency: 2, serveUrl };
if (mode === "extraits" || mode === "tout") {
  for (const element of choisis) {
    const t0 = Date.now();
    const inputProps = { element };
    const composition = await selectComposition({ serveUrl, id: "ExtraitLotB", inputProps });
    await renderMedia({ ...commun, composition, outputLocation: resolve(sortie, `${element}.mp4`), inputProps });
    console.log(element, "ok", Math.round((Date.now() - t0) / 1000), "s");
  }
}
if (mode === "enchainement" || mode === "tout") {
  const t0 = Date.now();
  const composition = await selectComposition({ serveUrl, id: "EnchainementLotB", inputProps: {} });
  await renderMedia({ ...commun, composition, outputLocation: resolve(sortie, "enchainement-lotB-15s.mp4"), inputProps: {} });
  console.log("enchainement ok", Math.round((Date.now() - t0) / 1000), "s");
}
