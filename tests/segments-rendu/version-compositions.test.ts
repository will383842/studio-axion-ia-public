import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Garde de version des compositions (G13-04) : un changement de `studio-rendu/compositions/**`
 * exige une version de rendu en hausse dans `version-compositions.json`.
 *
 * Le JSON porte : `version`, `empreintes` (état courant) et `precedent` { version, empreintes }
 * (état de la version d'avant). Si une empreinte courante diffère de la précédente, `version`
 * doit valoir précédente + 1 au moins. Le test ne lit pas l'historique git.
 *
 * Mise à jour par l'auteur d'une PR qui touche les compositions : recopier `empreintes` et `version`
 * dans `precedent`, recalculer `empreintes` (`ECRIRE_EMPREINTES=1 npx vitest run <ce fichier>` les affiche),
 * `version` + 1, et annoncer le changement de studio-rendu au journal (règle 13).
 *
 * `compositions/visuels/` (carrousels, zone d'une autre session) est EXCLU du calcul.
 * Aucun fichier de `studio-rendu/compositions/**` n'est importé : lecture de texte seule (piège tsc/remotion).
 */

const RACINE = resolve(__dirname, "..", "..");
const BASE = ["studio-rendu", "compositions"].join("/");
const EXCLUS = new Set(["visuels", "node_modules"]);
const RACINE_FICHIERS = "(racine)";

type Table = Record<string, string>;
type Registre = { version: number; empreintes: Table; precedent: { version: number; empreintes: Table } };

function fichiersSuivis(): string[] {
  try {
    const sortie = execFileSync("git", ["ls-files", "-z", "--", BASE], { cwd: RACINE, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const liste = sortie.split("\0").filter(Boolean);
    if (liste.length > 0) return liste;
  } catch {
    /* pas de git : parcours du disque */
  }
  const sortie: string[] = [];
  const parcourir = (rel: string) => {
    for (const nom of readdirSync(join(RACINE, rel))) {
      if (nom === "node_modules") continue;
      const chemin = `${rel}/${nom}`;
      if (statSync(join(RACINE, chemin)).isDirectory()) parcourir(chemin);
      else sortie.push(chemin);
    }
  };
  parcourir(BASE);
  return sortie;
}

/** Empreinte par dossier de premier niveau (+ fichiers de la racine), fins de ligne normalisées. */
function empreintesCalculees(): Table {
  const groupes = new Map<string, string[]>();
  for (const f of fichiersSuivis()) {
    const reste = f.slice(BASE.length + 1).split("/");
    const cle = reste.length === 1 ? RACINE_FICHIERS : reste[0];
    if (EXCLUS.has(cle)) continue;
    groupes.set(cle, [...(groupes.get(cle) ?? []), f]);
  }
  const res: Table = {};
  for (const cle of [...groupes.keys()].sort()) {
    const h = createHash("sha256");
    for (const f of groupes.get(cle)!.sort()) {
      const texte = readFileSync(join(RACINE, f), "utf8").replace(/\r\n/g, "\n");
      h.update(`${f}\n${texte}\n--\n`);
    }
    res[cle] = h.digest("hex");
  }
  return res;
}

/** Messages d'erreur ; vide si tout est cohérent. Fonction pure (testée avec des empreintes factices). */
export function verifier(calcule: Table, json: Registre): string[] {
  const erreurs: string[] = [];
  const cles = new Set([...Object.keys(calcule), ...Object.keys(json.empreintes)]);
  for (const cle of [...cles].sort()) {
    if (calcule[cle] !== json.empreintes[cle]) {
      erreurs.push(
        `studio-rendu/compositions/${cle} a changé : mettre à jour tests/segments-rendu/version-compositions.json (empreinte + version + 1) et annoncer le changement de studio-rendu au journal (règle 13)`,
      );
    }
  }
  if (erreurs.length === 0) {
    const changees = [...new Set([...Object.keys(json.empreintes), ...Object.keys(json.precedent.empreintes)])].filter(
      (c) => json.empreintes[c] !== json.precedent.empreintes[c],
    );
    if (changees.length > 0 && json.version < json.precedent.version + 1) {
      erreurs.push(
        `empreinte neuve (${changees.join(", ")}) sans hausse de version : version doit être au moins ${json.precedent.version + 1}`,
      );
    }
  }
  return erreurs;
}

const json = JSON.parse(readFileSync(join(__dirname, "version-compositions.json"), "utf8")) as Registre;

describe("garde de version des compositions (G13-04)", () => {
  it("les empreintes du JSON correspondent aux fichiers actuels et la version est cohérente", () => {
    const calcule = empreintesCalculees();
    if (process.env.ECRIRE_EMPREINTES === "1") console.log(JSON.stringify(calcule, null, 2));
    expect(verifier(calcule, json)).toEqual([]);
  });

  it("n'inclut pas visuels/ et couvre les dossiers de premier niveau et la racine", () => {
    const calcule = empreintesCalculees();
    expect(Object.keys(calcule)).not.toContain("visuels");
    expect(Object.keys(calcule)).toContain(RACINE_FICHIERS);
    expect(Object.keys(calcule)).toContain("cas-concret");
    for (const v of Object.values(calcule)) expect(v).toMatch(/^[0-9a-f]{64}$/);
  });

  const base: Registre = {
    version: 3,
    empreintes: { avocat: "aaa", tableau: "bbb" },
    precedent: { version: 3, empreintes: { avocat: "aaa", tableau: "bbb" } },
  };

  it("preuve : une empreinte factice modifiée sans hausse de version est refusée", () => {
    const erreurs = verifier({ avocat: "aaa", tableau: "CHANGE" }, base);
    expect(erreurs).toHaveLength(1);
    expect(erreurs[0]).toContain("studio-rendu/compositions/tableau a changé");
    expect(erreurs[0]).toContain("règle 13");
    const sansHausse: Registre = { ...base, empreintes: { avocat: "aaa", tableau: "CHANGE" } };
    expect(verifier({ avocat: "aaa", tableau: "CHANGE" }, sansHausse).join()).toContain("sans hausse de version");
  });

  it("preuve : avec hausse de version, la même modification est acceptée", () => {
    const avecHausse: Registre = { ...base, version: 4, empreintes: { avocat: "aaa", tableau: "CHANGE" } };
    expect(verifier({ avocat: "aaa", tableau: "CHANGE" }, avecHausse)).toEqual([]);
  });

  it("un dossier ajouté ou retiré sans mise à jour du JSON est refusé", () => {
    expect(verifier({ avocat: "aaa", tableau: "bbb", neuf: "ccc" }, base)).toHaveLength(1);
    expect(verifier({ avocat: "aaa" }, base)).toHaveLength(1);
  });
});
