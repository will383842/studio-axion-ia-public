/**
 * LOT A1 — garde-fous (lecture de texte) : ce que le gel ne doit PAS toucher.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..", "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");

describe("A1 · intouchables", () => {
  it("`zernio.ts` importe toujours `passerProgrammee` depuis ./buffer (I4)", () => {
    expect(lire("src/services/zernio.ts")).toContain('import { passerProgrammee } from "./buffer"');
  });
  it("le relais média existe et exporte `servirRelaisBuffer` (I2)", () => {
    expect(lire("src/services/relais-buffer.ts")).toMatch(/export (async )?function servirRelaisBuffer/);
    expect(existsSync(join(RACINE, "src/app/api/media-buffer/[jeton]/[nom]/route.ts"))).toBe(true);
  });
  it("la boucle appelle toujours `synchroniserEtatsBuffer` (I1)", () => {
    expect(lire("src/services/boucle.ts")).toContain("synchroniserEtatsBuffer");
  });
});
