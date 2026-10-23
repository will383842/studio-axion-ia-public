/**
 * PLANCHE DE VALIDATION DU MOTION DESIGN (facecam lot C) : rend les 6 modèles d'excellence en vidéos de 5 s
 * 1080 × 1920 avec leurs données d'exemple (catalogue), puis écrit une page HTML unique qui les montre à Will.
 *
 * Usage (depuis `studio-rendu/`) :
 *   npx tsx scripts/planche-motion.ts                 → les 6 vidéos + la page, dans docs/facecam/planche-motion/
 *   npx tsx scripts/planche-motion.ts --images liste  → seulement des images fixes de contrôle (0,5 s, 1 s, 2 s…)
 *   STUDIO_RENDU_NAVIGATEUR=/chemin/chrome            → navigateur sans affichage à utiliser (sinon celui de Remotion)
 * Rendu en local, sans serveur : mêmes compositions que l'opération `composition` (sans mode) du conteneur.
 */
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { CATALOGUE_MOTION, IDS_MODELES_MOTION, carteExemple } from "../../src/briques/motion/catalogue";
import type { IdModeleMotion, MiseEnPageCarte } from "../../src/briques/motion/types";

const racine = resolve(import.meta.dirname, "..");
const sortie = resolve(racine, "../docs/facecam/planche-motion");
mkdirSync(sortie, { recursive: true });

const args = process.argv.slice(2);
const images = args.includes("--images");
const choisis = (args.filter((a) => !a.startsWith("--")) as IdModeleMotion[]).filter((a) => IDS_MODELES_MOTION.includes(a));
const modeles = choisis.length ? choisis : IDS_MODELES_MOTION;
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR ?? ["/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"].find((c) => existsSync(c));

const MISE_EN_PAGE: MiseEnPageCarte = { ratio: "9:16", largeur: 1080, hauteur: 1920, hauteurVideo: 1920, disposition: "plein-ecran", fps: 25, images: 125 };

const serveUrl = await bundle({ entryPoint: resolve(racine, "compositions/index.ts") });
const reglages = { browserExecutable: navigateur ?? null, chromiumOptions: { gl: "swangle" as const } };

for (const id of modeles) {
  const fiche = CATALOGUE_MOTION[id];
  const proprietes = { ...MISE_EN_PAGE, ...carteExemple(id) } as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: fiche.composition, inputProps: proprietes, ...reglages });
  const debut = Date.now();
  if (images) {
    const dossier = resolve(racine, ".planche-images");
    mkdirSync(dossier, { recursive: true });
    for (const s of [0.2, 0.5, 1, 1.5, 2, 3, 4, 4.7]) {
      const output = resolve(dossier, `${id}-${String(Math.round(s * 10)).padStart(2, "0")}.png`);
      await renderStill({ composition, serveUrl, output, frame: Math.round(s * 25), inputProps: proprietes, ...reglages });
    }
    console.log(`${id} : images fixes en ${((Date.now() - debut) / 1000).toFixed(1)} s`);
    continue;
  }
  const fichier = resolve(sortie, `${id}.mp4`);
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf: 21,
    x264Preset: "slow",
    pixelFormat: "yuv420p",
    colorSpace: "bt709",
    imageFormat: "jpeg",
    jpegQuality: 96,
    muted: true,
    outputLocation: fichier,
    inputProps: proprietes,
    concurrency: 4,
    ...reglages,
  });
  console.log(`${id} : ${(statSync(fichier).size / 1e6).toFixed(2)} Mo en ${((Date.now() - debut) / 1000).toFixed(1)} s`);
}

if (!images) {
  const cartes = IDS_MODELES_MOTION.map((id) => {
    const f = CATALOGUE_MOTION[id];
    return `<figure><video src="${id}.mp4" autoplay muted loop playsinline controls></video><figcaption><strong>${f.nom}</strong><span>${f.description}</span><em>${f.automatique ? "Choisi tout seul d'après le texte" : "Seulement à la demande"}</em></figcaption></figure>`;
  }).join("\n    ");
  writeFileSync(
    resolve(sortie, "index.html"),
    `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Planche motion design</title>
<style>
  :root { --fond: #16120F; --surface: #211A15; --orange: #C65A2E; --creme: #F6EEE0; --attenue: #A79E92; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--fond); color: var(--creme); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; padding: 32px 16px 64px; }
  header { max-width: 1200px; margin: 0 auto 28px; }
  h1 { font-size: 28px; margin: 0 0 6px; letter-spacing: -0.01em; }
  h1 b { color: var(--orange); }
  header p { color: var(--attenue); margin: 0; max-width: 720px; }
  main { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 22px; }
  figure { margin: 0; background: var(--surface); border-radius: 18px; overflow: hidden; box-shadow: 0 0 0 1px #3A322B; }
  video { display: block; width: 100%; aspect-ratio: 9 / 16; background: #0C0A08; }
  figcaption { padding: 14px 16px 16px; display: grid; gap: 4px; }
  figcaption strong { font-size: 17px; }
  figcaption span { color: var(--attenue); font-size: 14px; }
  figcaption em { color: var(--orange); font-style: normal; font-size: 13px; font-weight: 600; }
</style>
</head>
<body>
<header>
  <h1>Motion design — <b>les 6 modèles</b></h1>
  <p>Chaque carte dure 5 s en 1080 × 1920 (25 i/s), avec des données d'exemple. Dans vos vidéos, chaque élément arrive au mot près, quand vous le dites.</p>
</header>
<main>
    ${cartes}
</main>
</body>
</html>
`,
  );
  console.log(`Page : ${resolve(sortie, "index.html")}`);
}
