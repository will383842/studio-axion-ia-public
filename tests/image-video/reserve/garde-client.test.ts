/**
 * RÉSERVE Image → vidéo · garde du bundle client : un fichier `"use client"` n'atteint, par ses imports (relatifs ou
 * alias `@/`), ni `node:*` ni `server-only`. Les actions serveur (`"use server"`) sont des appels distants. Les `import type` sont effacés à la compilation : ils ne comptent pas.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = resolve(__dirname, "../../..");
const SRC = join(RACINE, "src");
const EXT = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

function resoudre(depuis: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(depuis), spec) : null;
  if (!base) return null;
  return EXT.map((e) => base + e).find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

/** Imports qui survivent à la compilation (sans `import type`, ni `{ type X }` seul). */
function imports(code: string): string[] {
  const sortie: string[] = [];
  const re = /(?:^|\n)\s*(import|export)\s+(type\s+)?([^;'"]*?\bfrom\s*)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;
  for (const m of code.matchAll(re)) {
    if (m[5]) continue; // import dynamique : chargé à la demande, hors bundle initial
    if (m[2]) continue;
    const liste = m[3]?.match(/\{([^}]*)\}/)?.[1];
    const defaut = m[3]?.replace(/\{[^}]*\}/, "").replace(/\bfrom\s*$/, "").replace(/[,\s*]|\bas\b/g, "");
    if (liste !== undefined && !defaut && liste.split(",").map((x) => x.trim()).filter(Boolean).every((x) => x.startsWith("type "))) continue;
    sortie.push(m[4]);
  }
  return sortie;
}

/** Chemin d'imports du fichier jusqu'à un module interdit, ou `null`. */
export function cheminInterdit(fichier: string, vus = new Set<string>()): string[] | null {
  if (vus.has(fichier)) return null;
  vus.add(fichier);
  const code = readFileSync(fichier, "utf8");
  // Une action serveur ("use server") devient un simple appel distant dans le bundle client : son code n'y entre pas.
  if (/^\s*["']use server["']/.test(code)) return null;
  if (/import\s+["']server-only["']/.test(code)) return [fichier, "server-only"];
  for (const spec of imports(code)) {
    if (spec.startsWith("node:") || spec === "server-only") return [fichier, spec];
    const cible = resoudre(fichier, spec);
    const suite = cible && /\.(ts|tsx)$/.test(cible) ? cheminInterdit(cible, vus) : null;
    if (suite) return [fichier, ...suite];
  }
  return null;
}

describe("garde · un composant client n'atteint ni node: ni server-only", () => {
  it("Reserve.tsx (use client) ne tire aucun module serveur", () => {
    const f = join(SRC, "components/formats/image-video/Reserve.tsx");
    expect(readFileSync(f, "utf8")).toMatch(/^"use client"/);
    const chemin = cheminInterdit(f);
    expect(chemin && chemin.map((p) => p.replace(RACINE, "")).join(" → ")).toBeNull();
  });

  it("la garde voit un import de valeur vers le domaine de la réserve (qui tire node:crypto), pas un import type", () => {
    const dom = join(SRC, "domaine/image-video/reserve.ts");
    expect(cheminInterdit(dom)).not.toBeNull();
    expect(imports(`import type { A } from "@/x";\nimport { type B } from "@/y";\nimport { c } from "@/z";`)).toEqual(["@/z"]);
  });
});
