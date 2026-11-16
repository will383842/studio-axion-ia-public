/**
 * C1-U11 : gardes statiques de la bibliothèque vidéo (lecture des fichiers, aucune exécution du code visé).
 * 1. le rendu (`studio-rendu/`) n'importe pas la brique ;
 * 2. la brique reste côté Studio (ni `studio-rendu`, ni `server-only`, ni `react`) ;
 * 3. ni argent ni fournisseur, par chemins résolus et comparés en entier (A1-1) ;
 * 4. rien n'écrit.
 * Garde 5 retirée (A1-10) : l'ancienne garde 5 est une règle de revue : le relecteur vérifie qu'aucun moteur ne lit
 * les réglages de la bibliothèque. Aucun test.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const EXTENSIONS_SOURCE = /\.(ts|tsx|mjs)$/;

function lister(dossier: string): string[] {
  const absolu = join(RACINE, dossier);
  if (!existsSync(absolu)) return [];
  const sortie: string[] = [];
  for (const nom of readdirSync(absolu)) {
    if (nom === "node_modules") continue;
    const chemin = join(absolu, nom);
    if (statSync(chemin).isDirectory()) sortie.push(...lister(relative(RACINE, chemin)));
    else if (EXTENSIONS_SOURCE.test(nom)) sortie.push(relative(RACINE, chemin).split("\\").join("/"));
  }
  return sortie;
}

function lire(chemin: string): string {
  return readFileSync(join(RACINE, chemin), "utf8");
}

/** Retire `/*…*​/` et `//…` (hors chaînes) ; les commentaires ne sont pas des imports. */
function sansCommentaires(source: string): string {
  let sortie = "";
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const suite = source[i + 1];
    if (c === "/" && suite === "*") {
      const fin = source.indexOf("*/", i + 2);
      i = fin === -1 ? source.length : fin + 2;
      sortie += " ";
    } else if (c === "/" && suite === "/") {
      while (i < source.length && source[i] !== "\n") i++;
    } else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < source.length && source[j] !== c) j += source[j] === "\\" ? 2 : 1;
      sortie += source.slice(i, j + 1);
      i = j + 1;
    } else {
      sortie += c;
      i++;
    }
  }
  return sortie;
}

/** Spécificateurs : `from "…"`, `import "…"`, `import("…")`, `require("…")`, `export … from "…"`. */
function specificateurs(source: string): string[] {
  const texte = sansCommentaires(source);
  const motifs = [
    /\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  const trouves = new Set<string>();
  for (const motif of motifs) for (const m of texte.matchAll(motif)) trouves.add(m[1]);
  return [...trouves];
}

const CHEMINS_EXACTS_INTERDITS = [
  "src/services/credits.ts",
  "src/services/budget-mensuel.ts",
  "src/services/mode-budget.ts",
  "src/services/autonomie-usine.ts",
  "src/services/couts.ts",
  "src/services/cle-depense-usine.ts",
  "src/services/generation-claude.ts",
  "src/services/image-video.ts",
  "src/services/publications.ts",
  "src/services/reglages.ts",
  "src/services/travaux.ts",
  "src/services/facecam-animee.ts",
  "src/services/illustrations.ts",
  "src/domaine/credits.ts",
];

/** Chemin de dépôt sans extension ni `/index`, ou null pour un module nu (paquet). */
function chemin(specificateur: string, depuis: string): string | null {
  let base: string;
  if (specificateur.startsWith("@/")) base = `src/${specificateur.slice(2)}`;
  else if (specificateur.startsWith(".")) base = normalize(join(dirname(depuis), specificateur)).split("\\").join("/");
  else return null;
  return base;
}

function candidats(base: string): string[] {
  const nu = base.replace(/\.(ts|tsx)$/, "");
  return [base, `${nu}.ts`, `${nu}.tsx`, `${nu}/index.ts`];
}

/** Retourne la raison du refus, ou null si l'import est permis. */
function refus(specificateur: string, depuis: string): string | null {
  if (specificateur === "@anthropic-ai/sdk" || specificateur.startsWith("@anthropic-ai/")) return specificateur;
  const base = chemin(specificateur, depuis);
  if (base === null) return null;
  const nu = base.replace(/\.(ts|tsx)$/, "");
  const complets = candidats(base);
  for (const exact of CHEMINS_EXACTS_INTERDITS) if (complets.includes(exact)) return exact;
  if (nu.startsWith("src/services/depense-claude-")) return nu;
  if (/^src\/services\/image-video[-.]/.test(base) || /^src\/services\/image-video-/.test(nu)) return nu;
  if (nu.startsWith("src/fournisseurs/") || nu === "src/fournisseurs") return nu;
  return null;
}

const SERVICES = ["src/services/bibliotheque-video.ts", "src/services/bibliotheque-video-memoires.ts"];

function fichiersBrique(): string[] {
  return lister("src/briques/bibliotheque-video");
}

function fichiersExistants(chemins: string[]): string[] {
  return chemins.filter((c) => existsSync(join(RACINE, c)));
}

describe("C1-U11 · garde 1 : le rendu n'importe pas la brique", () => {
  const fichiers = lister("studio-rendu");
  it("trouve des fichiers sous studio-rendu/ (garde vide = garde fausse)", () => {
    expect(fichiers.length).toBeGreaterThan(0);
  });
  it("aucun spécificateur ne finit par bibliotheque-video ni ne contient bibliotheque-video/", () => {
    const fautifs: string[] = [];
    for (const f of fichiers) {
      for (const s of specificateurs(lire(f))) {
        if (s.endsWith("bibliotheque-video") || s.includes("bibliotheque-video/")) fautifs.push(`${f} → ${s}`);
      }
    }
    expect(fautifs).toEqual([]);
  });
});

describe("C1-U11 · garde 2 : la brique est côté Studio", () => {
  const fichiers = fichiersBrique();
  it("trouve des fichiers dans la brique", () => {
    expect(fichiers.length).toBeGreaterThan(0);
  });
  it("aucun import de studio-rendu, server-only ni react", () => {
    const fautifs: string[] = [];
    for (const f of fichiers) {
      for (const s of specificateurs(lire(f))) {
        if (s.includes("studio-rendu") || s === "server-only" || s === "react" || s.startsWith("react/") || s.startsWith("react-dom")) {
          fautifs.push(`${f} → ${s}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });
});

describe("C1-U11 · garde 3 : ni argent ni fournisseur (chemins exacts)", () => {
  it("la résolution accepte les moteurs permis et refuse les fichiers d'argent (A1-1)", () => {
    const depuis = "src/briques/bibliotheque-video/moteur.ts";
    expect(refus("@/moteurs/montage-image-video/fabrication", depuis)).toBeNull();
    expect(refus("@/briques/bibliotheque-video/memoire", depuis)).toBeNull();
    expect(refus("@/services/image-video", depuis)).not.toBeNull();
    expect(refus("@/services/image-video-rendu", depuis)).not.toBeNull();
    expect(refus("@/services/credits", depuis)).not.toBeNull();
    expect(refus("@/fournisseurs/x", depuis)).not.toBeNull();
    expect(refus("@anthropic-ai/sdk", depuis)).not.toBeNull();
    expect(refus("../../services/credits", depuis)).not.toBeNull();
    expect(refus("./image-video", depuis)).toBeNull();
  });

  const cibles = [...fichiersBrique(), ...fichiersExistants(SERVICES)];
  it("cible la brique et les deux services", () => {
    expect(fichiersBrique().length).toBeGreaterThan(0);
    expect(fichiersExistants(SERVICES).length).toBeGreaterThan(0);
  });
  it("aucun import ne résout vers un chemin d'argent ou de fournisseur", () => {
    const fautifs: string[] = [];
    for (const f of cibles) {
      for (const s of specificateurs(lire(f))) {
        const raison = refus(s, f);
        if (raison !== null) fautifs.push(`${f} → ${s} (${raison})`);
      }
    }
    expect(fautifs).toEqual([]);
  });
});

describe("C1-U11 · garde 4 : rien n'écrit", () => {
  it("les services existent", () => {
    expect(fichiersExistants(SERVICES)).toEqual(SERVICES);
  });
  it("bibliotheque-video-memoires.ts : ni ecrireParametre, ni .creer(, .modifier(, .supprimer(", () => {
    const texte = sansCommentaires(lire("src/services/bibliotheque-video-memoires.ts"));
    for (const interdit of ["ecrireParametre", ".creer(", ".modifier(", ".supprimer("]) {
      expect(texte.includes(interdit), interdit).toBe(false);
    }
  });
  it("bibliotheque-video.ts : pas d'ecrireParametre", () => {
    expect(sansCommentaires(lire("src/services/bibliotheque-video.ts")).includes("ecrireParametre")).toBe(false);
  });
});
