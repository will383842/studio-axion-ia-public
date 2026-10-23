/**
 * Lot B2 — la « version utilisée » de Remotion est lue dans le code : `src/veille/versions-utilisees.ts` est GÉNÉRÉ
 * depuis `studio-rendu/package.json` (l'image du studio n'embarque pas `studio-rendu/`). Ce test échoue si les deux
 * divergent : relancer `npx tsx outils/veille/generer-versions.mts`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OUTILS_DEPART } from "@/veille/outils-depart";
import { VERSIONS_STUDIO_RENDU } from "@/veille/versions-utilisees";

const pkg = JSON.parse(readFileSync(join(__dirname, "..", "studio-rendu", "package.json"), "utf8")) as { dependencies: Record<string, string> };

describe("versions utilisées", () => {
  it("le fichier généré suit studio-rendu/package.json", () => {
    for (const [paquet, version] of Object.entries(VERSIONS_STUDIO_RENDU)) expect(pkg.dependencies[paquet], paquet).toBe(version);
  });
  it("Remotion affiché « 4.0.532 utilisée » sur sa carte", () => {
    expect(OUTILS_DEPART.find((o) => o.id === "veille-remotion")!.versionUtilisee).toBe("4.0.532");
    expect(VERSIONS_STUDIO_RENDU.remotion).toBe(pkg.dependencies.remotion);
  });
});
