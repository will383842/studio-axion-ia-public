/**
 * BUF-03 · fin du retrait de l'ancien outil, partie déploiement (lecture de texte, aucun appel réel).
 * Volontairement NON testés ici : le retrait du lecteur de mesures et celui de la variable BUFFER_API_KEY,
 * car des fichiers hors fiche en dépendent encore (décision du pilote, voir le rapport).
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
      expect(lire(f)).not.toMatch(/tout reste par Buffer|sauf Buffer|PUBLIER en brouillon|tout reste en brouillon dans Buffer/);
    });
    it(`${f} garde sa ligne ZERNIO_API_KEY`, () => {
      expect(lire(f)).toContain("ZERNIO_API_KEY");
    });
  }
});
