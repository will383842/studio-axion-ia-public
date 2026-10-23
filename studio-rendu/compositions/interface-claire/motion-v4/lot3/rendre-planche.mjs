/**
 * Rend les extraits du lot 3 (v4, palette B seule) : MP4 540×960, 30 i/s, avec bruitages et voix de la prise. Usage :
 *   node rendre-planche.mjs <public> <sortie> <bundle-temporaire> <tache> [tache ...]
 *   tâches : extrait:<Element>          ench
 *            still:<Element>:<fond>:<n1,n2,...>   images fixes 1080×1920 → <Element>-<fond>-i<n>.png (fond = prise|blanc|noir|broll)
 *            audit:<Element|ench>       rend sans sortie utile (échelle 0,25) et écrit <sortie>/audit-<nom>.json (rectangles et empreintes par image)
 * Le dossier public doit contenir : prise-commune-15s.mp4, sons/*.wav, polices/Montserrat-Black.ttf, broll/broll-bureau-ordinateur.mp4.
 * Rend en crf 18 : le réencodage final (crf 28, < 3 Mo, limiteur -12 dBFS) est fait par `encoder.sh`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const [publicDir, sortie, bundleDir, ...taches] = process.argv.slice(2);
mkdirSync(sortie, { recursive: true });
const serveUrl = await bundle({ entryPoint: resolve(import.meta.dirname, "entree-planche.tsx"), publicDir: resolve(publicDir), outDir: resolve(bundleDir) });
const browserExecutable = process.env.NAVIGATEUR_CHROMIUM || undefined; // chemin d'un Chromium local si le téléchargement est impossible
const commun = { browserExecutable, codec: "h264", crf: 18, scale: 0.5, pixelFormat: "yuv420p", x264Preset: "medium", audioCodec: "aac", audioBitrate: "192k", concurrency: 2 };
for (const tache of taches) {
  const [genre, a, b, c] = tache.split(":");
  const debut = Date.now();
  if (genre === "extrait") {
    const props = { element: a, palette: "B", fond: "prise", audit: false };
    const composition = await selectComposition({ serveUrl, browserExecutable, id: "ExtraitLot3", inputProps: props });
    await renderMedia({ composition, serveUrl, ...commun, outputLocation: resolve(sortie, `${a}-B.mp4`), inputProps: props });
  } else if (genre === "ench") {
    const props = { palette: "B", audit: false };
    const composition = await selectComposition({ serveUrl, browserExecutable, id: "EnchainementLot3", inputProps: props });
    await renderMedia({ composition, serveUrl, ...commun, outputLocation: resolve(sortie, `lot3-enchainement-15s-B.mp4`), inputProps: props });
  } else if (genre === "still") {
    for (const n of c.split(",").map(Number)) {
      const props = { element: a, palette: "B", fond: b, audit: false };
      const composition = await selectComposition({ serveUrl, browserExecutable, id: "ExtraitLot3", inputProps: props });
      await renderStill({ composition, serveUrl, browserExecutable, output: resolve(sortie, `${a}-${b}-i${n}.png`), inputProps: props, frame: n, scale: 0.5 });
    }
  } else if (genre === "audit") {
    const journal = [];
    const ench = a === "ench";
    const props = ench ? { palette: "B", audit: true } : { element: a, palette: "B", fond: "prise", audit: true };
    const composition = await selectComposition({ serveUrl, browserExecutable, id: ench ? "EnchainementLot3" : "ExtraitLot3", inputProps: props });
    await renderMedia({ composition, serveUrl, codec: "h264", crf: 40, scale: 0.25, muted: true, browserExecutable, concurrency: 2, outputLocation: resolve(bundleDir, "audit.mp4"), inputProps: props,
      onBrowserLog: (l) => { if (l.text.startsWith("AUDIT ")) journal.push(JSON.parse(l.text.slice(6))); } });
    journal.sort((x, y) => x.f - y.f);
    writeFileSync(resolve(sortie, `audit-${a}.json`), JSON.stringify(journal));
  }
  console.log(tache, "ok", ((Date.now() - debut) / 1000).toFixed(1), "s");
}
