/**
 * Garde de déploiement : ORIGINE_V3_COMPTES est lue par le code ; le compose ne transmet que les variables listées
 * (pas d'`env_file`), donc elle doit y figurer (valeur par défaut vide = éteint) et être documentée dans env.exemple.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VARIABLE_COMPTES_ORIGINE_V3 } from "@/domaine/guide-reseau/origine-v3";

const RACINE = join(__dirname, "..");
const compose = readFileSync(join(RACINE, "deploiement/docker-compose.yml"), "utf8");
const exemple = readFileSync(join(RACINE, "deploiement/env.exemple"), "utf8");

describe("ORIGINE_V3_COMPTES — déploiement", () => {
  it("le code lit bien cette variable", () => {
    expect(VARIABLE_COMPTES_ORIGINE_V3).toBe("ORIGINE_V3_COMPTES");
  });
  it("le compose la transmet, vide par défaut", () => {
    expect(compose).toMatch(/^\s+ORIGINE_V3_COMPTES: \$\{ORIGINE_V3_COMPTES:-\}\s*$/m);
  });
  it("env.exemple la documente, vide", () => {
    expect(exemple).toMatch(/^ORIGINE_V3_COMPTES=$/m);
  });
});
