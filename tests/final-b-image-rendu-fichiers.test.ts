/**
 * Correcteur final B — garde-fou de l'image studio-rendu : chaque fichier du studio (`src/…`) importé par les fichiers
 * COPIÉS dans `deploiement/studio-rendu/Dockerfile` doit lui aussi être copié. L'incident du 04/10 (erreur-lisible.ts
 * importé par qc-lut.ts mais pas copié : studio-rendu redémarrait en boucle) aurait fait rougir ce test.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const DOCKERFILE = readFileSync(join(RACINE, "deploiement/studio-rendu/Dockerfile"), "utf8");
const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"];

/** Sources des `COPY` (chemins du dépôt, contexte = racine), hors package.json / verrou / tsconfig. */
function sourcesCopiees(dockerfile: string): string[] {
  const sources: string[] = [];
  for (const ligne of dockerfile.replace(/\\\n/g, " ").split("\n")) {
    const m = /^\s*COPY\s+(.*)$/i.exec(ligne);
    if (!m) continue;
    const mots = m[1].split(/\s+/).filter((x) => x && !x.startsWith("--"));
    sources.push(...mots.slice(0, -1));
  }
  return sources;
}

function fichiersSous(chemin: string): string[] {
  const absolu = join(RACINE, chemin);
  if (!existsSync(absolu)) return [];
  if (statSync(absolu).isFile()) return [chemin];
  return readdirSync(absolu, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(RACINE, join(e.parentPath, e.name)));
}

function estCopie(fichier: string, sources: string[]): boolean {
  return sources.some((s) => fichier === s || fichier.startsWith(s.replace(/\/$/, "") + "/"));
}

/** Résout un import relatif comme Node / tsx (extension .js → .ts, dossier → index). */
function resoudre(depuis: string, specif: string): string | null {
  const base = resolve(RACINE, dirname(depuis), specif);
  const candidats = [base, ...EXTENSIONS.map((e) => base + e), ...EXTENSIONS.map((e) => join(base, "index" + e))];
  if (/\.(m|c)?js$/.test(base)) candidats.push(...[".ts", ".tsx"].map((e) => base.replace(/\.(m|c)?js$/, e)));
  for (const c of candidats) if (existsSync(c) && statSync(c).isFile()) return relative(RACINE, c);
  return null;
}

/**
 * Imports qui restent à l'exécution (tsx efface les imports de types seuls : `import type`, `export type`,
 * `import { type A, type B }`).
 */
function importsExecutes(texte: string): string[] {
  const res: string[] = [];
  for (const m of texte.matchAll(/\b(import|export)\s+([^;"']*?)\s*from\s*["']([^"']+)["']/g)) {
    const clause = m[2].trim();
    if (/^type\b/.test(clause)) continue;
    const accolades = /^\{([^}]*)\}$/.exec(clause);
    if (accolades && accolades[1].split(",").map((x) => x.trim()).filter(Boolean).every((x) => x.startsWith("type "))) continue;
    res.push(m[3]);
  }
  for (const m of texte.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) res.push(m[1]);
  for (const m of texte.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g)) res.push(m[1]);
  for (const m of texte.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) res.push(m[1]);
  return res;
}

/** Fichiers du studio (`src/…`, hors studio-rendu) atteints depuis les fichiers copiés, et ceux qui manquent. */
function tracer(sources: string[]): { manquants: string[]; alias: string[]; atteints: Set<string> } {
  // Départ : le code du conteneur lui-même (serveur et compositions) ; les fichiers du studio ne comptent que s'ils sont
  // atteints (un dossier copié en entier peut contenir des fichiers jamais chargés, ou des essais).
  const depart = sources
    .filter((s) => s.startsWith("studio-rendu/"))
    .flatMap(fichiersSous)
    .filter((f) => /\.(tsx?|m?js)$/.test(f) && !/\.test\.tsx?$/.test(f));
  const vus = new Set<string>(depart);
  const file = [...depart];
  const manquants = new Set<string>();
  const alias = new Set<string>();
  while (file.length) {
    const f = file.pop()!;
    const texte = readFileSync(join(RACINE, f), "utf8");
    {
      for (const s of importsExecutes(texte)) {
        if (s.startsWith("@/")) {
          alias.add(`${f} → ${s}`);
          continue;
        }
        if (!s.startsWith(".")) continue;
        const cible = resoudre(f, s);
        if (!cible) {
          manquants.add(`${f} → ${s} (introuvable)`);
          continue;
        }
        if (!estCopie(cible, sources)) manquants.add(cible);
        if (!vus.has(cible) && /\.(tsx?|m?js)$/.test(cible)) {
          vus.add(cible);
          file.push(cible);
        }
      }
    }
  }
  return { manquants: [...manquants].sort(), alias: [...alias].sort(), atteints: vus };
}

describe("image studio-rendu : fichiers du studio copiés", () => {
  const sources = sourcesCopiees(DOCKERFILE);

  it("le Dockerfile copie bien des fichiers du studio (le test lit les bonnes lignes)", () => {
    expect(sources).toContain("studio-rendu/src");
    expect(sources).toContain("src/lib/qc-lut.ts");
  });

  it("aucun fichier importé n'est oublié, aucun alias @/ (introuvable dans l'image)", () => {
    const { manquants, alias, atteints } = tracer(sources);
    expect(manquants).toEqual([]);
    expect(alias).toEqual([]);
    // Le traceur suit bien les imports jusque dans le studio.
    expect(atteints.has("src/lib/erreur-lisible.ts")).toBe(true);
  });

  it("il retrouve l'oubli du 04/10 : sans erreur-lisible.ts dans le COPY, le test rougit", () => {
    const sansErreurLisible = sourcesCopiees(DOCKERFILE.replace(" src/lib/erreur-lisible.ts", ""));
    expect(sansErreurLisible).not.toContain("src/lib/erreur-lisible.ts");
    expect(tracer(sansErreurLisible).manquants).toContain("src/lib/erreur-lisible.ts");
  });
});
