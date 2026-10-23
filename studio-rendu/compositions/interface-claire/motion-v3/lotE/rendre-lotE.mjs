/**
 * Rend les extraits (540×960, 30 i/s) et l'enchaînement de 15 s du lot E. À lancer SOUS LE VERROU `_VERROU-DESIGNERS-V3`.
 * Usage : node rendre-lotE.mjs <dossier-public(prise.png + broll/)> <dossier-sortie> <dossier-bundle-temporaire> <normal|visage|stills> [id-element|enchainement ...]
 * Mode "stills" : images fixes de contrôle (images listées dans STILLS), pour itérer vite sans rendre les vidéos.
 * Le dossier de bundle est le SEUL à effacer ensuite.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const DUREES = { "duel-video": 90, "dalle-claquee": 60, "eclat-chiffre": 60, "mot-fenetre": 78, "mosaique-videos": 84 };
const [publicDir, sortie, bundleDir, mode, ...ids] = process.argv.slice(2);
mkdirSync(sortie, { recursive: true });
const choisis0 = ids.length ? ids : [...Object.keys(DUREES), "enchainement"];
const STILLS = {
  "duel-video": [9, 10, 11, 12, 13, 15, 18, 24, 40, 50, 84, 86],
  "dalle-claquee": [10, 13, 14, 16, 18, 22, 28, 34, 38, 40, 41, 42],
  "eclat-chiffre": [9, 12, 14, 16, 20, 22, 26, 32, 40, 44, 46, 48],
  "mot-fenetre": [10, 14, 18, 22, 26, 30, 36, 44, 56, 60, 62, 64],
  "mosaique-videos": [9, 10, 12, 20, 34, 46, 48, 52, 70, 76, 80, 82],
};

const serveUrl = await bundle({ entryPoint: resolve(import.meta.dirname, "PlancheLotE.tsx"), publicDir: resolve(publicDir), outDir: resolve(bundleDir) });
for (const id of choisis0) {
  if (mode === "stills") {
    const inputProps = { element: id, mode: "normal" };
    const composition = await selectComposition({ serveUrl, id: "ExtraitE", inputProps });
    for (const f of STILLS[id] ?? []) {
      await renderStill({ composition, serveUrl, output: resolve(sortie, `st-${id}-${String(f).padStart(3, "0")}.png`), frame: f, inputProps, scale: 0.5, timeoutInMilliseconds: 180000 });
    }
    console.log(id, "stills ok");
    continue;
  }
  const enchainement = id === "enchainement";
  const inputProps = enchainement ? { mode } : { element: id, mode };
  const composition = await selectComposition({ serveUrl, id: enchainement ? "EnchainementE" : "ExtraitE", inputProps });
  const comp = enchainement ? composition : { ...composition, durationInFrames: DUREES[id] };
  const sfx = mode === "visage" ? "-visage" : "";
  await renderMedia({ composition: comp, serveUrl, codec: "h264", crf: mode === "visage" ? 30 : 22, scale: 0.5, outputLocation: resolve(sortie, `${id}${sfx}.mp4`), inputProps, muted: mode === "visage", concurrency: 2, timeoutInMilliseconds: 180000, pixelFormat: "yuv420p" });
  console.log(id, "ok");
}
