/**
 * PLANCHES DU MOTION DESIGN EN DEUX STYLES (facecam lot C2) : rend les 6 modèles en vidéos de 5 s 1080 × 1920 avec les
 * données d'exemple Axion (`exemples-axion.ts`), en style « sobre » (corrigé : plein écran recentré et agrandi) et/ou
 * « spectaculaire », puis écrit les pages HTML (même gabarit que la première planche ; la planche Spectaculaire montre
 * chaque modèle Sobre et Spectaculaire côte à côte).
 *
 * Usage (depuis `studio-rendu/`) :
 *   npx tsx scripts/planche-motion-styles.ts                          → les deux planches
 *   npx tsx scripts/planche-motion-styles.ts --style spectaculaire    → une seule planche
 *   npx tsx scripts/planche-motion-styles.ts --style sobre liste      → un modèle
 *   npx tsx scripts/planche-motion-styles.ts --images --style spectaculaire liste → images fixes de contrôle
 *   STUDIO_RENDU_NAVIGATEUR=/chemin/chrome                            → navigateur sans affichage à utiliser
 * Rendu en local, sans serveur : mêmes compositions que l'opération `composition` (sans mode) du conteneur.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { CATALOGUE_MOTION, IDS_MODELES_MOTION } from "../../src/briques/motion/catalogue";
import { carteExempleAxion } from "../../src/briques/motion/exemples-axion";
import { FICHES_STYLE_MOTION, STYLES_MOTION, type StyleMotion } from "../../src/briques/motion/style";
import type { IdModeleMotion, MiseEnPageCarte } from "../../src/briques/motion/types";

const racine = resolve(import.meta.dirname, "..");
const DOSSIERS: Record<StyleMotion, string> = {
  sobre: resolve(racine, "../docs/facecam/planche-motion"),
  spectaculaire: resolve(racine, "../docs/facecam/planche-motion-spectaculaire"),
};

const args = process.argv.slice(2);
const images = args.includes("--images");
const iStyle = args.indexOf("--style");
const styleDemande = iStyle >= 0 ? (args[iStyle + 1] as StyleMotion) : null;
const styles: StyleMotion[] = styleDemande && STYLES_MOTION.includes(styleDemande) ? [styleDemande] : [...STYLES_MOTION];
const choisis = (args.filter((a, i) => !a.startsWith("--") && i !== iStyle + 1) as IdModeleMotion[]).filter((a) => IDS_MODELES_MOTION.includes(a));
const modeles = choisis.length ? choisis : IDS_MODELES_MOTION;
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR;
// Sans navigateur imposé : Remotion obtient le sien (ensureBrowser) ou échoue avec son message ; aucun chemin en dur.
if (!navigateur) await ensureBrowser();
const instants = (process.env.PLANCHE_INSTANTS ?? "0.2,0.5,1,1.5,2,3,4,4.7").split(",").map(Number);

const MISE_EN_PAGE: MiseEnPageCarte = { ratio: "9:16", largeur: 1080, hauteur: 1920, hauteurVideo: 1920, disposition: "plein-ecran", fps: 25, images: 125 };
/** Plafond de poids d'une vidéo de planche (consigne : < 3 Mo). */
const POIDS_MAX = 3e6;

const serveUrl = await bundle({ entryPoint: resolve(racine, "compositions/index.ts") });
const reglages = { browserExecutable: navigateur ?? null, chromiumOptions: { gl: "swangle" as const } };

for (const style of styles) {
  const sortie = DOSSIERS[style];
  mkdirSync(sortie, { recursive: true });
  for (const id of modeles) {
    const fiche = CATALOGUE_MOTION[id];
    // Style « sobre » : propriété absente (rendu par défaut) ; « spectaculaire » : propriété posée.
    const proprietes = { ...MISE_EN_PAGE, ...(style === "spectaculaire" ? { style } : {}), ...carteExempleAxion(id) } as unknown as Record<string, unknown>;
    const composition = await selectComposition({ serveUrl, id: fiche.composition, inputProps: proprietes, ...reglages });
    const debut = Date.now();
    if (images) {
      const dossier = resolve(racine, ".planche-images");
      mkdirSync(dossier, { recursive: true });
      for (const s of instants) {
        const output = resolve(dossier, `${style}-${id}-${String(Math.round(s * 10)).padStart(2, "0")}.png`);
        await renderStill({ composition, serveUrl, output, frame: Math.min(124, Math.round(s * 25)), inputProps: proprietes, ...reglages });
      }
      console.log(`${style} ${id} : images fixes en ${((Date.now() - debut) / 1000).toFixed(1)} s`);
      continue;
    }
    const fichier = resolve(sortie, `${id}.mp4`);
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      crf: 18,
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
    // Trop lourd : réencodage en deux passes au débit qui tient sous 3 Mo (cible 2,5 Mo : le deux-passes dépasse un peu).
    if (statSync(fichier).size >= POIDS_MAX) {
      const debit = Math.floor((2.5e6 * 8) / (MISE_EN_PAGE.images / MISE_EN_PAGE.fps) / 1000);
      const temporaire = `${fichier}.source.mp4`;
      renameSync(fichier, temporaire);
      const commun = ["-y", "-loglevel", "error", "-i", temporaire, "-c:v", "libx264", "-preset", "slow", "-b:v", `${debit}k`, "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-an", "-passlogfile", `${fichier}.passe`];
      execFileSync("ffmpeg", [...commun, "-pass", "1", "-f", "mp4", "/dev/null"]);
      execFileSync("ffmpeg", [...commun, "-pass", "2", "-movflags", "+faststart", fichier]);
      for (const f of [temporaire, `${fichier}.passe-0.log`, `${fichier}.passe-0.log.mbtree`]) if (existsSync(f)) rmSync(f);
    }
    console.log(`${style} ${id} : ${(statSync(fichier).size / 1e6).toFixed(2)} Mo en ${((Date.now() - debut) / 1000).toFixed(1)} s`);
  }
  if (!images) ecrirePage(style);
}

function page(titre: string, intro: string, contenu: string, colonnes: string): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titre.replace(/<[^>]+>/g, "")}</title>
<style>
  :root { --fond: #16120F; --surface: #211A15; --orange: #C65A2E; --creme: #F6EEE0; --attenue: #A79E92; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--fond); color: var(--creme); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; padding: 32px 16px 64px; }
  header { max-width: 1200px; margin: 0 auto 28px; }
  h1 { font-size: 28px; margin: 0 0 6px; letter-spacing: -0.01em; }
  h1 b { color: var(--orange); }
  header p { color: var(--attenue); margin: 0; max-width: 720px; }
  header a { color: var(--orange); }
  main { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: ${colonnes}; gap: 22px; }
  figure { margin: 0; background: var(--surface); border-radius: 18px; overflow: hidden; box-shadow: 0 0 0 1px #3A322B; }
  .paire { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; background: #0C0A08; }
  .paire div { position: relative; }
  .paire span { position: absolute; top: 8px; left: 8px; z-index: 1; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; background: rgba(12, 10, 8, 0.75); padding: 2px 8px; border-radius: 99px; }
  .paire div:last-child span { color: var(--orange); }
  video { display: block; width: 100%; aspect-ratio: 9 / 16; background: #0C0A08; }
  figcaption { padding: 14px 16px 16px; display: grid; gap: 4px; }
  figcaption strong { font-size: 17px; }
  figcaption span { color: var(--attenue); font-size: 14px; }
  figcaption em { color: var(--orange); font-style: normal; font-size: 13px; font-weight: 600; }
</style>
</head>
<body>
<header>
  <h1>${titre}</h1>
  <p>${intro}</p>
</header>
<main>
    ${contenu}
</main>
</body>
</html>
`;
}

function ecrirePage(style: StyleMotion) {
  const sortie = DOSSIERS[style];
  if (style === "sobre") {
    const cartes = IDS_MODELES_MOTION.map((id) => {
      const f = CATALOGUE_MOTION[id];
      return `<figure><video src="${id}.mp4" autoplay muted loop playsinline controls></video><figcaption><strong>${f.nom}</strong><span>${f.description}</span><em>${f.automatique ? "Choisi tout seul d'après le texte" : "Seulement à la demande"}</em></figcaption></figure>`;
    }).join("\n    ");
    writeFileSync(
      resolve(sortie, "index.html"),
      page(
        "Motion design — <b>les 6 modèles</b>",
        `Style « ${FICHES_STYLE_MOTION.sobre.libelle} » (validé), corrigé : plein écran recentré et agrandi, textes des listes plus grands, exemples Axion. Chaque carte dure 5 s en 1080 × 1920 (25 i/s). Dans vos vidéos, chaque élément arrive au mot près, quand vous le dites. <a href="../planche-motion-spectaculaire/index.html">Voir le style Spectaculaire →</a>`,
        cartes,
        "repeat(auto-fill, minmax(260px, 1fr))",
      ),
    );
  } else {
    const cartes = IDS_MODELES_MOTION.map((id) => {
      const f = CATALOGUE_MOTION[id];
      return `<figure><div class="paire"><div><span>Sobre</span><video src="../planche-motion/${id}.mp4" autoplay muted loop playsinline controls></video></div><div><span>Spectaculaire</span><video src="${id}.mp4" autoplay muted loop playsinline controls></video></div></div><figcaption><strong>${f.nom}</strong><span>${f.description}</span><em>${f.automatique ? "Choisi tout seul d'après le texte" : "Seulement à la demande"}</em></figcaption></figure>`;
    }).join("\n    ");
    writeFileSync(
      resolve(sortie, "index.html"),
      page(
        "Motion design — <b>style Spectaculaire</b>",
        `${FICHES_STYLE_MOTION.spectaculaire.description} Mêmes modèles, mêmes données, même charte que le style Sobre (à gauche). Choisi tout seul en intensité « Très dynamique », ou à la demande : « Monteur, fais cette animation en spectaculaire ». Chaque carte dure 5 s en 1080 × 1920 (25 i/s). <a href="../planche-motion/index.html">← Planche Sobre</a>`,
        cartes,
        "repeat(auto-fill, minmax(min(100%, 480px), 1fr))",
      ),
    );
  }
  console.log(`Page : ${resolve(sortie, "index.html")}`);
}
