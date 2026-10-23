/**
 * GARDE-FOU DURABLE : l'image du studio se construit avec ce qu'elle contient. `pnpm build` (Next) vérifie le typage de
 * TOUT ce que `tsconfig.json` inclut et qui est présent dans le contexte de construction (`Dockerfile.dockerignore`) :
 * `src/`, mais aussi `scripts/` et les fichiers de la racine. Un tel fichier qui importe un dossier exclu de l'image
 * (`tests/`, `outils/`, `studio-rendu/`, `docs/`…) passe tous les tests ici (les dossiers sont là) mais casse la
 * construction de l'image à la mise en ligne. Défaut constaté le 12/10 : `scripts/tableau/apercus-formats.mts` importait
 * `tests/tableau/…` (déplacé depuis dans `tests/tableau/formats/`). Récidive le 14/10 : `scripts/banc-ecriture.ts`
 * importait `tests/generateur/banc/…` et `tests/helpers/g4` (déplacé dans `tests/banc-ecriture/`) ; un test nommé le
 * vérifie désormais pour `scripts/` et `src/` vers `tests/`.
 *
 * Le test LIT `Dockerfile.dockerignore` et `tsconfig.json` : ajouter une exclusion ou un dossier les met à jour seuls.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

/** Règles de `Dockerfile.dockerignore` (ordre gardé : la dernière qui correspond l'emporte, `!` réintègre). */
function reglesIgnore(texte: string): { motif: RegExp; inverse: boolean }[] {
  return texte
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const inverse = l.startsWith("!");
      const brut = (inverse ? l.slice(1) : l).replace(/^\/+|\/+$/g, "");
      let re = "";
      for (let i = 0; i < brut.length; i++) {
        const c = brut[i];
        if (c === "*" && brut[i + 1] === "*") {
          re += brut[i + 2] === "/" ? "(?:.*/)?" : ".*";
          i += brut[i + 2] === "/" ? 2 : 1;
        } else if (c === "*") re += "[^/]*";
        else if (c === "?") re += "[^/]";
        else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
      }
      return { motif: new RegExp(`^${re}$`), inverse };
    });
}

/** Vrai si le chemin (relatif à la racine) est absent du contexte : lui-même ou l'un de ses dossiers parents exclu. */
function exclu(chemin: string, regles: ReturnType<typeof reglesIgnore>): boolean {
  const parties = chemin.split("/");
  for (let n = 1; n <= parties.length; n++) {
    const prefixe = parties.slice(0, n).join("/");
    let dehors = false;
    for (const r of regles) if (r.motif.test(prefixe)) dehors = !r.inverse;
    if (dehors) return true;
  }
  return false;
}

const REGLES = reglesIgnore(readFileSync(join(RACINE, "Dockerfile.dockerignore"), "utf8"));
const TSCONFIG = JSON.parse(readFileSync(join(RACINE, "tsconfig.json"), "utf8")) as { include: string[]; exclude?: string[] };
/** Extensions que les motifs `include` de `tsconfig.json` couvrent (`**\/*.ts`, `**\/*.tsx`, `**\/*.mts`…). */
const EXTENSIONS = TSCONFIG.include.map((m) => /^\*\*\/\*(\.[a-z]+)$/.exec(m)?.[1]).filter((e): e is string => !!e);
const EXCLUS_TS = (TSCONFIG.exclude ?? []).map((d) => d.replace(/\/+$/, ""));

/** Fichiers TypeScript présents dans l'image du studio ET vérifiés par le typage. */
function fichiersImage(): string[] {
  const res: string[] = [];
  const parcourir = (dossier: string) => {
    for (const e of readdirSync(join(RACINE, dossier), { withFileTypes: true })) {
      const chemin = dossier ? `${dossier}/${e.name}` : e.name;
      if (exclu(chemin, REGLES) || e.name === ".git") continue;
      if (e.isDirectory()) {
        if (!EXCLUS_TS.includes(chemin)) parcourir(chemin);
      } else if (e.isFile() && EXTENSIONS.some((x) => e.name.endsWith(x)) && !e.name.endsWith(".d.ts")) res.push(chemin);
    }
  };
  parcourir("");
  return res;
}

/** Tous les chemins importés par un texte source. */
function specificateurs(texte: string): string[] {
  const res: string[] = [];
  for (const m of texte.matchAll(/\b(?:import|export)\s+[^;"'`]*?\bfrom\s*["']([^"']+)["']/g)) res.push(m[1]);
  for (const m of texte.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g)) res.push(m[1]);
  for (const m of texte.matchAll(/\brequire\s*\(\s*["']([^"']+)["']/g)) res.push(m[1]);
  for (const m of texte.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) res.push(m[1]);
  return res;
}

/** Chemin du dépôt visé par un import (null : paquet de node_modules ou module de Node). */
function cible(fichier: string, specif: string): string | null {
  let absolu: string;
  if (specif.startsWith("@/")) absolu = resolve(RACINE, "src", specif.slice(2));
  else if (specif.startsWith(".")) absolu = resolve(RACINE, dirname(fichier), specif);
  else return null;
  return relative(RACINE, absolu).split(sep).join("/");
}

function fautes(fichiers: string[], lire: (f: string) => string): string[] {
  const res: string[] = [];
  for (const fichier of fichiers) {
    for (const specif of specificateurs(lire(fichier))) {
      const vise = cible(fichier, specif);
      if (vise && exclu(vise, REGLES)) res.push(`${fichier} importe « ${specif} » (${vise}), exclu de l'image par Dockerfile.dockerignore`);
    }
  }
  return res;
}

describe("image du studio autonome (Dockerfile.dockerignore × tsconfig.json)", () => {
  it("aucun fichier TypeScript de l'image vérifié par le typage n'importe un dossier exclu de l'image", () => {
    expect(fautes(fichiersImage(), (f) => readFileSync(join(RACINE, f), "utf8"))).toEqual([]);
  });

  it("le parcours couvre src/, scripts/ et la racine, et rien de ce qui est exclu", () => {
    const fichiers = fichiersImage();
    expect(fichiers.some((f) => f.startsWith("src/"))).toBe(true);
    expect(fichiers).toContain("scripts/tableau/fabriquer.ts");
    expect(fichiers).toContain("next.config.ts");
    expect(fichiers.filter((f) => /^(tests|outils|studio-rendu|docs|node_modules)\//.test(f) || /\.test\.tsx?$/.test(f))).toEqual([]);
  });

  it("lit les règles de Dockerfile.dockerignore comme Docker (dossiers, **, *, !)", () => {
    const r = reglesIgnore("tests\n**/*.test.ts\n.next-*\nstudio-rendu/.remotion\n**/node_modules\ndocs\n!docs/garde");
    expect(exclu("tests/tableau/regles/exemples", r)).toBe(true);
    expect(exclu("src/a/b.test.ts", r)).toBe(true);
    expect(exclu(".next-b1/types/x.ts", r)).toBe(true);
    expect(exclu("studio-rendu/node_modules/x", r)).toBe(true);
    expect(exclu("src/briques/stylo/trace.ts", r)).toBe(false);
    expect(exclu("scripts/tableau/fabriquer.ts", r)).toBe(false);
    expect(exclu("docs/x.md", r)).toBe(true);
  });

  it("aucun fichier de scripts/ ni de src/ n'importe tests/ (défaut du 14/10 : scripts/banc-ecriture.ts)", () => {
    const fichiers = fichiersImage().filter((f) => /^(scripts|src)\//.test(f));
    expect(fichiers.some((f) => f.startsWith("scripts/"))).toBe(true);
    const versTests = fautes(fichiers, (f) => readFileSync(join(RACINE, f), "utf8")).filter((x) => /\(tests(\/|\))/.test(x));
    expect(versTests).toEqual([]);
    expect(fichiers).not.toContain("scripts/banc-ecriture.ts");
  });

  it("rougit sur le défaut du 14/10 (le banc d'écriture dans scripts/ qui importait tests/)", () => {
    const fautif = 'import { CONTEXTE_BANC } from "../tests/generateur/banc/registre-banc-g4";\nimport { TOURNURES_G4 } from "../tests/helpers/g4";';
    expect(fautes(["scripts/banc-ecriture.ts"], () => fautif)).toEqual([
      "scripts/banc-ecriture.ts importe « ../tests/generateur/banc/registre-banc-g4 » (tests/generateur/banc/registre-banc-g4), exclu de l'image par Dockerfile.dockerignore",
      "scripts/banc-ecriture.ts importe « ../tests/helpers/g4 » (tests/helpers/g4), exclu de l'image par Dockerfile.dockerignore",
    ]);
  });

  it("rougit sur le défaut du 12/10 (un fichier de scripts/ qui importe tests/)", () => {
    const fautif = 'import { motsFabriques } from "../../tests/tableau/compositions/outils";\nimport { x } from "@/moteurs/y";';
    expect(fautes(["scripts/tableau/fautif.mts"], () => fautif)).toEqual([
      "scripts/tableau/fautif.mts importe « ../../tests/tableau/compositions/outils » (tests/tableau/compositions/outils), exclu de l'image par Dockerfile.dockerignore",
    ]);
  });
});
