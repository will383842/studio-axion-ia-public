/**
 * X7 · L'image de rendu ne reçoit de `src/` que les chemins copiés par `deploiement/studio-rendu/Dockerfile`. Toute
 * composition du format (`studio-rendu/compositions/cas-concret/**`) qui importe, directement ou par rebond, un fichier
 * de `src/` hors de cette liste (même par un `import type`) passe les tests ici mais casse le rendu dans l'image
 * (module introuvable). Ce test refait le calcul à chaque passage : il LIT le `Dockerfile` et suit les imports.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const DEPART = "studio-rendu/compositions/cas-concret";

/** Chemins de `src/` copiés dans l'image (sources des `COPY` qui commencent par `src/`). */
export function cheminsCopies(dockerfile: string): string[] {
  const res: string[] = [];
  for (const brut of dockerfile.split("\n")) {
    const ligne = brut.trim();
    if (!/^COPY\s/.test(ligne)) continue;
    const mots = ligne.split(/\s+/).slice(1).filter((m) => !m.startsWith("--"));
    for (const source of mots.slice(0, -1)) if (source.startsWith("src/")) res.push(source.replace(/\/+$/, ""));
  }
  return res;
}

/** Vrai si le fichier (relatif à la racine) est l'un des chemins copiés ou se trouve dessous. */
export function copie(fichier: string, chemins: string[]): boolean {
  return chemins.some((c) => fichier === c || fichier.startsWith(`${c}/`));
}

/** Chemins importés par un texte source, `import type` et `export … from` compris. */
function specificateurs(texte: string): string[] {
  const res: string[] = [];
  for (const m of texte.matchAll(/\b(?:import|export)\s+[^;"'`]*?\bfrom\s*["']([^"']+)["']/g)) res.push(m[1]);
  for (const m of texte.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g)) res.push(m[1]);
  for (const m of texte.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) res.push(m[1]);
  return res;
}

const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".json"];

/** Fichier du dépôt visé par un import relatif (null : paquet de node_modules ou module de Node). */
function resoudre(fichier: string, specif: string, existe: (absolu: string) => boolean): string | null {
  if (specif.startsWith("@/")) throw new Error(`${fichier} : alias « ${specif} » introuvable dans l'image de rendu`);
  if (!specif.startsWith(".")) return null;
  const base = resolve(RACINE, dirname(fichier), specif);
  const essais = [base, ...EXTENSIONS.map((x) => base + x), ...EXTENSIONS.map((x) => join(base, `index${x}`))];
  const trouve = essais.find(existe);
  if (!trouve) throw new Error(`${fichier} : import « ${specif} » introuvable`);
  return relative(RACINE, trouve).split(sep).join("/");
}

function fichiersDe(dossier: string): string[] {
  const res: string[] = [];
  for (const e of readdirSync(join(RACINE, dossier), { withFileTypes: true })) {
    const chemin = `${dossier}/${e.name}`;
    if (e.isDirectory()) res.push(...fichiersDe(chemin));
    else if (/\.(ts|tsx)$/.test(e.name)) res.push(chemin);
  }
  return res;
}

/** Tous les fichiers de `src/` atteints depuis les compositions du format, avec le premier fichier qui les importe. */
export function importsDeSrc(
  departs: string[],
  lire: (f: string) => string,
  existe: (absolu: string) => boolean = (e) => existsSync(e) && statSync(e).isFile(),
): Map<string, string> {
  const vus = new Set<string>(departs);
  const pile = [...departs];
  const atteints = new Map<string, string>();
  while (pile.length) {
    const fichier = pile.pop()!;
    if (!/\.(ts|tsx|mts)$/.test(fichier)) continue;
    for (const specif of specificateurs(lire(fichier))) {
      const vise = resoudre(fichier, specif, existe);
      if (!vise || vus.has(vise)) continue;
      vus.add(vise);
      if (vise.startsWith("src/")) atteints.set(vise, fichier);
      pile.push(vise);
    }
  }
  return atteints;
}

const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");
const COPIES = cheminsCopies(lire("deploiement/studio-rendu/Dockerfile"));

describe("image de rendu : les compositions du format n'importent de src/ que ce que le Dockerfile copie", () => {
  it("chaque fichier de src/ atteint (direct, par rebond, import type compris) est copié dans l'image", () => {
    const atteints = importsDeSrc(fichiersDe(DEPART), lire);
    expect([...atteints.keys()].some((f) => f.startsWith("src/briques/habillage/"))).toBe(true);
    expect([...atteints.keys()].some((f) => f.startsWith("src/briques/ecrans-motion/"))).toBe(true);
    const manquants = [...atteints].filter(([f]) => !copie(f, COPIES)).map(([f, par]) => `${f} (importé par ${par})`);
    expect(manquants).toEqual([]);
  });

  it("lit les COPY du Dockerfile, sources multiples comprises", () => {
    const d = "COPY --chown=r:r src/briques/motion /app/src/briques/motion\nCOPY --chown=r:r src/lib/a.ts src/lib/b.ts /app/src/lib/\nCOPY x ./x";
    expect(cheminsCopies(d)).toEqual(["src/briques/motion", "src/lib/a.ts", "src/lib/b.ts"]);
    expect(copie("src/briques/motion/x/y.ts", cheminsCopies(d))).toBe(true);
    expect(copie("src/briques/motionx.ts", cheminsCopies(d))).toBe(false);
  });

  it("rougit sur un import type par rebond hors de la liste", () => {
    const sources: Record<string, string> = {
      [`${DEPART}/Fautif.tsx`]: 'import type { X } from "./relais";',
      [`${DEPART}/relais.ts`]: 'export type { Y } from "../../../src/domaine/duree-tableau";',
    };
    const faux = (e: string) => relative(RACINE, e).split(sep).join("/") in sources;
    const atteints = importsDeSrc([`${DEPART}/Fautif.tsx`], (f) => sources[f] ?? lire(f), (e) => faux(e) || (existsSync(e) && statSync(e).isFile()));
    expect([...atteints].filter(([f]) => !copie(f, COPIES))).toEqual([["src/domaine/duree-tableau.ts", `${DEPART}/relais.ts`]]);
  });
});
