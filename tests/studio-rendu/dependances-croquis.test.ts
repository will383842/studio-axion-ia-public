import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { reconnaitre } from "../../outils/licences/verifier-licence.mjs";
import { DROITS } from "../../src/briques/droits";

const RACINE = process.cwd();
const lire = (chemin: string) => JSON.parse(readFileSync(join(RACINE, chemin), "utf8"));
const paquet = lire("studio-rendu/package.json");
const verrou = lire("studio-rendu/package-lock.json");
const PAQUETS = { roughjs: "4.6.6", "perfect-freehand": "1.2.3" } as const;

describe("dépendances du style croquis (X1-07)", () => {
  it("versions figées, sans ^ ni ~, déclarées et verrouillées", () => {
    for (const [nom, version] of Object.entries(PAQUETS)) {
      expect(paquet.dependencies[nom], nom).toBe(version);
      expect(verrou.packages[`node_modules/${nom}`]?.version, nom).toBe(version);
      expect(verrou.packages[`node_modules/${nom}`]?.integrity, nom).toMatch(/^sha512-/);
    }
  });

  it("licence copiée, datée, avec l'empreinte du verrou ; reconnue MIT par l'outil", () => {
    for (const [nom, version] of Object.entries(PAQUETS)) {
      const f = join(RACINE, `studio-rendu/LICENCES/${nom}-${version}.txt`);
      expect(existsSync(f), f).toBe(true);
      const t = readFileSync(f, "utf8");
      expect(t).toContain(version);
      expect(t).toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(t).toContain(verrou.packages[`node_modules/${nom}`].integrity);
      expect(reconnaitre(t)).toBe("MIT");
    }
  });

  it("entrées du registre des droits, une par paquet", () => {
    for (const [nom, version] of Object.entries(PAQUETS)) {
      const e = DROITS.find((d) => d.id === nom);
      expect(e, nom).toBeDefined();
      expect(e?.spdx).toBe("MIT");
      expect(e?.versionFigee).toBe(version);
      expect(existsSync(join(RACINE, e?.fichierLicence ?? "absent")), nom).toBe(true);
    }
  });

  it("chaque dépendance directe de studio-rendu a son fichier de licence", () => {
    const fichiers = (n: string) => (n.startsWith("@remotion/") ? "remotion-paths-shapes" : n);
    for (const [nom, version] of Object.entries<string>(paquet.dependencies)) {
      if (["react", "react-dom", "remotion", "tsx", "typescript", "zod", "@remotion/bundler", "@remotion/renderer"].includes(nom)) continue; // hors périmètre de cette fiche
      expect(existsSync(join(RACINE, `studio-rendu/LICENCES/${fichiers(nom)}-${version}.txt`)), nom).toBe(true);
    }
  });

  it("éteint : seul le style croquis (X1-08) importe roughjs ; seul le trait au feutre (X1-09) importe perfect-freehand", () => {
    const sortie = execSync(
      `grep -rEl "from ['\\"](roughjs|perfect-freehand)" src studio-rendu/compositions studio-rendu/src || true`,
      { cwd: RACINE, encoding: "utf8" },
    );
    // X1-09, 17/11 : liste fermée, égalité exacte conservée ; ajout du seul trait au feutre (non inscrit) qui importe perfect-freehand.
    expect(sortie.trim().split("\n").filter(Boolean).sort()).toEqual([
      "studio-rendu/compositions/petits-objets/TraitFeutre.tsx",
      "studio-rendu/compositions/petits-objets/croquis/Croquis.tsx",
    ]);
    const freehand = execSync(`grep -rEl "perfect-freehand" src studio-rendu/compositions studio-rendu/src --include=*.ts --include=*.tsx | grep -v "^src/briques/droits/" || true`, { cwd: RACINE, encoding: "utf8" });
    // X1-09, 17/11 : seul le trait au feutre, non inscrit, importe perfect-freehand.
    expect(freehand.trim().split("\n").filter(Boolean)).toEqual(["studio-rendu/compositions/petits-objets/TraitFeutre.tsx"]);
    // Éteint réel : seul objets-2027.tsx importe trait-feutre (hors TraitFeutre.tsx).
    const importeurs = execSync(`grep -rlE "[/\\"']\\.{0,2}/?(petits-objets/)?(TraitFeutre|trait-feutre)['\\"]" src studio-rendu/compositions studio-rendu/src --include=*.ts --include=*.tsx | grep -v "^studio-rendu/compositions/petits-objets/TraitFeutre.tsx$" || true`, { cwd: RACINE, encoding: "utf8" });
    // BR-OBJETS-2027-a (amendement n°1) : liste exacte, un seul importeur de plus (la définition d'objet du registre).
    expect(importeurs.trim().split("\n").filter(Boolean).sort()).toEqual(["src/briques/motion/petits-objets/objets-2027.tsx"]);
  });
});
