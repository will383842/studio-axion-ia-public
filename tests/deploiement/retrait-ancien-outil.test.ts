/**
 * BUF-03 · fin du retrait de l'ancien outil, partie déploiement (lecture de texte, aucun appel réel).
 * Ni le lecteur de mesures ni la variable BUFFER_API_KEY ne sont retirés : des fichiers hors fiche en dépendent encore (voir le rapport).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..", "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const FICHIERS = ["deploiement/docker-compose.yml", "deploiement/env.exemple"];

describe("BUF-03 · variables de déploiement de l'ancien outil", () => {
  for (const f of FICHIERS) {
    it(`${f} ne dit plus que « tout reste » par l'ancien outil`, () => {
      expect(lire(f)).not.toMatch(/tout reste par Buffer/);
    });
    it(`${f} garde sa ligne ZERNIO_API_KEY`, () => {
      expect(lire(f)).toContain("ZERNIO_API_KEY");
    });
  }
});
