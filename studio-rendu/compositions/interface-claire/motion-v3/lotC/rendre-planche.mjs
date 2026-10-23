/**
 * Rend les extraits MP4 (540×960, 30 i/s, h264) du lot C et l'enchaînement de 15 s.
 * À lancer SOUS LE VERROU `_VERROU-DESIGNERS-V3`. Usage :
 *   node rendre-planche.mjs <dossier-public-avec-prise.png> <dossier-de-sortie> <dossier-bundle-temporaire> [id ...]
 * (id : carte-verre, carte-preuve, notifications-verre, widget-chiffre, carte-retournee, enchainement ; sans id : tous).
 * Le dossier de bundle est le SEUL à effacer ensuite.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const [publicDir, sortie, bundleDir, ...ids] = process.argv.slice(2);
mkdirSync(sortie, { recursive: true });
const TOUS = ["carte-verre", "carte-preuve", "notifications-verre", "widget-chiffre", "carte-retournee", "enchainement"];
const choisis = ids.length ? ids : TOUS;
const serveUrl = await bundle({ entryPoint: resolve(import.meta.dirname, "entree-planche.tsx"), publicDir: resolve(publicDir), outDir: resolve(bundleDir) });
for (const id of choisis) {
  const compId = id === "enchainement" ? "EnchainementLotC" : `Extrait-${id}`;
  const props = id === "enchainement" ? {} : { element: id, sansPrise: false };
  const composition = await selectComposition({ serveUrl, id: compId, inputProps: props });
  const t0 = Date.now();
  await renderMedia({ composition, serveUrl, codec: "h264", crf: 20, scale: 0.5, concurrency: 2, outputLocation: resolve(sortie, id === "enchainement" ? "enchainement-15s.mp4" : `${id}.mp4`), inputProps: props, muted: false, audioCodec: "aac" });
  console.log(id, "ok", Math.round((Date.now() - t0) / 1000), "s");
}
