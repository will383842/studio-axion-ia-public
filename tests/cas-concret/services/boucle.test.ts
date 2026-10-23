/**
 * S1c : la boucle de fond charge les raccords du « Cas concret MD » (une ligne dans `src/services/boucle.ts`) ; après
 * son import, le moteur trouve ses outils. Aucun appel réseau.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

describe("S1c · chargement des raccords par la boucle", () => {
  it("après import de la boucle, servicesCasConcret().outils est défini", async () => {
    const { servicesCasConcret } = await import("@/moteurs/montage-cas-concret");
    expect(servicesCasConcret().outils).toBeUndefined();
    await import("@/services/boucle");
    expect(typeof servicesCasConcret().outils).toBe("function");
  });

  it("la ligne est posée sous ses trois voisines", () => {
    const texte = readFileSync(join(process.cwd(), "src/services/boucle.ts"), "utf8");
    expect(texte).toContain('import "./facecam-branchements";\nimport "./avocat-branchements";\nimport "./tableau-branchements";\nimport "./cas-concret-branchements";\n');
  });
});
