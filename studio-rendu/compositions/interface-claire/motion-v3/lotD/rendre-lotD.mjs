/**
 * Rend les extraits (MP4 540x960, 30 i/s, avec bruitages) du lot D et l'enchaînement de 15 s.
 * `node rendre-lotD.mjs <dossier-public> <dossier-bundle> <dossier-sortie> [id ...]`
 * <dossier-public> : prise-commune.png, masque-will.png, sons/*.wav. À lancer sous le verrou des designers.
 */
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const [pub, outDir, sortie, ...ids] = process.argv.slice(2);
mkdirSync(sortie, { recursive: true });
const serveUrl = await bundle({ entryPoint: resolve(import.meta.dirname, "entree-lotD.ts"), publicDir: pub, outDir });
const tous = ["mot-vertical-bord", "mot-saute", "mot-derriere", "rafale-trois-mots", "citation-verre", "enchainement"];
for (const id of ids.length ? ids : tous) {
  const composition = await selectComposition({ serveUrl, id: `lotD-${id}` });
  await renderMedia({ composition, serveUrl, codec: "h264", crf: 22, scale: 0.5, outputLocation: resolve(sortie, id === "enchainement" ? "enchainement-lotD-15s.mp4" : `${id}.mp4`), concurrency: 2, pixelFormat: "yuv420p" });
  console.log(id, "ok");
}
