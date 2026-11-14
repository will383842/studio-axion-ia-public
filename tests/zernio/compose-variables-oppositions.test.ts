/**
 * Cohérence du déploiement pour les interrupteurs des oppositions : le compose ne transmet au conteneur que les
 * variables listées (pas d'env_file). Test de fichiers, sans réseau.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..", "..");
const lire = (c: string) => readFileSync(join(RACINE, c), "utf8");
const compose = lire("deploiement/docker-compose.yml");
const exemple = lire("deploiement/env.exemple");

const blocStudio = compose.slice(
  compose.indexOf("\n  studio:"),
  compose.indexOf("\n  studio-rendu:"),
);
const INTERRUPTEURS = [
  "OPPOSITIONS_PAR_REF_ENABLED",
  "OPPOSITIONS_SITE_IMPORT_ENABLED",
];

describe("compose et env.exemple : interrupteurs des oppositions", () => {
  it("le code lit bien ces interrupteurs (le test n'est pas aveugle)", () => {
    expect(lire("src/services/oppositions-transmission.ts")).toContain(
      "OPPOSITIONS_PAR_REF_ENABLED",
    );
    expect(lire("src/services/oppositions-mots.ts")).toContain(
      "OPPOSITIONS_SITE_IMPORT_ENABLED",
    );
  });

  it("chaque interrupteur est transmis au Studio sous la forme NOM: ${NOM:-}", () => {
    for (const v of INTERRUPTEURS)
      expect(blocStudio, v).toContain(`      ${v}: \${${v}:-}`);
  });

  it("chaque interrupteur figure vide (NOM=) dans env.exemple", () => {
    const lignes = exemple.split(/\r?\n/);
    for (const v of INTERRUPTEURS) expect(lignes, v).toContain(`${v}=`);
  });
});
