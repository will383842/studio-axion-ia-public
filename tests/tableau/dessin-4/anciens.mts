/**
 * Fige l'ANCIEN rendu (mise en page « blocs/2 » d'avant le dessin 4) des quatre fiches réelles, dans les cinq sorties :
 * `anciens.json.gz` (écrans posés et géométrie), lu par `dessin-4.test.ts` pour prouver que les contrôles d'aujourd'hui
 * l'auraient refusé. À lancer sur le code d'avant (`git stash`, puis `npx tsx tests/tableau/dessin-4/anciens.mts`).
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { FICHES_REELLES, SORTIES, ficheReelle, optionsSortie } from "./fiches-reelles";

const sortie: Record<string, unknown> = {};
for (const { nom } of FICHES_REELLES) {
  const f = ficheReelle(nom);
  for (const s of SORTIES) {
    const m = mettreEnPage(f, optionsSortie(f, s)).styleV2!;
    sortie[`${nom}/${s}`] = { geometrie: m.geometrie, ecrans: m.ecrans };
  }
}
writeFileSync(join(fileURLToPath(new URL(".", import.meta.url)), "anciens.json.gz"), gzipSync(JSON.stringify(sortie), { level: 9 }));
console.log("anciens.json.gz écrit");
