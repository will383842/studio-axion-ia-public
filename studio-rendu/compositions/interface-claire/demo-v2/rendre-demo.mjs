/**
 * Rend la démo 15 s « v2 énergie » (composition `InterfaceClaireDemoV2`, 540 × 960, 30 i/s) en MP4 h264 compact.
 * Usage (depuis `studio-rendu/`) :
 *   node compositions/interface-claire/demo-v2/rendre-demo.mjs <sortie.mp4> [chemin-du-navigateur]
 * Les bruitages (`sons/*.wav`) sont servis depuis un dossier public TEMPORAIRE (lien vers le dossier `sons/` de la composition) ;
 * le paquet temporaire est effacé ensuite. Sans chemin de navigateur, Remotion utilise celui qu'il installe (`npm run navigateur`).
 */
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = resolve(ici, "../../..");
const [sortie, navigateur] = process.argv.slice(2);
if (!sortie) throw new Error("Usage : node rendre-demo.mjs <sortie.mp4> [navigateur]");
const temp = mkdtempSync(join(tmpdir(), "demo-v2-"));
const publicDir = join(temp, "public");
mkdirSync(publicDir);
symlinkSync(resolve(ici, "../sons"), join(publicDir, "sons"));
try {
  const serveUrl = await bundle({ entryPoint: resolve(racine, "compositions/index.ts"), publicDir, outDir: join(temp, "bundle") });
  const composition = await selectComposition({ serveUrl, id: "InterfaceClaireDemoV2", ...(navigateur ? { browserExecutable: navigateur } : {}) });
  console.log("composition", composition.width, "x", composition.height, composition.fps, "i/s", composition.durationInFrames, "images");
  mkdirSync(dirname(resolve(sortie)), { recursive: true });
  await renderMedia({
    composition, serveUrl, codec: "h264", crf: 28, audioBitrate: "96k", outputLocation: resolve(sortie),
    ...(navigateur ? { browserExecutable: navigateur } : {}), concurrency: 2,
    onProgress: ({ progress }) => { if (Math.round(progress * 100) % 20 === 0) process.stdout.write(`${Math.round(progress * 100)} % `); },
  });
  console.log("\nécrit", resolve(sortie));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
