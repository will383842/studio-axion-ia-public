/**
 * Copies d'APERÇU des LUT livrées (aperçu rapide, 02/10) : `public/luts/<nom>.cube` (65³, rendu final, intact)
 * → `public/luts/apercu/<nom>.33.bin` (33³, 8 bits, ≈ 105 Ko), lue par l'aperçu du plateau dans le navigateur.
 * Usage : pnpm exec tsx outils/lut/apercus.mts   (à relancer après `node scripts/importer-luts.mjs`)
 * Garde : `tests/apercu-lut.test.ts` échoue si une copie manque ou n'est plus à jour.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { encoderLutApercu, lireCube, TAILLE_LUT_NAVIGATEUR } from "../../src/lib/lut3d";

const DOSSIER = join(process.cwd(), "public", "luts");
const SORTIE = join(DOSSIER, "apercu");
mkdirSync(SORTIE, { recursive: true });
for (const nom of readdirSync(DOSSIER).filter((f) => f.endsWith(".cube"))) {
  const debut = performance.now();
  const lut = lireCube(readFileSync(join(DOSSIER, nom), "utf8"));
  const octets = encoderLutApercu(lut);
  const cible = join(SORTIE, `${nom.replace(/\.cube$/, "")}.${TAILLE_LUT_NAVIGATEUR}.bin`);
  writeFileSync(cible, octets);
  console.log(`${nom} (${lut.taille}³) → apercu/${nom.replace(/\.cube$/, "")}.${TAILLE_LUT_NAVIGATEUR}.bin : ${octets.length} octets (${Math.round(performance.now() - debut)} ms)`);
}
