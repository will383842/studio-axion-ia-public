// RES-8 : les 7 maquettes de démo entrent dans l'image de production (et rien d'autre de outils/).
// Simule la sémantique de Dockerfile.dockerignore : règles dans l'ordre, la dernière qui correspond l'emporte,
// une règle correspond au chemin ou à l'un de ses dossiers parents ; « ! » ré-inclut.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const IGNORE = readFileSync(join(RACINE, "Dockerfile.dockerignore"), "utf8");
const DOCKERFILE = readFileSync(join(RACINE, "Dockerfile"), "utf8");
const BASE = "outils/maquettes-tableaux-de-bord";

const regles = IGNORE.split("\n")
  .map((l) => l.trim())
  .filter((l) => l !== "" && !l.startsWith("#"));

function versRegex(motif: string): RegExp {
  let r = "";
  for (let i = 0; i < motif.length; i++) {
    const c = motif[i]!;
    if (c === "*" && motif[i + 1] === "*") {
      r += ".*";
      i++;
      if (motif[i + 1] === "/") i++;
    } else if (c === "*") r += "[^/]*";
    else if (c === "?") r += "[^/]";
    else if (c === "[") {
      const fin = motif.indexOf("]", i);
      r += motif.slice(i, fin + 1);
      i = fin;
    } else r += c.replace(/[.+^${}()|\\]/g, "\\$&");
  }
  return new RegExp(`^${r}$`);
}

/** Vrai si le fichier est exclu du contexte de construction. */
function exclu(chemin: string): boolean {
  const parts = chemin.split("/");
  const prefixes = parts.map((_, i) => parts.slice(0, i + 1).join("/"));
  let out = false;
  for (const regle of regles) {
    const negation = regle.startsWith("!");
    const motif = (negation ? regle.slice(1) : regle).replace(/\/$/, "");
    const re = versRegex(motif);
    // un motif sans « / » vaut pour la racine seulement (comme Docker) ; « **/ » est écrit en toutes lettres
    if (prefixes.some((p) => re.test(p))) out = !negation;
  }
  return out;
}

describe("RES-8 : Dockerfile.dockerignore", () => {
  it("garde les exclusions existantes", () => {
    for (const f of ["tests/x.test.ts", "studio-rendu/package.json", "docs/a.md", "outils/autre/x.ts", "outils/repetition-controles.mjs", "node_modules/a/b.js"]) {
      expect(exclu(f), f).toBe(true);
    }
    expect(regles).toContain("tests");
    expect(regles).toContain("studio-rendu");
    expect(regles).toContain("docs");
  });

  it("n'exclut plus `outils` en bloc, mais `outils/*`", () => {
    expect(regles).not.toContain("outils");
    expect(regles).toContain("outils/*");
  });

  it("déclare les exceptions des maquettes", () => {
    expect(regles).toContain(`!${BASE}`);
    expect(regles).toContain(`!${BASE}/0[1-7]-*`);
    expect(regles).toContain(`!${BASE}/charte/charte.css`);
  });

  it("inclut les 7 dossiers de maquettes et la charte.css", () => {
    for (const d of ["01-courriels", "02-projets", "03-accueil-24h", "04-clients", "05-stocks", "06-equipe", "07-taches"]) {
      expect(exclu(`${BASE}/${d}/index.html`), d).toBe(false);
      expect(exclu(`${BASE}/${d}/sous/fichier.png`), d).toBe(false);
    }
    expect(exclu(`${BASE}/charte/charte.css`)).toBe(false);
  });

  it("n'inclut ni capture/, poste/, constructeur/, essai-reel/, ni le reste de charte/", () => {
    for (const f of [
      "capture/a.ts", "poste/a.ts", "constructeur/a.ts", "essai-reel/a.ts", "controle/a.ts", "ecrans-outils/a.html",
      "LISEZMOI.md", "08-autre/a.html", "00-x/a.html", "charte/controle.ts", "charte/noms-neutres.json",
    ]) {
      expect(exclu(`${BASE}/${f}`), f).toBe(true);
    }
  });
});

describe("RES-8 : Dockerfile", () => {
  it("copie la police Manrope vers la charte des maquettes, après la copie d'outils", () => {
    const police = "COPY --from=build --chown=studio:studio /app/src/app/polices/manrope-latin.woff2 ./outils/maquettes-tableaux-de-bord/charte/manrope-latin.woff2";
    expect(DOCKERFILE).toContain(police);
    expect(DOCKERFILE.indexOf(police)).toBeGreaterThan(DOCKERFILE.indexOf("COPY --from=build --chown=studio:studio /app/outils ./outils"));
  });
});
