/**
 * CONTRÔLE VISUEL DES CARTES RÉELLES (finitions du 10/10) : rend des images fixes de cartes déjà préparées
 * (paramètres `composition` sans mode, JSON) aux instants demandés. Rendu local, sans serveur.
 *
 * Usage (depuis `studio-rendu/`) : npx tsx scripts/controle-cartes.ts <cartes.json> <dossier> [instants s, ex. 0.1,0.5,1]
 */
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderStill, selectComposition } from "@remotion/renderer";

const [fichier, dossier, liste] = process.argv.slice(2);
const cartes = JSON.parse(readFileSync(fichier, "utf-8")) as { composition: string; proprietes: Record<string, unknown> }[];
const instants = (liste ?? "0.1,0.5,1,2").split(",").map(Number);
mkdirSync(dossier, { recursive: true });
const racine = resolve(import.meta.dirname, "..");
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR;
// Sans navigateur imposé : Remotion obtient le sien (ensureBrowser) ou échoue avec son message ; aucun chemin en dur.
if (!navigateur) await ensureBrowser();
const serveUrl = await bundle({ entryPoint: resolve(racine, "compositions/index.ts") });
const reglages = { browserExecutable: navigateur ?? null, chromiumOptions: { gl: "swangle" as const } };
for (const [k, c] of cartes.entries()) {
  const composition = await selectComposition({ serveUrl, id: c.composition, inputProps: c.proprietes, ...reglages });
  for (const s of instants) {
    const image = Math.min(composition.durationInFrames - 1, Math.round(s * composition.fps));
    await renderStill({ composition, serveUrl, output: resolve(dossier, `carte-${k + 1}-${String(Math.round(s * 10)).padStart(2, "0")}.png`), frame: image, inputProps: c.proprietes, ...reglages });
  }
  console.log(`carte ${k + 1} (${c.composition}) : ${instants.length} images`);
}
