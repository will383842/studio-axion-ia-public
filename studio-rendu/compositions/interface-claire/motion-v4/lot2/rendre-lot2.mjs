/**
 * Rend les extraits du lot 2 (v4) : un extrait par élément et par palette (MP4 540×960, 30 i/s, avec voix de la prise + bruitages), l'enchaînement
 * de 15 s en A et B, et des images fixes de contrôle. Usage :
 *   node rendre-lot2.mjs <public> <sortie> <bundle-temporaire> <tache> [tache ...]
 *   tâches : extrait:<id>:<A|B>   ench:<A|B>   still:<id>:<A|B>:<n1,n2,...>   stillench:<A|B>:<n1,...>
 *            fond:<id>:<prise|blanc|noir|broll-xxx.mp4>:<n1,n2,...>   (test des 4 fonds, palette B ; n < 1 = fraction de la durée)
 * Seule la palette B (orange) est rendue depuis la décision de Will (standard § K).
 * <public> contient : prise-commune-15s.mp4, prise-commune-1080x1920.png, sons/*.wav. Le dossier de bundle est le SEUL à effacer ensuite.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const [publicDir, sortie, bundleDir, ...taches] = process.argv.slice(2);
mkdirSync(sortie, { recursive: true });
const serveUrl = await bundle({ entryPoint: resolve(import.meta.dirname, "entree-lot2.tsx"), publicDir: resolve(publicDir), outDir: resolve(bundleDir) });
const NOMS = { "carte-checklist": "CarteChecklist", "carte-commande": "CarteCommande", "carte-commentaire": "CarteCommentaire", "carte-statuts": "CarteStatuts", "graphique-barres": "GraphiqueBarres", "carte-calendrier": "CarteCalendrier", "carte-comparaison": "CarteComparaison", "frise-etapes": "FriseEtapes" };
const commun = { codec: "h264", crf: 28, scale: 0.5, pixelFormat: "yuv420p", x264Preset: "slow", audioCodec: "aac", audioBitrate: "128k", ...(process.env.NAVIGATEUR ? { browserExecutable: process.env.NAVIGATEUR } : {}) };
const navig = process.env.NAVIGATEUR ? { browserExecutable: process.env.NAVIGATEUR } : {};
for (const tache of taches) {
  const [genre, a, b, liste] = tache.split(":");
  const debut = Date.now();
  if (genre === "extrait") {
    const props = { element: a, palette: b };
    const composition = await selectComposition({ serveUrl, id: "ExtraitLot2", inputProps: props, ...navig });
    await renderMedia({ composition, serveUrl, ...commun, outputLocation: resolve(sortie, `${NOMS[a]}-${b}.mp4`), inputProps: props });
  } else if (genre === "ench") {
    const props = { palette: a };
    const composition = await selectComposition({ serveUrl, id: "EnchainementLot2", inputProps: props, ...navig });
    await renderMedia({ composition, serveUrl, ...commun, outputLocation: resolve(sortie, `lot2-enchainement-15s-${a}.mp4`), inputProps: props });
  } else if (genre === "still") {
    for (const n of liste.split(",").map(Number)) {
      const props = { element: a, palette: b };
      const composition = await selectComposition({ serveUrl, id: "ExtraitLot2", inputProps: props, ...navig });
      await renderStill({ composition, serveUrl, output: resolve(sortie, `${NOMS[a]}-${b}-${n}.png`), inputProps: props, frame: n, scale: 0.5, ...navig });
    }
  } else if (genre === "fond") {
    const props = { element: a, palette: "B", fond: b === "prise" || b === "blanc" || b === "noir" ? b : `broll:${b}` };
    const composition = await selectComposition({ serveUrl, id: "ExtraitLot2", inputProps: props, ...navig });
    for (const v of liste.split(",").map(Number)) {
      const n = v < 1 ? Math.round(v * (composition.durationInFrames - 1)) : v;
      await renderStill({ composition, serveUrl, output: resolve(sortie, `${NOMS[a]}-${b.replace(/\.mp4$/, "")}-${v}.png`), inputProps: props, frame: n, scale: 0.5, ...navig });
    }
  } else if (genre === "stillench") {
    for (const n of b.split(",").map(Number)) {
      const props = { palette: a };
      const composition = await selectComposition({ serveUrl, id: "EnchainementLot2", inputProps: props, ...navig });
      await renderStill({ composition, serveUrl, output: resolve(sortie, `ench-${a}-${n}.png`), inputProps: props, frame: n, scale: 0.5, ...navig });
    }
  }
  console.log(tache, "ok", ((Date.now() - debut) / 1000).toFixed(1), "s");
}
