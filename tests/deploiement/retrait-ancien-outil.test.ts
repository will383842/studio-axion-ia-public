/**
 * BUF-03 · fin du retrait de l'ancien outil, partie déploiement (lecture de texte, aucun appel réel).
 * Le retrait du lecteur de mesures n'est pas testé ici : des fichiers hors fiche l'importent encore (voir le rapport).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..", "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const FICHIERS = ["deploiement/docker-compose.yml", "deploiement/env.exemple"];

describe("BUF-03 · variables de déploiement de l'ancien outil", () => {
  for (const f of FICHIERS) {
    it(`${f} ne déclare plus BUFFER_API_KEY`, () => {
      expect(lire(f)).not.toContain("BUFFER_API_KEY");
    });
    it(`${f} ne dit plus que « tout reste » par l'ancien outil`, () => {
      expect(lire(f)).not.toMatch(/tout reste par Buffer|sauf Buffer|tout reste en brouillon dans Buffer/);
    });
    it(`${f} garde sa ligne ZERNIO_API_KEY`, () => {
      expect(lire(f)).toContain("ZERNIO_API_KEY");
    });
  }
});
