import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { AXES_COMMUNS, VERSION_EMPREINTE } from "@/briques/variete-commune";

const DOSSIER = join(process.cwd(), "src/briques/variete-commune");

describe("variete-commune : types de l'empreinte", () => {
  it("AXES_COMMUNS a 12 axes distincts", () => {
    expect(AXES_COMMUNS).toHaveLength(12);
    expect(new Set(AXES_COMMUNS).size).toBe(12);
  });
  it("VERSION_EMPREINTE vaut empreinte/1", () => {
    expect(VERSION_EMPREINTE).toBe("empreinte/1");
  });
  it("garde statique : aucun import interdit, aucune date, aucun hasard", () => {
    for (const f of readdirSync(DOSSIER).filter((n) => n.endsWith(".ts"))) {
      const src = readFileSync(join(DOSSIER, f), "utf8");
      expect(src, f).not.toMatch(/from\s+["']@\/services\//);
      expect(src, f).not.toMatch(/from\s+["'][^"']*studio-rendu/);
      expect(src, f).not.toMatch(/from\s+["'][^"']*(credits|couts|depense-claude-video|reglages|travaux)["']/);
      expect(src, f).not.toMatch(/\bnew Date\b|\bDate\.now\b|Math\.random/);
    }
  });
});
