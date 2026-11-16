/**
 * Cohérence du déploiement pour l'essai : le compose ne transmet au conteneur que les variables listées (pas d'env_file).
 * Les deux listes d'essai doivent donc y figurer (valeur par défaut VIDE = éteint) et, vides, dans env.exemple. Test de fichiers, sans réseau.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..", "..");
const lire = (c: string) => readFileSync(join(RACINE, c), "utf8");
const compose = lire("deploiement/docker-compose.yml");
const exemple = lire("deploiement/env.exemple");

describe("essai : variables transmises au conteneur", () => {
  it.each(["PARCOURS_ESSAI_COMPTES", "PARCOURS_ESSAI_AUTEURS"])("%s : transmise par le compose, vide par défaut", (v) => {
    expect(compose).toMatch(new RegExp(`^\\s+${v}: \\$\\{${v}:-\\}\\s*$`, "m"));
  });
  it.each(["PARCOURS_ESSAI_COMPTES", "PARCOURS_ESSAI_AUTEURS"])("%s : présente et vide dans env.exemple", (v) => {
    expect(exemple).toMatch(new RegExp(`^${v}=$`, "m"));
  });
});
