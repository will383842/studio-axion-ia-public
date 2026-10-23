/**
 * GÉNÈRE `src/briques/fins/banque-base7.generee.ts` (les lignes de `BANQUE_APPELS`) depuis la copie JSON de la base 7.
 *
 *   npm run bases:banque            écrit le fichier
 *   npm run bases:banque -- --verifier   n'écrit rien, sort en erreur si le fichier s'écarte de la base 7
 *
 * Ordre à suivre pour changer une phrase : base 7 (le dépôt privé des bases) → `synchroniser-bases.mts` → ce script.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ETATS_BASE, sourceDesBases, tousLesAppels } from "../../src/donnees/bases-usine/index";
import { CHEMIN_BANQUE_GENEREE, rendreBanqueGeneree } from "../../src/donnees/bases-usine/rendu-banque";

const racine = join(dirname(fileURLToPath(import.meta.url)), "../..");
const chemin = join(racine, CHEMIN_BANQUE_GENEREE);
const attendu = rendreBanqueGeneree(tousLesAppels({ etats: ETATS_BASE }), sourceDesBases().commit ?? null);

if (process.argv.includes("--verifier")) {
  const actuel = readFileSync(chemin, "utf8");
  if (actuel !== attendu) {
    console.error(`${CHEMIN_BANQUE_GENEREE} s'écarte de la base 7 : lancer « npm run bases:banque ».`);
    process.exit(1);
  }
  console.log("banque conforme à la base 7.");
} else {
  writeFileSync(chemin, attendu);
  console.log(`${CHEMIN_BANQUE_GENEREE} écrit (${attendu.split("\n").length - 1} lignes).`);
}
