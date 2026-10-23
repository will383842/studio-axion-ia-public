/**
 * Rend des stills TRANSPARENTS du banc d'essai du lot 1.
 *   npx tsx <ce fichier> <dossierSortie> <id>:<k1>,<k2>,...  [<id>:...]
 * `k` = images relatives à i0 (i0 = image 12 du banc). Un seul calcul lourd à la fois : prendre le verrou avant.
 */
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";

const racine = resolve(import.meta.dirname, "../../../../../..");
const sortie = resolve(process.argv[2]);
mkdirSync(sortie, { recursive: true });
const demandes = process.argv.slice(3).map((a) => {
  const [id, ks] = a.split(":");
  return { id, ks: ks.split(",").map(Number) };
});
const DEBUT = 12;

const dossierBundle = resolve(sortie, "_bundle");
const serveUrl = await bundle({ entryPoint: resolve(import.meta.dirname, "entree-lot1.tsx"), rootDir: racine, outDir: dossierBundle, publicDir: resolve(sortie, "../vide") });
const navigateur = await openBrowser("chrome", { chromiumOptions: { gl: "swangle" } });
try {
  for (const d of demandes) {
    const composition = await selectComposition({ serveUrl, id: d.id, puppeteerInstance: navigateur });
    for (const k of d.ks) {
      const frame = Math.max(0, Math.min(89, DEBUT + k));
      await renderStill({
        composition,
        serveUrl,
        frame,
        imageFormat: "png",
        output: resolve(sortie, `${d.id}__${String(k).padStart(3, "0").replace("-", "m")}.png`),
        puppeteerInstance: navigateur,
      });
    }
    console.log(`${d.id} : ${d.ks.length} images`);
  }
} finally {
  await navigateur.close({ silent: true });
  rmSync(dossierBundle, { recursive: true, force: true });
}
