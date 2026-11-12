/**
 * MESURE de la variété « Image → vidéo » (sans appel payant) : sur chaque carte des fixtures, 30 tirages ENCHAÎNÉS (l'historique
 * est nourri à chaque tour, la plus récente d'abord), puis la répartition des codes par axe, le nombre de recettes distinctes et
 * la ressemblance maximale moyenne avec les 10 précédentes.
 *   npx tsx scripts/image-video/variete/mesure-variete.mts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { AXES_VARIETE, type RecetteVarieteIV } from "../../../src/briques/schema-motion/variete";
import type { CarteImage } from "../../../src/domaine/image-video/carte";
import { ressemblanceMaxIV } from "../../../src/moteurs/montage-image-video/variete/historique";
import { tirerVarieteIV } from "../../../src/moteurs/montage-image-video/variete/tirage";

const TIRAGES = 30;
const dossier = join(process.cwd(), "tests/image-video/fixtures/cartes");

for (const fichier of readdirSync(dossier).filter((f) => /^[A-Z]\.json$/.test(f)).sort()) {
  const carte = JSON.parse(readFileSync(join(dossier, fichier), "utf8")) as CarteImage;
  const historique: RecetteVarieteIV[] = []; // la plus récente d'abord
  const repartition = Object.fromEntries(AXES_VARIETE.map((a) => [a, {} as Record<string, number>]));
  let somme = 0;
  for (let i = 0; i < TIRAGES; i++) {
    const r = tirerVarieteIV({ graine: `mesure-${fichier}-${i}`, carte, format: "9:16", historique });
    somme += ressemblanceMaxIV(r, historique);
    for (const a of AXES_VARIETE) repartition[a][r[a]] = (repartition[a][r[a]] ?? 0) + 1;
    historique.unshift(r);
  }
  const distinctes = new Set(historique.map((r) => JSON.stringify(r))).size;
  console.log(`\n=== Carte ${fichier.replace(".json", "")} · ${TIRAGES} tirages`);
  for (const a of AXES_VARIETE) console.log(`  ${a.padEnd(12)} ${Object.entries(repartition[a]).sort().map(([c, n]) => `${c}×${n}`).join("  ")}`);
  console.log(`  recettes distinctes : ${distinctes}/${TIRAGES} · ressemblance max moyenne (10 précédentes) : ${(100 * (somme / TIRAGES)).toFixed(1)} %`);
}
