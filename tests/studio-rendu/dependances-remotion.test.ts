import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();
const lire = (chemin: string) => JSON.parse(readFileSync(join(RACINE, chemin), "utf8"));
const paquet = lire("studio-rendu/package.json");
const verrou = lire("studio-rendu/package-lock.json");
const tout: Record<string, string> = {
  ...(paquet.dependencies ?? {}),
  ...(paquet.devDependencies ?? {}),
};
const VERSION = "4.0.532";

describe("dépendances Remotion de studio-rendu", () => {
  it("remotion et tous les @remotion/* ont la même version exacte", () => {
    const noms = Object.keys(tout).filter((n) => n === "remotion" || n.startsWith("@remotion/"));
    expect(noms.length).toBeGreaterThan(0);
    for (const n of noms) {
      expect(tout[n], n).toBe(VERSION);
      expect(tout[n], n).not.toMatch(/[\^~]/);
    }
  });

  it("@remotion/paths et @remotion/shapes sont déclarés et verrouillés en 4.0.532", () => {
    for (const n of ["@remotion/paths", "@remotion/shapes"]) {
      expect(tout[n], n).toBe(VERSION);
      expect(verrou.packages[`node_modules/${n}`]?.version, n).toBe(VERSION);
    }
  });

  it("aucun Lottie, ni dans le package.json ni dans le verrou", () => {
    const noms = [...Object.keys(tout), ...Object.keys(verrou.packages ?? {})];
    expect(noms.filter((n) => /lottie/i.test(n))).toEqual([]);
  });

  it("aucun @remotion/* dans le package.json racine", () => {
    const racine = lire("package.json");
    const noms = Object.keys({ ...(racine.dependencies ?? {}), ...(racine.devDependencies ?? {}) });
    expect(noms.filter((n) => n.startsWith("@remotion/"))).toEqual([]);
  });

  it("le fichier de licence existe, cite 4.0.532 et une date", () => {
    const f = join(RACINE, "studio-rendu/LICENCES/remotion-paths-shapes-4.0.532.txt");
    expect(existsSync(f)).toBe(true);
    const t = readFileSync(f, "utf8");
    expect(t).toContain(VERSION);
    expect(t).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
