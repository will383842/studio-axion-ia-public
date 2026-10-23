/**
 * EXPORTER UNE FIXTURE (lot G0, plan v5 B.3.7) : garde une sortie réelle de Claude dans `tests/generateur/fixtures/`
 * APRÈS anonymisation, et REFUSE d'écrire s'il reste un nom sensible, le lieu d'un client, une valeur d'un cas client
 * réel, un terme de la liste locale ou une clé.
 *
 *   pnpm exec tsx outils/generateur/exporter-fixture.mts <sortie-brute.json> <nom> [--registre <preuves-et-matieres.json>]
 *
 * - Sans `--registre` : les registres FICTIFS des tests (`tests/generateur/*-fictives.ts`), ceux sur lesquels les
 *   fixtures doivent être produites.
 * - `--registre` : un export JSON `{ preuves, matieres }` (serveur seulement, jamais versionné).
 * - Liste locale non versionnée : `.fixtures-termes-sensibles` à la racine (un terme par ligne), lue si elle existe.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { preparerFixture, termesSensibles } from "../../src/generateur/fixtures";
import { MATIERES_FICTIVES } from "../../tests/generateur/matieres-fictives";
import { PREUVES_FICTIVES } from "../../tests/generateur/preuves-fictives";

const args = process.argv.slice(2);
const iReg = args.indexOf("--registre");
const registreFichier = iReg >= 0 ? args[iReg + 1] : undefined;
const [entree, nom] = args.filter((_, i) => i !== iReg && i !== iReg + 1);
if (!entree || !nom || !/^[a-z0-9-]+$/.test(nom)) {
  console.error("Usage : exporter-fixture.mts <sortie-brute.json> <nom-en-minuscules> [--registre fichier.json]");
  process.exit(2);
}

const registre = registreFichier ? (JSON.parse(readFileSync(registreFichier, "utf8")) as { preuves?: never[]; matieres?: never[] }) : { preuves: PREUVES_FICTIVES, matieres: MATIERES_FICTIVES };
const fichierLocal = join(process.cwd(), ".fixtures-termes-sensibles");
const locaux = existsSync(fichierLocal) ? readFileSync(fichierLocal, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")) : [];

try {
  const propre = preparerFixture(readFileSync(entree, "utf8"), termesSensibles(registre, locaux));
  const dossier = join(process.cwd(), "tests", "generateur", "fixtures");
  mkdirSync(dossier, { recursive: true });
  const sortie = join(dossier, `${nom}.json`);
  writeFileSync(sortie, propre);
  console.log(`Fixture écrite : ${sortie}`);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
