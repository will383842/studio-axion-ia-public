/**
 * PLANCHE DES MODÈLES 7 À 13 (lot F2) : rend chaque modèle en vidéo de 5 s 1080 × 1920 (25 i/s) avec les données
 * d'exemple Axion, en style « sobre » et « spectaculaire », puis écrit la page HTML (même gabarit que les planches du
 * lot C2 : chaque modèle Sobre et Spectaculaire côte à côte). Le graphique est montré dans ses trois variantes.
 *
 * Usage (depuis `studio-rendu/`) :
 *   npx tsx scripts/planche-motion-7-13.ts                               → toute la planche (2 styles)
 *   npx tsx scripts/planche-motion-7-13.ts --style spectaculaire         → un style
 *   npx tsx scripts/planche-motion-7-13.ts --style sobre check-list      → une entrée
 *   npx tsx scripts/planche-motion-7-13.ts --images --style sobre graphique → images fixes de contrôle (.planche-images/)
 *   npx tsx scripts/planche-motion-7-13.ts --page                         → la page seule
 * Rendu en local, sans serveur : mêmes compositions que l'opération `composition` (sans mode) du conteneur.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { CATALOGUE_MOTION_ETENDU } from "../../src/briques/motion/catalogue-etendu";
import { EXEMPLES_AXION_ETENDUS, EXEMPLES_GRAPHIQUE } from "../../src/briques/motion/exemples-axion-etendus";
import { FICHES_STYLE_MOTION, STYLES_MOTION, type StyleMotion } from "../../src/briques/motion/style";
import type { MiseEnPageCarte } from "../../src/briques/motion/types";
import type { IdModeleMotionEtendu } from "../../src/briques/motion/types-etendus";

const racine = resolve(import.meta.dirname, "..");
const DOSSIER = resolve(racine, "../docs/facecam/planche-motion-7-13");

interface Entree {
  cle: string;
  id: IdModeleMotionEtendu;
  donnees: unknown;
  /** Précision sous le nom (variante du graphique). */
  variante?: string;
}

const ENTREES: Entree[] = [
  { cle: "graphique-barres", id: "graphique", donnees: EXEMPLES_AXION_ETENDUS.graphique, variante: "barres" },
  { cle: "graphique-courbe", id: "graphique", donnees: EXEMPLES_GRAPHIQUE.courbe, variante: "courbe" },
  { cle: "graphique-camembert", id: "graphique", donnees: EXEMPLES_GRAPHIQUE.camembert, variante: "camembert" },
  { cle: "icone-mot", id: "icone-mot", donnees: EXEMPLES_AXION_ETENDUS["icone-mot"] },
  { cle: "probleme-solution", id: "probleme-solution", donnees: EXEMPLES_AXION_ETENDUS["probleme-solution"] },
  { cle: "check-list", id: "check-list", donnees: EXEMPLES_AXION_ETENDUS["check-list"] },
  { cle: "capture-annotee", id: "capture-annotee", donnees: EXEMPLES_AXION_ETENDUS["capture-annotee"] },
  { cle: "titre-plein-ecran", id: "titre-plein-ecran", donnees: EXEMPLES_AXION_ETENDUS["titre-plein-ecran"] },
  { cle: "documentaire", id: "documentaire", donnees: EXEMPLES_AXION_ETENDUS.documentaire },
];

const args = process.argv.slice(2);
const images = args.includes("--images");
const pageSeule = args.includes("--page");
const iStyle = args.indexOf("--style");
const styleDemande = iStyle >= 0 ? (args[iStyle + 1] as StyleMotion) : null;
const styles: StyleMotion[] = styleDemande && STYLES_MOTION.includes(styleDemande) ? [styleDemande] : [...STYLES_MOTION];
const filtres = args.filter((a, i) => !a.startsWith("--") && i !== iStyle + 1);
const entrees = filtres.length ? ENTREES.filter((e) => filtres.some((f) => e.cle === f || e.id === f)) : ENTREES;
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR;
// Sans navigateur imposé : Remotion obtient le sien (ensureBrowser) ou échoue avec son message ; aucun chemin en dur.
if (!navigateur) await ensureBrowser();
const instants = (process.env.PLANCHE_INSTANTS ?? "0.2,0.6,1,1.5,2,2.5,3,3.6,4.2,4.7").split(",").map(Number);

const MISE_EN_PAGE: MiseEnPageCarte = { ratio: "9:16", largeur: 1080, hauteur: 1920, hauteurVideo: 1920, disposition: "plein-ecran", fps: 25, images: 125 };
/** Plafond de poids d'une vidéo de planche (consigne : < 3 Mo). */
const POIDS_MAX = 3e6;

if (!pageSeule) {
  const serveUrl = await bundle({ entryPoint: resolve(racine, "compositions/index.ts") });
  const reglages = { browserExecutable: navigateur ?? null, chromiumOptions: { gl: "swangle" as const } };
  for (const style of styles) {
    const sortie = resolve(DOSSIER, style);
    mkdirSync(sortie, { recursive: true });
    for (const e of entrees) {
      const fiche = CATALOGUE_MOTION_ETENDU[e.id];
      // Style « sobre » : propriété absente (rendu par défaut) ; « spectaculaire » : propriété posée.
      const proprietes = { ...MISE_EN_PAGE, ...(style === "spectaculaire" ? { style } : {}), modele: e.id, donnees: e.donnees } as unknown as Record<string, unknown>;
      const composition = await selectComposition({ serveUrl, id: fiche.composition, inputProps: proprietes, ...reglages });
      const debut = Date.now();
      if (images) {
        const dossier = resolve(racine, ".planche-images/f2");
        mkdirSync(dossier, { recursive: true });
        for (const s of instants) {
          const output = resolve(dossier, `${style}-${e.cle}-${String(Math.round(s * 10)).padStart(2, "0")}.png`);
          await renderStill({ composition, serveUrl, output, frame: Math.min(124, Math.round(s * 25)), inputProps: proprietes, ...reglages });
        }
        console.log(`${style} ${e.cle} : images fixes en ${((Date.now() - debut) / 1000).toFixed(1)} s`);
        continue;
      }
      const fichier = resolve(sortie, `${e.cle}.mp4`);
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
      // Trop lourd : réencodage en deux passes au débit qui tient sous 3 Mo (≈ 2,8 Mo).
      if (statSync(fichier).size >= POIDS_MAX) {
        const debit = Math.floor((2.8e6 * 8) / (MISE_EN_PAGE.images / MISE_EN_PAGE.fps) / 1000);
        const temporaire = `${fichier}.source.mp4`;
        renameSync(fichier, temporaire);
        const commun = ["-y", "-loglevel", "error", "-i", temporaire, "-c:v", "libx264", "-preset", "slow", "-b:v", `${debit}k`, "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-an", "-passlogfile", `${fichier}.passe`];
        execFileSync("ffmpeg", [...commun, "-pass", "1", "-f", "mp4", "/dev/null"]);
        execFileSync("ffmpeg", [...commun, "-pass", "2", "-movflags", "+faststart", fichier]);
        for (const f of [temporaire, `${fichier}.passe-0.log`, `${fichier}.passe-0.log.mbtree`]) if (existsSync(f)) rmSync(f);
      }
      console.log(`${style} ${e.cle} : ${(statSync(fichier).size / 1e6).toFixed(2)} Mo en ${((Date.now() - debut) / 1000).toFixed(1)} s`);
    }
  }
}
if (!images) ecrirePage();

function ecrirePage() {
  const cartes = ENTREES.map((e) => {
    const f = CATALOGUE_MOTION_ETENDU[e.id];
    const nom = `${f.numero}. ${f.nom}${e.variante ? ` — ${e.variante}` : ""}`;
    return `<figure><div class="paire"><div><span>Sobre</span><video src="sobre/${e.cle}.mp4" autoplay muted loop playsinline controls></video></div><div><span>Spectaculaire</span><video src="spectaculaire/${e.cle}.mp4" autoplay muted loop playsinline controls></video></div></div><figcaption><strong>${nom}</strong><span>${f.description}</span><em>${f.automatique ? "Choisi tout seul d'après le texte" : "Seulement à la demande"}</em><q>« ${f.aide} »</q></figcaption></figure>`;
  }).join("\n    ");
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Motion design — modèles 7 à 13</title>
<style>
  :root { --fond: #16120F; --surface: #211A15; --orange: #C65A2E; --creme: #F6EEE0; --attenue: #A79E92; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--fond); color: var(--creme); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; padding: 32px 16px 64px; }
  header { max-width: 1200px; margin: 0 auto 28px; }
  h1 { font-size: 28px; margin: 0 0 6px; letter-spacing: -0.01em; }
  h1 b { color: var(--orange); }
  header p { color: var(--attenue); margin: 0; max-width: 720px; }
  header a { color: var(--orange); }
  main { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 480px), 1fr)); gap: 22px; }
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
  figcaption q { color: var(--creme); font-size: 13px; quotes: none; opacity: 0.85; }
</style>
</head>
<body>
<header>
  <h1>Motion design — <b>les modèles 7 à 13</b></h1>
  <p>Sept nouveaux modèles de la brique commune, au même niveau que les six premiers, chacun en style « ${FICHES_STYLE_MOTION.sobre.libelle} » (à gauche) et « ${FICHES_STYLE_MOTION.spectaculaire.libelle} » (à droite) : mêmes données, même charte. Le graphique est montré en barres, en courbe et en camembert. Chaque carte dure 5 s en 1080 × 1920 (25 i/s) ; dans vos vidéos, chaque élément arrive au mot près. La phrase entre guillemets est l'exemple proposé par « Que puis-je demander ? ». <a href="../planche-motion/index.html">← Les 6 premiers modèles</a></p>
</header>
<main>
    ${cartes}
</main>
</body>
</html>
`;
  mkdirSync(DOSSIER, { recursive: true });
  writeFileSync(resolve(DOSSIER, "index.html"), html);
  console.log(`Page : ${resolve(DOSSIER, "index.html")}`);
}
