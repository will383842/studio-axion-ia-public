import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Garde de build : `vue.ts` est un composant CLIENT et `secours.ts` est importé par lui. Aucun des deux ne doit
 * importer de VALEUR depuis `fins.ts` (→ emprunts → socle-will → contexte-axion → services/auth, server-only),
 * `emprunts.ts` ou `@/services/`. Les `import type` sont permis.
 */
const FICHIERS = ["src/components/formats/image-video/vue.ts", "src/moteurs/montage-image-video/secours.ts"];
const INTERDITS = [/^\.\/fins$/, /^@\/moteurs\/montage-image-video\/fins$/, /^\.\/emprunts$/, /^@\/moteurs\/montage-image-video\/emprunts$/, /^@\/services\//];

function importsDeValeur(source: string): string[] {
  const trouves: string[] = [];
  for (const m of source.matchAll(/^\s*import\s+(type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/gm)) {
    if (m[1]) continue; // import type entier
    const corps = m[2]!;
    const accolades = corps.match(/\{([\s\S]*)\}/);
    // `import { type A, type B }` : aucune valeur
    const aDesValeurs = accolades
      ? corps.replace(/\{[\s\S]*\}/, "").replace(/[,\s]/g, "") !== "" ||
        accolades[1]!.split(",").map((x) => x.trim()).filter(Boolean).some((x) => !x.startsWith("type "))
      : true;
    if (aDesValeurs) trouves.push(m[3]!);
  }
  for (const m of source.matchAll(/^\s*(?:import\s+["']([^"']+)["']|export\s+(?:\*|\{[^}]*\})\s+from\s+["']([^"']+)["'])/gm)) {
    trouves.push((m[1] ?? m[2])!);
  }
  return trouves;
}

describe("écrans Image → vidéo : aucun import de valeur serveur", () => {
  for (const f of FICHIERS) {
    it(`${f} n'importe de valeur ni de fins, ni d'emprunts, ni de services`, () => {
      const source = readFileSync(resolve(process.cwd(), f), "utf8");
      const fautifs = importsDeValeur(source).filter((chemin) => INTERDITS.some((r) => r.test(chemin)));
      expect(fautifs).toEqual([]);
    });
  }
  it("texte-fin.ts n'a aucun import de valeur", () => {
    const source = readFileSync(resolve(process.cwd(), "src/moteurs/montage-image-video/texte-fin.ts"), "utf8");
    expect(importsDeValeur(source)).toEqual([]);
  });
});
