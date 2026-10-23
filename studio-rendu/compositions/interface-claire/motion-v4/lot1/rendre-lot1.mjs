/**
 * Rend les extraits du lot 1 v4 : MP4 540×960 (scale 0,5), 30 i/s, H.264 crf 28, avec la voix de la prise et les bruitages.
 * Rendu dans le cloud uniquement. Usage (depuis `studio-rendu/`) :
 *   node compositions/interface-claire/motion-v4/lot1/rendre-lot1.mjs <dossier-sortie> <dossier-temporaire> <tache> [tache ...]
 *   tâches (palette B seule) : `extrait:<Nom>` · `ench` · `tout` (8 éléments + l'enchaînement)
 *                              `fond:<Nom>:<prise|blanc|noir|broll>:<image>` → PNG `<Nom>-<fond>-<image>.png` (test des 4 fonds)
 * Le dossier temporaire reçoit le « public » (sons, polices, prise) et le bundle ; c'est le SEUL à effacer ensuite.
 */
import { copyFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const racine = resolve(import.meta.dirname, "../../../..");            // studio-rendu/
const ic = resolve(import.meta.dirname, "../..");                      // compositions/interface-claire/
const [sortie, tmp, ...taches] = process.argv.slice(2);
const IDS = ["EtiquetteTete", "Interjection", "BadgeCompteur", "BadgeProfil", "LogoOutil", "RangeePastilles", "Equation", "MotSaute"];

const publicDir = resolve(tmp, "public");
mkdirSync(join(publicDir, "sons"), { recursive: true });
mkdirSync(join(publicDir, "polices"), { recursive: true });
for (const f of readdirSync(join(ic, "sons"))) if (f.endsWith(".wav")) copyFileSync(join(ic, "sons", f), join(publicDir, "sons", f));
copyFileSync(resolve(racine, "../src/briques/sous-titres/polices/Montserrat-Black.ttf"), join(publicDir, "polices/Montserrat-Black.ttf"));
copyFileSync(resolve(racine, "compositions/commune/polices/Inter-Bold.ttf"), join(publicDir, "polices/Inter-Bold.ttf"));
copyFileSync(join(ic, "motion-v4/communs/prise-commune-15s.mp4"), join(publicDir, "prise-15s.mp4"));
copyFileSync(join(ic, "motion-v4/communs/broll/chantier-perceuse-vertical.mp4"), join(publicDir, "fond-broll.mp4"));
mkdirSync(sortie, { recursive: true });

const serveUrl = await bundle({ entryPoint: resolve(import.meta.dirname, "entree-lot1.tsx"), publicDir, outDir: resolve(tmp, "bundle") });
const navigateur = ["/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((c) => existsSync(c));
const commun = { codec: "h264", crf: 28, scale: 0.5, pixelFormat: "yuv420p", x264Preset: "medium", audioBitrate: "128k", ...(navigateur ? { browserExecutable: navigateur } : {}), chromiumOptions: { gl: "swangle" } };

const liste = taches.flatMap((t) => (t === "tout" ? [...IDS.map((id) => `extrait:${id}`), "ench"] : [t]));
const opts = navigateur ? { browserExecutable: navigateur } : {};
for (const tache of liste) {
  const [genre, a, b, c] = tache.split(":");
  const debut = Date.now();
  const id = genre === "ench" ? "Enchainement" : `Extrait-${a}`;
  const fondTest = genre === "fond" ? (b === "broll" ? "fond-broll.mp4" : b) : "prise";
  const props = { palette: "B", fondTest };
  const composition = await selectComposition({ serveUrl, id, inputProps: props, ...opts, chromiumOptions: commun.chromiumOptions });
  if (genre === "fond") {
    await renderStill({ composition, serveUrl, ...opts, chromiumOptions: commun.chromiumOptions, inputProps: props, frame: Number(c), scale: 0.5, imageFormat: "png", output: resolve(sortie, `${a}-${b}-${c}.png`) });
  } else {
    const fichier = genre === "ench" ? "lot1-enchainement-15s-B.mp4" : `${a}-B.mp4`;
    await renderMedia({ composition, serveUrl, ...commun, outputLocation: resolve(sortie, fichier), inputProps: props });
  }
  console.log(tache, "ok", ((Date.now() - debut) / 1000).toFixed(1), "s");
}
