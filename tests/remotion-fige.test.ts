/**
 * Remotion figé en 4.x (02/10, `docs/ARCHITECTURE.md`) : la 5.0 compte les prestataires dans la taille de l'équipe et
 * ajoute des conditions ; passage en 5 seulement après relecture de la licence et accord de Will. Une version écrite
 * avec « ^ » ou « ~ » laisserait une installation monter seule : ce test l'interdit, dans tous les package.json.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..");
const est = (nom: string) => nom === "remotion" || nom.startsWith("@remotion/");

function paquetsRemotion(chemin: string): [string, string][] {
  const p = JSON.parse(readFileSync(chemin, "utf8")) as Record<string, Record<string, string> | undefined>;
  return ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"].flatMap((k) => Object.entries(p[k] ?? {}).filter(([n]) => est(n)));
}

describe("Remotion figé en 4.x exacte", () => {
  const fichiers = ["package.json", "studio-rendu/package.json"].map((f) => join(RACINE, f)).filter(existsSync);

  it("chaque paquet remotion / @remotion/* a une version 4.x EXACTE (sans ^ ni ~), la même partout", () => {
    const versions = new Set<string>();
    for (const f of fichiers) {
      for (const [nom, version] of paquetsRemotion(f)) {
        expect(version, `${nom} dans ${f}`).toMatch(/^4\.\d+\.\d+$/);
        versions.add(version);
      }
    }
    expect(versions.size).toBe(1);
  });

  it("le verrou de studio-rendu installe bien cette version (aucun paquet Remotion en 5)", () => {
    const verrou = join(RACINE, "studio-rendu", "package-lock.json");
    const voulu = Object.fromEntries(paquetsRemotion(join(RACINE, "studio-rendu", "package.json")));
    const paquets = (JSON.parse(readFileSync(verrou, "utf8")) as { packages: Record<string, { version?: string }> }).packages;
    const remotion = Object.entries(paquets).filter(([k]) => /(^|\/)node_modules\/(remotion|@remotion\/[^/]+)$/.test(k));
    expect(remotion.length).toBeGreaterThan(0);
    for (const [k, v] of remotion) expect(v.version, k).toBe(voulu.remotion);
  });
});
