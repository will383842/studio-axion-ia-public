/**
 * Rend une vidéo COMPLÈTE v4 (composition `InterfaceClaireFaceCameraV4`, 1080 × 1920, 30 i/s, voix de Will) à partir d'un plan à `elementsV4`.
 * Usage (depuis `studio-rendu/`) :
 *   node compositions/interface-claire/motion-v4/rendre-repetition.mjs <plan.json> <prise-montee.mp4> <sortie.mp4> [dossier-de-travail]
 * Variables : IMAGES="12,40,90" → images fixes PNG dans <sortie sans .mp4>-stills/ au lieu de la vidéo ; ECHELLE (défaut 1) ; CRF (défaut 18) ;
 *             DEBIT_MAX (défaut 3400k : vidéo finale < 40 Mo pour 90 s) ; NAVIGATEUR ; CONCURRENCE (défaut 4) ; PLAGE="a-b" (images, rendu partiel).
 * Dossier public TEMPORAIRE assemblé ici : prise montée, `sons/` (studio + maison du lot 5), `broll/`, `polices/`, `marque/`. Rien n'est effacé hors du dossier de travail.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const ici = import.meta.dirname;
const interfaceClaire = resolve(ici, "..");
const racine = resolve(interfaceClaire, "..", "..");
const [fichierPlan, prise, sortie, travailArg] = process.argv.slice(2);
if (!fichierPlan || !prise || !sortie) throw new Error("Usage : node rendre-repetition.mjs <plan.json> <prise-montee.mp4> <sortie.mp4> [dossier-de-travail]");
const navigateur = process.env.NAVIGATEUR ?? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const plan = JSON.parse(readFileSync(resolve(fichierPlan), "utf8"));
const travail = resolve(travailArg ?? join(tmpdir(), `repetition-v4-${process.pid}`));
const publicDir = join(travail, "public");
mkdirSync(publicDir, { recursive: true });

// Assemblage du dossier public (les lots chargent leurs polices et leurs sons par `staticFile`).
cpSync(resolve(prise), join(publicDir, plan.prise.src));
mkdirSync(join(publicDir, "sons"), { recursive: true });
for (const d of [join(interfaceClaire, "sons"), join(ici, "lot5", "sons")]) for (const n of readdirSync(d)) if (n.endsWith(".wav")) cpSync(join(d, n), join(publicDir, "sons", n));
cpSync(join(ici, "communs", "broll"), join(publicDir, "broll"), { recursive: true });
mkdirSync(join(publicDir, "polices"), { recursive: true });
cpSync(join(ici, "lot5", "polices"), join(publicDir, "polices"), { recursive: true });
cpSync(join(ici, "lot2", "polices", "Montserrat-Black.ttf"), join(publicDir, "polices", "Montserrat-Black.ttf"));
cpSync(join(racine, "compositions", "commune", "polices", "Inter-Bold.ttf"), join(publicDir, "polices", "Inter-Bold.ttf"));
cpSync(join(ici, "lot5", "marque"), join(publicDir, "marque"), { recursive: true });

const t0 = Date.now();
const serveUrl = await bundle({ entryPoint: resolve(racine, "compositions", "index.ts"), publicDir, outDir: join(travail, "bundle") });
const opts = { browserExecutable: navigateur };
const composition = await selectComposition({ serveUrl, id: "InterfaceClaireFaceCameraV4", inputProps: plan, ...opts });
console.log("composition", composition.width, "x", composition.height, composition.fps, "i/s", composition.durationInFrames, "images");

if (process.env.IMAGES) {
  const dossier = resolve(sortie.replace(/\.mp4$/, "") + "-stills");
  mkdirSync(dossier, { recursive: true });
  for (const f of process.env.IMAGES.split(",").map(Number)) {
    await renderStill({ composition, serveUrl, output: join(dossier, `i${String(f).padStart(5, "0")}.png`), frame: f, inputProps: plan, scale: Number(process.env.ECHELLE ?? 0.5), timeoutInMilliseconds: 180000, ...opts });
  }
  console.log("images fixes écrites dans", dossier);
} else {
  const brut = join(travail, "brut.mp4");
  const plage = process.env.PLAGE ? process.env.PLAGE.split("-").map(Number) : null;
  await renderMedia({
    composition, serveUrl, codec: "h264", crf: Number(process.env.CRF ?? 18), pixelFormat: "yuv420p", audioCodec: "aac", audioBitrate: "160k", scale: Number(process.env.ECHELLE ?? 1),
    outputLocation: brut, inputProps: plan, concurrency: Number(process.env.CONCURRENCE ?? 4), timeoutInMilliseconds: 300000, ...(plage ? { frameRange: plage } : {}), ...opts,
    onProgress: ({ progress }) => { const p = Math.round(progress * 100); if (p % 10 === 0 && p !== globalThis.__p) { globalThis.__p = p; process.stdout.write(`${p} % `); } },
  });
  mkdirSync(dirname(resolve(sortie)), { recursive: true });
  const debit = process.env.DEBIT_MAX ?? "3400k";
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", brut, "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-maxrate", debit, "-bufsize", "7000k", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-movflags", "+faststart", resolve(sortie)]);
  console.log(`\nécrit ${resolve(sortie)} (${(statSync(resolve(sortie)).size / 1e6).toFixed(1)} Mo) en ${Math.round((Date.now() - t0) / 1000)} s`);
}
if (!process.env.GARDER_TRAVAIL && !travailArg) rmSync(travail, { recursive: true, force: true });
void existsSync;
