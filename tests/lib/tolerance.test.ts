/** FIX-ROUGES-CODE-VIDEO-v21r (B) : la tolérance EPS et le seuil de recouvrement sont écrits une seule fois (garde-regle-unique). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EPS } from "@/lib/tolerance";

const lire = (f: string) => readFileSync(join(__dirname, "..", "..", f), "utf8");
const CINQ = [
  "src/briques/archive-extraits/plages.ts",
  "src/briques/archive-extraits/fenetres.ts",
  "src/briques/archive-extraits/inscription.ts",
  "src/briques/composition/raccords.ts",
  "src/services/note-extraits.ts",
];

describe("tolerance · une seule définition", () => {
  it("(f1) EPS vaut 1e-9", () => expect(EPS).toBe(1e-9));

  for (const f of CINQ) {
    it(`(f2) ${f} importe EPS de lib/tolerance et ne le redéfinit plus`, () => {
      const src = lire(f);
      expect(src).not.toMatch(/^\s*(export\s+)?const EPS\s*=/m);
      expect(src).toMatch(/import \{ EPS \} from "(\.\.\/\.\.\/lib|@\/lib)\/tolerance";|import \{[^}]*\bEPS\b[^}]*\} from "(\.\.\/\.\.\/lib|@\/lib)\/tolerance";/);
    });
  }

  it("(f3) SEUIL_RECOUVREMENT est défini une seule fois (inscription.ts), note-extraits l'importe", () => {
    expect(lire("src/briques/archive-extraits/inscription.ts")).toMatch(/^export const SEUIL_RECOUVREMENT = 0\.8;$/m);
    const note = lire("src/services/note-extraits.ts");
    expect(note).not.toMatch(/const SEUIL_RECOUVREMENT\s*=/);
    expect(note).toMatch(/import \{[^}]*\bSEUIL_RECOUVREMENT\b[^}]*\} from "@\/briques\/archive-extraits\/inscription";/);
  });
});
