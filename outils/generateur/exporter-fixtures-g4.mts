/**
 * FIXTURES DU LOT G4 : les sorties RÉELLES des rôles, enregistrées par le banc (dossiers `brut` des tours du banc, sous `docs/captures/g4-banc`),
 * passent par `preparerFixture` (anonymisation, puis REFUS d'écrire s'il reste un nom sensible, un lieu, une valeur
 * d'un cas client réel, un terme de la liste locale ou une clé) et vont dans `tests/generateur/fixtures/`.
 *
 *   pnpm exec tsx outils/generateur/exporter-fixtures-g4.mts
 *
 * Registres : ceux du banc (TEST) et les registres fictifs ; liste locale `.fixtures-termes-sensibles` si elle existe.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { preparerFixture, termesSensibles } from "../../src/generateur/fixtures";
import { SUJETS_BANC } from "../../tests/generateur/banc/registre-banc-g4";
import { MATIERES_FICTIVES } from "../../tests/generateur/matieres-fictives";
import { PREUVES_FICTIVES } from "../../tests/generateur/preuves-fictives";

const racine = join(process.cwd(), "docs", "captures", "g4-banc");
const sortie = join(process.cwd(), "tests", "generateur", "fixtures");
mkdirSync(sortie, { recursive: true });
const local = join(process.cwd(), ".fixtures-termes-sensibles");
const locaux = existsSync(local) ? readFileSync(local, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")) : [];
const termes = termesSensibles({ preuves: [...PREUVES_FICTIVES, ...SUJETS_BANC.flatMap((s) => s.preuves)], matieres: [...MATIERES_FICTIVES, ...SUJETS_BANC.flatMap((s) => s.matieres)] }, locaux);

let n = 0;
const refusees: string[] = [];
for (const tour of readdirSync(racine).filter((d) => d.startsWith("tour-"))) {
  const brut = join(racine, tour, "brut");
  if (!existsSync(brut)) continue;
  for (const f of readdirSync(brut).filter((x) => x.endsWith(".json")).sort()) {
    const nom = `g4-${tour}-${f.replace(/\.json$/, "")}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    try {
      const propre = preparerFixture(readFileSync(join(brut, f), "utf8"), termes);
      writeFileSync(join(sortie, `${nom}.json`), propre);
      n++;
    } catch (e) {
      refusees.push(`${f} : ${(e as Error).message}`);
    }
  }
}
console.log(`${n} fixture(s) écrite(s) dans tests/generateur/fixtures/ ; ${refusees.length} refusée(s).`);
for (const r of refusees) console.log(`  refusée : ${r}`);
