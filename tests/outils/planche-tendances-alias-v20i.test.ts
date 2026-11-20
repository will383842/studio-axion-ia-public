/** X1-17-REPARE-v20i : le script de la planche passe l'alias « @ » → src au bundle Remotion (lecture du texte, aucun import). */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const fichiers = (d: string): string[] =>
  readdirSync(join(process.cwd(), d)).flatMap((n) => {
    if (n === "node_modules" || n.startsWith(".")) return [];
    const p = `${d}/${n}`;
    return statSync(join(process.cwd(), p)).isDirectory() ? fichiers(p) : /\.(tsx?|mts)$/.test(n) ? [p] : [];
  });

describe("planche tendances 2027 : bundle réparé", () => {
  const s = lire("outils/tendances-2027/planche.mts");
  it("passe un webpackOverride au bundle", () => {
    expect(s).toMatch(/bundle\(\{[^}]*webpackOverride/);
  });
  it("alias « @ » vers src", () => {
    expect(s).toMatch(/"@":\s*join\(RACINE,\s*"src"\)/);
  });
  it("l'entrée temporaire est toujours supprimée dans un finally", () => {
    expect(s).toMatch(/finally\s*\{[^}]*rmSync\(dossierTmp/);
  });
  it("aucun fichier de src/ ni studio-rendu/ n'importe outils/tendances-2027", () => {
    for (const f of [...fichiers("src"), ...fichiers("studio-rendu")]) expect(lire(f), f).not.toMatch(/outils\/tendances-2027|PlancheTendances2027/);
  });
});
