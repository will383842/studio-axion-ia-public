import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const texte = readFileSync(join(process.cwd(), "src/services/demo-facecam-claude.ts"), "utf8");
const entete = texte.split("*/")[0] ?? "";
const code = texte
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .filter((l) => !/^\s*\/\//.test(l))
  .join("\n");

describe("FIX-ENTETE-DEMO-CLAUDE-v20h : l'en-tête dit la vérité", () => {
  it("n'annonce plus « ÉTEINT PAR DÉFAUT »", () => {
    expect(entete).not.toContain("ÉTEINT PAR DÉFAUT");
  });
  it("annonce « ALLUMÉ PAR DÉFAUT » et le moyen de l'éteindre", () => {
    expect(entete).toContain("ALLUMÉ PAR DÉFAUT");
    expect(entete).toContain("`demoFacecam.planClaude` à `false`");
  });
  it("le corps (code hors commentaires) est identique à master", () => {
    expect(createHash("sha256").update(code).digest("hex")).toBe("b5bf726f2db703ce9212c2fec24cbfdce0420c7d84ee6776acf3000bee091532");
  });
});
