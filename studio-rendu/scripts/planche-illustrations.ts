/**
 * PLANCHE DE PREUVE du lot L8 : 12 illustrations à 3 tailles + 40 icônes, rendues en JPEG par le vrai Remotion.
 *
 * Usage (depuis `studio-rendu/`) :
 *   STUDIO_RENDU_NAVIGATEUR=/chemin/chrome-headless-shell npx tsx scripts/planche-illustrations.ts
 * Navigateur : Chrome Headless Shell de Chrome for Testing 149.0.7790.0 (celui de Remotion 4.0.532), JAMAIS le Chromium de Playwright.
 * Sortie : essais-visuels/l8/planche.jpg
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const racine = resolve(import.meta.dirname, "..");
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR;
if (!navigateur) throw new Error("STUDIO_RENDU_NAVIGATEUR doit désigner le Chrome Headless Shell de Remotion (Chrome for Testing 149).");
if (navigateur.includes("pw-browsers")) throw new Error("Le Chromium de Playwright ne doit pas être utilisé pour ces planches.");

const sortie = resolve(racine, "essais-visuels/l8/planche.jpg");
mkdirSync(resolve(racine, "essais-visuels/l8"), { recursive: true });

const serveUrl = await bundle({ entryPoint: resolve(racine, "scripts/planche-illustrations-entree.tsx") });
const options = { browserExecutable: navigateur, chromiumOptions: { gl: "swangle" as const }, timeoutInMilliseconds: 120_000 };
const composition = await selectComposition({ serveUrl, id: "PlancheIllustrations", ...options });
await renderStill({ composition, serveUrl, output: sortie, frame: 0, imageFormat: "jpeg", jpegQuality: 90, ...options });
console.log(`Planche écrite : ${sortie}`);
