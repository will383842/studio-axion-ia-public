/**
 * Rend la démo v3 (composition `InterfaceClaireDemoV3`, 1080 × 1920, 30 i/s, ~22 s) en MP4 h264 compact.
 * Usage (depuis `studio-rendu/`) :
 *   node compositions/interface-claire/demo-v3/rendre-demo.mjs <sortie.mp4> [chemin-du-navigateur]
 * Prépare un dossier public TEMPORAIRE (effacé ensuite) : `sons/` (lien), `prise-demo.mp4` (l'image fixe de la prise en vidéo : aucun
 * mouvement) et `broll/*.mp4` — des PLACEHOLDERS générés par ffmpeg (aucune banque vidéo n'est jointe au dépôt).
 */
import { execFileSync } from "node:child_process";
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

const ffmpeg = (...args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
/** Placeholder vidéo animé 1080 × 1350, 6 s : motif mobile teinté + légende (ce que la vraie vidéo devrait montrer). */
function placeholder(fichier, teinte, legende) {
  const vf = [
    `colorchannelmixer=${teinte}`,
    "drawbox=x=0:y=ih-170:w=iw:h=170:color=black@0.55:t=fill",
    `drawtext=text='PLACEHOLDER · ${legende}':fontcolor=white:fontsize=44:x=(w-text_w)/2:y=h-110`,
  ].join(",");
  ffmpeg("-f", "lavfi", "-i", "testsrc2=size=1080x1350:rate=30:duration=6", "-vf", vf, "-c:v", "libx264", "-crf", "30", "-pix_fmt", "yuv420p", "-an", fichier);
}

const temp = mkdtempSync(join(tmpdir(), "demo-v3-"));
const publicDir = join(temp, "public");
mkdirSync(join(publicDir, "broll"), { recursive: true });
symlinkSync(resolve(ici, "../sons"), join(publicDir, "sons"));
try {
  ffmpeg("-loop", "1", "-framerate", "30", "-i", resolve(ici, "../demo-v2/prise-commune-1080x1920.png"), "-t", "23.5", "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", "-an", join(publicDir, "prise-demo.mp4"));
  placeholder(join(publicDir, "broll/telephone.mp4"), "rr=1:gg=0.8:bb=0.6", "client qui lit une relance sur son telephone");
  placeholder(join(publicDir, "broll/livraison.mp4"), "rr=0.7:gg=1:bb=0.7", "documents qui partent chez le client");
  placeholder(join(publicDir, "broll/agenda.mp4"), "rr=0.7:gg=0.8:bb=1", "personne qui consulte son agenda");
  const serveUrl = await bundle({ entryPoint: resolve(racine, "compositions/index.ts"), publicDir, outDir: join(temp, "bundle") });
  const opts = navigateur ? { browserExecutable: navigateur } : {};
  const composition = await selectComposition({ serveUrl, id: "InterfaceClaireDemoV3", ...opts });
  console.log("composition", composition.width, "x", composition.height, composition.fps, "i/s", composition.durationInFrames, "images");
  mkdirSync(dirname(resolve(sortie)), { recursive: true });
  await renderMedia({
    composition, serveUrl, codec: "h264", crf: 28, audioBitrate: "96k", outputLocation: resolve(sortie), ...opts, concurrency: 2, timeoutInMilliseconds: 240000,
    onProgress: ({ progress }) => { if (Math.round(progress * 100) % 10 === 0) process.stdout.write(`${Math.round(progress * 100)} % `); },
  });
  console.log("\nécrit", resolve(sortie));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
