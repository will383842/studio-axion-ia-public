/**
 * PLANCHE DE L'HABILLAGE COMMUN (C6-H7a). Lancé à la main ; aucun générateur ne demande ces compositions.
 *
 * Usage (depuis `studio-rendu/`) :
 *   npx tsx scripts/planche-habillage.ts            → MP4 des 14 transitions, dans .planche-habillage/ (non commité)
 *   npx tsx scripts/planche-habillage.ts --planche fonds|lumieres → MP4 des fonds vivants (fonds.mp4) ou des lumières (lumieres.mp4)
 *   npx tsx scripts/planche-habillage.ts --mesure   → mesure AM-05 : 60 images par cas, temps par image et pic de mémoire,
 *                                                     `mesure.json` et `mesure.md` dans le même dossier
 *   STUDIO_RENDU_NAVIGATEUR=/chemin/chrome          → navigateur sans affichage à utiliser
 *
 * Aucune valeur supposée : tout ce qui est écrit a été mesuré par cette exécution.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, selectComposition } from "@remotion/renderer";
import { REGLAGES_RENDU } from "../src/remotion";

/** Mêmes valeurs que `CAS_MESURE` de la composition (non importée : elle tire un .woff2, que tsx ne charge pas). */
const CAS_MESURE = [
  "flou-0-plein", "flou-6-plein", "flou-12-plein",
  "flou-0-boite", "flou-6-boite", "flou-12-boite",
  "clip-path", "mix-blend-mode", "feTurbulence",
] as const;

const racine = resolve(import.meta.dirname, "..");
const sortie = resolve(racine, ".planche-habillage");
mkdirSync(sortie, { recursive: true });

const mesureDemandee = process.argv.includes("--mesure");
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR;
if (!navigateur) await ensureBrowser();
const reglages = { ...REGLAGES_RENDU, browserExecutable: navigateur ?? null, timeoutInMilliseconds: 180_000 };

const serveUrl = await bundle({ entryPoint: resolve(racine, "compositions/index.ts") });

if (!mesureDemandee) {
  const i = process.argv.indexOf("--planche");
  const choix = i >= 0 ? process.argv[i + 1] : undefined;
  if (choix !== undefined && choix !== "fonds" && choix !== "lumieres") throw new Error("--planche attend « fonds » ou « lumieres »");
  const id = choix === "fonds" ? "HabillageFonds" : choix === "lumieres" ? "HabillageLumieres" : "HabillageTransitions";
  const composition = await selectComposition({ serveUrl, id, ...reglages });
  const fichier = resolve(sortie, choix === undefined ? "transitions.mp4" : `${choix}.mp4`);
  await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: fichier, ...reglages });
  console.log(`Planche écrite : ${fichier}`);
} else {
  type Ligne = { cas: string; images: number; msParImageMoyenne: number; msParImagePire: number; msTotal: number; picMemoireMo: number };
  const lignes: Ligne[] = [];
  for (const cas of CAS_MESURE) {
    const composition = await selectComposition({ serveUrl, id: "HabillageMesure", inputProps: { cas }, ...reglages });
    let pic = process.memoryUsage().rss;
    const echantillon = setInterval(() => {
      pic = Math.max(pic, process.memoryUsage().rss);
    }, 100);
    const instants: number[] = [];
    let precedent = performance.now();
    const debut = precedent;
    await renderMedia({
      composition, serveUrl, codec: "h264", outputLocation: resolve(sortie, `mesure-${cas}.mp4`), inputProps: { cas }, ...reglages,
      onProgress: ({ renderedFrames }) => {
        const maintenant = performance.now();
        const nouvelles = renderedFrames - instants.length;
        for (let i = 0; i < nouvelles; i++) instants.push((maintenant - precedent) / nouvelles);
        precedent = maintenant;
        pic = Math.max(pic, process.memoryUsage().rss);
      },
    });
    clearInterval(echantillon);
    const total = performance.now() - debut;
    const arrondi = (n: number) => Math.round(n * 10) / 10;
    lignes.push({
      cas, images: composition.durationInFrames, msParImageMoyenne: arrondi(total / composition.durationInFrames),
      msParImagePire: arrondi(Math.max(0, ...instants)), msTotal: Math.round(total), picMemoireMo: Math.round(pic / 1048576),
    });
    console.log(lignes[lignes.length - 1]);
  }
  writeFileSync(resolve(sortie, "mesure.json"), JSON.stringify(lignes, null, 2));
  const tableau = [
    "| cas | images | ms/image (moyenne) | ms/image (pire lot) | total ms | pic mémoire (Mo, rss du processus) |",
    "|---|---|---|---|---|---|",
    ...lignes.map((l) => `| ${l.cas} | ${l.images} | ${l.msParImageMoyenne} | ${l.msParImagePire} | ${l.msTotal} | ${l.picMemoireMo} |`),
  ].join("\n");
  writeFileSync(resolve(sortie, "mesure.md"), `${tableau}\n`);
  console.log(`\n${tableau}`);
}
