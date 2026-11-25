import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { texteCanonique, versionDerivee, type Empreintes } from "./version-derivee";

/**
 * Garde de version des compositions (G13-04, refaite par VC-EMPREINTES-a) : tout changement, ajout ou retrait
 * d'un fichier de `studio-rendu/compositions/**` doit se voir dans `version-compositions.json`.
 *
 * Le JSON porte UNE clé, `empreintes` : une ligne PAR FICHIER suivi (chemin relatif à `studio-rendu/compositions/`,
 * un fichier de la racine a pour clé son nom seul) → SHA-256 de son contenu. Plus de compteur `version` ni de
 * `precedent` : la « version » des compositions est DÉRIVÉE des empreintes (`versionDerivee`, `./version-derivee.ts`),
 * elle change forcément dès qu'un fichier change. Deux fiches qui changent des fichiers différents n'écrivent donc
 * plus la même ligne. Le test ne lit pas l'historique git.
 *
 * Mise à jour par l'auteur d'une PR qui touche les compositions : lancer
 * `ECRIRE_EMPREINTES=1 npx vitest run tests/segments-rendu/version-compositions.test.ts`, qui ÉCRIT le JSON
 * (texte canonique : seules les lignes des fichiers changés, ajoutés ou retirés bougent ; jamais à la main),
 * puis annoncer le changement de studio-rendu au journal (règle 13) avec la version dérivée.
 * En cas de conflit sur le JSON au rebase : ne pas le résoudre à la main, relancer la commande.
 *
 * `compositions/visuels/` (carrousels, zone d'une autre session) est EXCLU du calcul, ainsi que tout `node_modules/`.
 * Aucun fichier de `studio-rendu/compositions/**` n'est importé : lecture de texte seule (piège tsc/remotion).
 */

const RACINE = resolve(__dirname, "..", "..");
const BASE = ["studio-rendu", "compositions"].join("/");
const EXCLUS = new Set(["visuels", "node_modules"]);
const EXTENSIONS_TEXTE = /\.(tsx?|jsx?|mjs|cjs|json|css|md|txt|svg|html)$/i;
const FICHIER_JSON = join(__dirname, "version-compositions.json");
const COMMANDE = "ECRIRE_EMPREINTES=1 npx vitest run tests/segments-rendu/version-compositions.test.ts";

type Registre = { empreintes: Empreintes } & Record<string, unknown>;

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

/** Chemins relatifs à `studio-rendu/compositions/` retenus : hors `visuels/` (1er segment) et hors tout `node_modules/`. */
function cheminsRetenus(): string[] {
  return fichiersSuivis()
    .map((f) => f.slice(BASE.length + 1))
    .filter((rel) => {
      const segments = rel.split("/");
      return !EXCLUS.has(segments[0]) && !segments.includes("node_modules");
    });
}

/** Empreinte PAR FICHIER, fins de ligne normalisées pour le texte seulement. */
function empreintesCalculees(): Empreintes {
  const res: Empreintes = {};
  for (const rel of cheminsRetenus().sort()) {
    const f = `${BASE}/${rel}`;
    // Octets bruts (pas de perte sur les binaires : polices, images) ; fins de ligne normalisées pour le texte seulement.
    const brut = readFileSync(join(RACINE, f));
    const contenu = EXTENSIONS_TEXTE.test(f) ? Buffer.from(brut.toString("utf8").replace(/\r\n/g, "\n"), "utf8") : brut;
    res[rel] = createHash("sha256").update(contenu).digest("hex");
  }
  return res;
}

/** Messages d'erreur ; vide si tout est cohérent. Fonction pure (testée avec des empreintes factices). */
export function verifier(calcule: Empreintes, json: Registre): string[] {
  const erreurs: string[] = [];
  for (const cle of Object.keys(json).sort()) {
    if (cle !== "empreintes") {
      erreurs.push(`clé « ${cle} » refusée dans tests/segments-rendu/version-compositions.json (seule « empreintes » existe ; régénérer : \`${COMMANDE}\`)`);
    }
  }
  const enregistrees: Empreintes = json.empreintes ?? {};
  const cles = new Set([...Object.keys(calcule), ...Object.keys(enregistrees)]);
  for (const cle of [...cles].sort()) {
    if (calcule[cle] !== enregistrees[cle]) {
      erreurs.push(
        `studio-rendu/compositions/${cle} a changé (ou ajouté / retiré) : régénérer tests/segments-rendu/version-compositions.json (\`${COMMANDE}\`) et annoncer le changement de studio-rendu au journal (règle 13)`,
      );
    }
  }
  return erreurs;
}

const lireTexte = () => readFileSync(FICHIER_JSON, "utf8");
const lireJson = () => JSON.parse(lireTexte()) as Registre;

describe("garde de version des compositions (G13-04)", () => {
  it("les empreintes du JSON correspondent aux fichiers actuels (une ligne par fichier)", () => {
    const calcule = empreintesCalculees();
    if (process.env.ECRIRE_EMPREINTES === "1") {
      writeFileSync(FICHIER_JSON, texteCanonique(calcule));
      console.log(`version-compositions.json réécrit : ${Object.keys(calcule).length} fichiers, version dérivée ${versionDerivee(calcule)}`);
    }
    expect(verifier(calcule, lireJson())).toEqual([]);
  });

  it("texte canonique : le fichier est exactement celui que la commande écrit (ordre, retraits, fin de ligne)", () => {
    const json = lireJson();
    expect(Object.keys(json)).toEqual(["empreintes"]);
    expect(lireTexte()).toBe(texteCanonique(json.empreintes));
  });

  it("n'inclut pas visuels/ ni node_modules/, couvre la racine et les dossiers, un fichier = une clé", () => {
    const calcule = empreintesCalculees();
    const cles = Object.keys(calcule);
    for (const c of cles) {
      expect(c.startsWith("visuels/")).toBe(false);
      expect(c.includes("node_modules/")).toBe(false);
    }
    expect(cles).toContain("Racine.tsx");
    expect(cles.some((c) => c.startsWith("cas-concret/"))).toBe(true);
    for (const v of Object.values(calcule)) expect(v).toMatch(/^[0-9a-f]{64}$/);
    // Nombre calculé (pas figé) : un fichier suivi hors exclus = une clé.
    expect(cles).toHaveLength(new Set(cheminsRetenus()).size);
    expect(Object.keys(lireJson().empreintes)).toHaveLength(cles.length);
  });

  const base: Registre = { empreintes: { "Racine.tsx": "aaa", "tableau/Tableau.tsx": "bbb" } };

  it("preuve : un fichier factice modifié est refusé avec SON chemin dans le message", () => {
    const erreurs = verifier({ "Racine.tsx": "aaa", "tableau/Tableau.tsx": "CHANGE" }, base);
    expect(erreurs).toHaveLength(1);
    expect(erreurs[0]).toContain("studio-rendu/compositions/tableau/Tableau.tsx a changé");
    expect(erreurs[0]).toContain(COMMANDE);
    expect(erreurs[0]).toContain("règle 13");
  });

  it("preuve : avec le JSON mis à jour (même table), la même modification est acceptée", () => {
    const calcule = { "Racine.tsx": "aaa", "tableau/Tableau.tsx": "CHANGE" };
    expect(verifier(calcule, { empreintes: { ...calcule } })).toEqual([]);
  });

  it("version dérivée : change avec une empreinte, un ajout ou un retrait ; identique quel que soit l'ordre ; ancien format refusé", () => {
    const v = versionDerivee(base.empreintes);
    expect(v).toMatch(/^v-[0-9a-f]{12}$/);
    expect(versionDerivee({ "Racine.tsx": "aaa", "tableau/Tableau.tsx": "CHANGE" })).not.toBe(v);
    expect(versionDerivee({ ...base.empreintes, "tableau/Neuf.tsx": "ccc" })).not.toBe(v);
    expect(versionDerivee({ "Racine.tsx": "aaa" })).not.toBe(v);
    expect(versionDerivee({ "tableau/Tableau.tsx": "bbb", "Racine.tsx": "aaa" })).toBe(v);
    expect(texteCanonique({ "tableau/Tableau.tsx": "bbb", "Racine.tsx": "aaa" })).toBe(texteCanonique(base.empreintes));
    const avecVersion = { ...base, version: 14 } as Registre;
    expect(verifier(base.empreintes, avecVersion).join()).toContain("clé « version » refusée");
    const avecPrecedent = { ...base, precedent: { version: 13, empreintes: {} } } as Registre;
    expect(verifier(base.empreintes, avecPrecedent).join()).toContain("clé « precedent » refusée");
  });

  it("un fichier ajouté ou retiré sans régénération du JSON est refusé", () => {
    const ajoute = verifier({ ...base.empreintes, "tableau/Neuf.tsx": "ccc" }, base);
    expect(ajoute).toHaveLength(1);
    expect(ajoute[0]).toContain("tableau/Neuf.tsx");
    const retire = verifier({ "Racine.tsx": "aaa" }, base);
    expect(retire).toHaveLength(1);
    expect(retire[0]).toContain("tableau/Tableau.tsx");
  });

  it("l'outil des images de référence lit la version dérivée, plus le champ version du registre", () => {
    const outil = readFileSync(join(RACINE, "outils", "images-reference", "rendre-et-comparer.mts"), "utf8");
    expect(outil).toContain("versionDerivee(");
    const lignesRegistre = outil.split("\n").filter((l) => l.includes("version-compositions.json"));
    expect(lignesRegistre.length).toBeGreaterThan(0);
    for (const l of lignesRegistre) expect(l).not.toMatch(/\)\.version\b/);
  });
});
