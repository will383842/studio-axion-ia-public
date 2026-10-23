/**
 * Correcteur final B — bloquant 1 de VERIF-E2E-1 et VERIF-E2E-2 : « Importer un fichier » → un .pdf échouait dans l'image
 * Docker du studio. La sortie autonome construite par Turbopack ne met PAS unpdf en tête de node_modules : seulement un
 * alias haché `.next/node_modules/unpdf-<empreinte>` (et le dossier pnpm). Le processus enfant, qui faisait
 * `import("unpdf")` depuis le dossier du studio, ne le trouvait pas. On reproduit ici les deux dispositions, dans un
 * dossier isolé (hors du dépôt : le node_modules du dépôt ne peut pas masquer le défaut).
 */
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { extraireDansUnProcessus } from "@/services/import-texte";

const UNPDF = realpathSync(join(process.cwd(), "node_modules/unpdf"));
const PDF = new Uint8Array(readFileSync(join(process.cwd(), "tests/fixtures/c3-script.pdf")));
const dossiers: string[] = [];

function dossierIsole(): string {
  const d = mkdtempSync(join(tmpdir(), "studio-autonome-"));
  dossiers.push(d);
  writeFileSync(join(d, "server.js"), "");
  return d;
}

afterAll(() => {
  for (const d of dossiers) rmSync(d, { recursive: true, force: true });
});

describe("import .pdf depuis une sortie autonome (image Docker)", () => {
  it("le dossier isolé ne voit vraiment pas unpdf par son nom", async () => {
    const d = dossierIsole();
    // Garde-fou du test lui-même : si le dossier temporaire voyait un node_modules, l'essai ne prouverait rien.
    expect(() => require.resolve("unpdf", { paths: [d] })).toThrow();
  });

  it("alias haché de Turbopack (.next/node_modules/unpdf-<empreinte>) : le .pdf est lu", async () => {
    const d = dossierIsole();
    mkdirSync(join(d, ".next/node_modules"), { recursive: true });
    symlinkSync(UNPDF, join(d, ".next/node_modules/unpdf-fe9c66141c03beec"), "dir");
    const texte = await extraireDansUnProcessus(".pdf", PDF, {}, d);
    expect(texte).toContain("Votre patron lit vos mails");
  });

  it("dossier pnpm seul (node_modules/.pnpm/unpdf@<version>/node_modules/unpdf) : le .pdf est lu", async () => {
    const d = dossierIsole();
    mkdirSync(join(d, "node_modules/.pnpm/unpdf@1.8.1/node_modules"), { recursive: true });
    symlinkSync(UNPDF, join(d, "node_modules/.pnpm/unpdf@1.8.1/node_modules/unpdf"), "dir");
    const texte = await extraireDansUnProcessus(".pdf", PDF, {}, d);
    expect(texte).toContain("Votre patron lit vos mails");
  });

  it("unpdf introuvable : refus lisible (« illisible »), jamais un plantage", async () => {
    const d = dossierIsole();
    await expect(extraireDansUnProcessus(".pdf", PDF, {}, d)).rejects.toMatchObject({ code: "IMPORT_ILLISIBLE" });
  });
});
