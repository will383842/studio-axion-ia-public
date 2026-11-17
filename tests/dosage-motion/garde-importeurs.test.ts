// X3-08t : garde statique du dosage. Test seul, aucun code de production.
// Règle 6 X3 : la face caméra animée ne lit pas le dosage ; X3-08 : le code d'argent (image→vidéo) et le rendu non plus.
// Tout autre importeur reste permis (X3-07b, X3-08b, X3-09b, X3-10b en ajouteront de légitimes).
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const RACINE = resolve(__dirname, "..", "..");
const DOSSIERS = ["src", "scripts", "studio-rendu"];
const IGNORES = new Set(["node_modules", ".next", "dist"]);

type Regle = { nom: string; concerne: (rel: string) => boolean; phrase: string };

// Fichiers qui n'ont pas le droit d'importer une cible « dosage ».
export const INTERDITS: Regle[] = [
  { nom: "studio-rendu/**", concerne: (r) => r.startsWith("studio-rendu/"), phrase: "règle X3-08 : le rendu n'importe pas le dosage" },
  { nom: "src/moteurs/montage-facecam-animee/**", concerne: (r) => r.startsWith("src/moteurs/montage-facecam-animee/"), phrase: "règle 6 X3 : la face caméra animée ne lit pas le dosage" },
  { nom: "src/services/facecam-animee.ts", concerne: (r) => r === "src/services/facecam-animee.ts", phrase: "règle 6 X3 : la face caméra animée ne lit pas le dosage" },
  { nom: "src/services/image-video*.ts", concerne: (r) => /^src\/services\/image-video[^/]*\.tsx?$/.test(r), phrase: "règle X3-08 : l'image→vidéo côté argent n'importe pas le dosage" },
  { nom: "src/services/publications.ts", concerne: (r) => r === "src/services/publications.ts", phrase: "zone interdite : publications" },
  { nom: "src/services/travaux.ts", concerne: (r) => r === "src/services/travaux.ts", phrase: "zone interdite : travaux" },
  { nom: "src/services/reglages.ts", concerne: (r) => r === "src/services/reglages.ts", phrase: "zone interdite : réglages" },
  { nom: "src/components/ui/**", concerne: (r) => r.startsWith("src/components/ui/"), phrase: "zone interdite : composants de base" },
];

// Cibles « dosage » (chemin sans extension).
export function estCibleDosage(base: string): boolean {
  return (
    base === "src/briques/dosage-motion" || base.startsWith("src/briques/dosage-motion/") ||
    base === "src/services/dosage-motion" || base === "src/services/dosage-motion-defauts" ||
    base === "src/components/dosage-motion" || base.startsWith("src/components/dosage-motion/") ||
    /^src\/moteurs\/[^/]+\/dosage$/.test(base)
  );
}

// Spécificateurs d'un source : import/export ... from, import "x", import("x"), require("x"), types en ligne.
export function specificateurs(source: string): string[] {
  const sansCommentaires = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const re = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["']([^"']+)["']/g;
  const res: string[] = [];
  for (let m = re.exec(sansCommentaires); m; m = re.exec(sansCommentaires)) res.push(m[1]);
  return res;
}

// Chemin (relatif à la racine, séparateurs /, sans extension) visé par un spécificateur, ou null si paquet externe.
export function resoudre(spec: string, fichierRel: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = "src/" + spec.slice(2);
  else if (spec.startsWith(".")) base = join(dirname(fichierRel), spec).split(sep).join("/");
  else return null;
  return base.replace(/\.(m?[jt]sx?)$/, "").replace(/\/index$/, "");
}

export function violations(fichierRel: string, source: string): string[] {
  const regles = INTERDITS.filter((r) => r.concerne(fichierRel));
  if (!regles.length) return [];
  const res: string[] = [];
  for (const spec of specificateurs(source)) {
    const cible = resoudre(spec, fichierRel);
    if (cible && estCibleDosage(cible)) {
      for (const r of regles) res.push(`${fichierRel} importe « ${spec} » (${cible}) — ${r.nom} — ${r.phrase}`);
    }
  }
  return res;
}

function lister(dossier: string): string[] {
  const res: string[] = [];
  if (!existsSync(dossier)) return res;
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    if (IGNORES.has(e.name)) continue;
    const p = join(dossier, e.name);
    if (e.isDirectory()) res.push(...lister(p));
    else if (/\.(ts|tsx|mts)$/.test(e.name) && !/\.(test|spec)\.(ts|tsx|mts)$/.test(e.name) && !e.name.endsWith(".d.ts")) res.push(p);
  }
  return res;
}

describe("garde du dosage : qui n'a pas le droit de l'importer", () => {
  it("aucun fichier interdit n'importe une cible dosage (tout l'arbre)", () => {
    const fichiers = DOSSIERS.flatMap((d) => lister(join(RACINE, d)));
    expect(fichiers.length).toBeGreaterThan(100);
    const toutes: string[] = [];
    for (const f of fichiers) {
      const rel = relative(RACINE, f).split(sep).join("/");
      toutes.push(...violations(rel, readFileSync(f, "utf8")));
    }
    expect(toutes, toutes.join("\n")).toEqual([]);
  });

  it("le parcours voit bien les importeurs permis actuels (pas vert à vide)", () => {
    const fichiers = DOSSIERS.flatMap((d) => lister(join(RACINE, d)));
    const importeurs = new Set<string>();
    for (const f of fichiers) {
      const rel = relative(RACINE, f).split(sep).join("/");
      for (const spec of specificateurs(readFileSync(f, "utf8"))) {
        const c = resoudre(spec, rel);
        if (c && estCibleDosage(c)) importeurs.add(rel);
      }
    }
    expect(importeurs.has("src/services/fabrication.ts")).toBe(true);
    expect(importeurs.has("src/moteurs/montage-facecam/chaine.ts")).toBe(true);
    expect(importeurs.has("scripts/dosage-motion/planche.ts")).toBe(true);
    expect(importeurs.has("src/domaine/types.ts")).toBe(true); // types en ligne import("…")
  });

  it("détecteur essayé sur des chaînes fictives", () => {
    // refusés
    expect(violations("src/services/image-video-rendu.ts", `import { x } from "@/briques/dosage-motion/crans";`)).toHaveLength(1);
    expect(violations("src/moteurs/montage-facecam-animee/a.ts", `import { y } from "./dosage";`)).toHaveLength(1); // relatif ./dosage depuis la face caméra animée : refusé
    expect(violations("src/moteurs/montage-facecam-animee/a.ts", `import { y } from "../montage-facecam/dosage";`).length).toBeGreaterThan(0);
    expect(violations("src/moteurs/montage-facecam-animee/a.ts", `import { y } from "@/briques/dosage-motion";`).length).toBeGreaterThan(0);
    expect(violations("studio-rendu/src/a.ts", `const m = await import("../../src/services/dosage-motion");`).length).toBeGreaterThan(0);
    expect(violations("src/services/facecam-animee.ts", `const t: import("@/briques/dosage-motion/types").DosageMotion = 1;`).length).toBeGreaterThan(0);
    expect(violations("src/components/ui/b.tsx", `import "@/components/dosage-motion/Bouton";`).length).toBeGreaterThan(0);
    expect(violations("src/services/publications.ts", `export * from "./dosage-motion-defauts";`).length).toBeGreaterThan(0);
    const nom = violations("src/services/image-video-rendu.ts", `import x from "@/briques/dosage-motion/crans";`)[0];
    expect(nom).toContain("image-video-rendu.ts");
    expect(nom).toContain("src/briques/dosage-motion/crans");
    expect(nom).toContain("règle X3-08");
    // permis
    expect(violations("src/moteurs/montage-image-video/sous-titres-varies.ts", `import { d } from "./dosage";`)).toEqual([]);
    expect(violations("src/services/fabrication.ts", `import { a } from "./dosage-motion";`)).toEqual([]);
    expect(violations("src/services/image-video-rendu.ts", `import { z } from "./image-video";`)).toEqual([]);
    // commentaire ignoré
    expect(violations("src/services/image-video.ts", `// import x from "@/briques/dosage-motion/crans";`)).toEqual([]);
  });

  it("rouge d'abord : lister montage-facecam parmi les interdits ferait échouer chaine.ts", () => {
    const rel = "src/moteurs/montage-facecam/chaine.ts";
    const source = readFileSync(join(RACINE, rel), "utf8");
    expect(violations(rel, source)).toEqual([]);
    INTERDITS.push({ nom: "src/moteurs/montage-facecam (essai)", concerne: (r) => r.startsWith("src/moteurs/montage-facecam/"), phrase: "essai" });
    try {
      expect(violations(rel, source).length).toBeGreaterThan(0);
    } finally {
      INTERDITS.pop();
    }
  });
});
