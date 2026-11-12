// [L0-17] Garde de zone et de fichiers autorisés : rouge sur chaque défaut, vert sur une PR conforme.
// Données fictives seulement. Aucun appel réel (ni réseau, ni git, ni modèle).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  classer, controler, motifVersRegex, extraireAutorises, annonceLibre, INTERDITS, PARTAGES,
} from "../../outils/gardes/zone-interdite.mjs";

type Defaut = { regle: string; fichier?: string };
const regles = (r: { defauts: Defaut[] }) => r.defauts.map((d) => d.regle);

describe("motifs récursifs", () => {
  it("convertit ** et * comme attendu", () => {
    expect(motifVersRegex("a/**/b*").test("a/x/y/bz")).toBe(true);
    expect(motifVersRegex("a/**/b*").test("a/bz")).toBe(true);
    expect(motifVersRegex("a/*/b").test("a/x/y/b")).toBe(false);
    expect(motifVersRegex("**/p.ts").test("p.ts")).toBe(true);
    expect(motifVersRegex("src/app/(studio)/mots/**").test("src/app/(studio)/mots/page.tsx")).toBe(true);
  });
  it("deux listes séparées", () => {
    expect(INTERDITS.length).toBe(9);
    expect(PARTAGES.length).toBeGreaterThan(0);
    for (const p of PARTAGES) expect(INTERDITS).not.toContain(p);
  });
});

describe("zone interdite : rouge", () => {
  const rouges = [
    "src/fournisseurs/publication/zernio-client.ts",
    "src/fournisseurs/mesures/zernio.ts",
    "src/fournisseurs/zernio-inbox.ts",
    "src/fournisseurs/publication/zernio.ts",
    "src/services/parcours-mot.ts",
    "src/services/mots-gestes.ts",
    "src/domaine/guide-reseau/affectations.ts",
    "src/domaine/guide-reseau/profond/x/y.ts",
    "src/components/mots/EcranMots.tsx",
    "src/app/(studio)/mots/page.tsx",
    "tests/zernio/essai.test.ts",
    "tests/zernio/sous/dossier/essai.test.ts",
    "docs/zernio/LISEZMOI.md",
    "src/services/parcours-conversation.ts",
    "src/autre/dossier/parcours-conversation.ts",
  ];
  for (const f of rouges) {
    it(`${f} est interdit`, () => {
      expect(classer(f)).toBe("interdit");
      const r = controler({ fichiers: [f] });
      expect(r.ok).toBe(false);
      expect(regles(r)).toContain("zone-interdite");
    });
  }
  it("aucune annonce ni fiche ne lève l'interdit", () => {
    const f = "src/services/parcours-mot.ts";
    const r = controler({ fichiers: [f], autorises: [f], fiche: "X-1", annonces: [{ nom: "ANNONCE-X-1-2026-01-01.md", contenu: "libre" }] });
    expect(r.ok).toBe(false);
  });
  it("normalise les séparateurs et le préfixe ./", () => {
    expect(classer(".\\src\\services\\parcours-mot.ts")).toBe("interdit");
    expect(classer("./tests/zernio/a.ts")).toBe("interdit");
  });
});

describe("exception par accord (zernio-client.ts, zernio.ts)", () => {
  const f = "src/fournisseurs/publication/zernio-client.ts";
  it("rouge sans accord", () => {
    expect(controler({ fichiers: [f], autorises: [f], fiche: "X-1" }).ok).toBe(false);
  });
  it("vert avec l'accord RC-40 ET le fichier dans les fichiers autorisés de la fiche", () => {
    expect(controler({ fichiers: [f], autorises: [`${f} (modifié)`], fiche: "X-1", accords: ["RC-40"] }).ok).toBe(true);
  });
  it("rouge si l'accord est là mais que la fiche n'autorise pas ce fichier", () => {
    const r = controler({ fichiers: [f], autorises: ["src/autre.ts"], fiche: "X-1", accords: ["RC-40"] });
    expect(r.ok).toBe(false);
  });
  it("rouge pour un autre accord", () => {
    expect(controler({ fichiers: [f], autorises: [f], fiche: "X-1", accords: ["RC-41"] }).ok).toBe(false);
  });
  it("l'accord ne couvre ni zernio-inbox ni le reste de la zone", () => {
    for (const g of ["src/fournisseurs/zernio-inbox.ts", "src/services/parcours-mot.ts", "src/fournisseurs/mesures/zernio.ts_"]) {
      expect(controler({ fichiers: [g], autorises: [g], fiche: "X-1", accords: ["RC-40"] }).ok).toBe(false);
    }
  });
  it("accord couvrant mesures/zernio.ts", () => {
    const g = "src/fournisseurs/mesures/zernio.ts";
    expect(controler({ fichiers: [g], autorises: [g], fiche: "X-1", accords: ["RC-40"] }).ok).toBe(true);
  });
});

describe("zone partagée", () => {
  const f = "src/components/ui/Bouton.tsx";
  it("classée partagée", () => {
    expect(classer(f)).toBe("partage");
    expect(classer("src/libelles.ts")).toBe("partage");
    expect(classer("src/app/globals.css")).toBe("partage");
  });
  it("rouge sans annonce", () => {
    expect(regles(controler({ fichiers: [f], autorises: [f], fiche: "X-1" }))).toContain("zone-partagee");
  });
  it("rouge si l'annonce ne dit pas « libre »", () => {
    const r = controler({ fichiers: [f], autorises: [f], fiche: "X-1", annonces: [{ nom: "ANNONCE-X-1-2026-11-12.md", contenu: "Fichiers visés. Pas libre." }] });
    expect(r.ok).toBe(false);
  });
  it("rouge si l'annonce est d'une autre fiche", () => {
    const r = controler({ fichiers: [f], autorises: [f], fiche: "X-1", annonces: [{ nom: "ANNONCE-X-10-2026-11-12.md", contenu: "libre" }] });
    expect(r.ok).toBe(false);
  });
  it("vert avec ANNONCE-<fiche>-*.md contenant « libre »", () => {
    const r = controler({ fichiers: [f], autorises: [f], fiche: "X-1", annonces: [{ nom: "ANNONCE-X-1-2026-11-12.md", contenu: "Réponse : libre." }] });
    expect(r.ok).toBe(true);
  });
  it("annonceLibre", () => {
    expect(annonceLibre([{ nom: "ANNONCE-A-1-d.md", contenu: "LIBRE" }], "A-1")).toBe(true);
    expect(annonceLibre([{ nom: "ANNONCE-A-1-d.md", contenu: "non libre" }], "A-1")).toBe(false);
    expect(annonceLibre([{ nom: "NOTE-A-1-d.md", contenu: "libre" }], "A-1")).toBe(false);
    expect(annonceLibre([], "A-1")).toBe(false);
  });
});

describe("fichiers autorisés de la fiche", () => {
  it("rouge pour un fichier hors liste", () => {
    const r = controler({ fichiers: ["src/a.ts", "src/b.ts"], autorises: ["src/a.ts (nouveau)"], fiche: "X-1" });
    expect(r.ok).toBe(false);
    expect(r.defauts).toContainEqual(expect.objectContaining({ regle: "hors-fiche", fichier: "src/b.ts" }));
  });
  it("vert pour une PR conforme (journal permis)", () => {
    const r = controler({ fichiers: ["src/a.ts", "tests/a.test.ts", "pilotage/journal/X-1.md"], autorises: ["src/a.ts (nouveau)", "tests/a.test.ts"], fiche: "X-1" });
    expect(r).toMatchObject({ ok: true, defauts: [] });
  });
  it("le journal d'une autre fiche n'est pas permis", () => {
    expect(controler({ fichiers: ["pilotage/journal/X-2.md"], autorises: ["src/a.ts"], fiche: "X-1" }).ok).toBe(false);
  });
  it("refuse un joker dans la liste (relecture v1-u3, constat 2)", () => {
    const r = controler({ fichiers: ["src/d/x/y.ts"], autorises: ["src/d/**"], fiche: "X-1" });
    expect(regles(r)).toContain("joker-refuse");
    expect(regles(controler({ fichiers: ["src/n-importe.ts"], autorises: ["**"], fiche: "L9-99" }))).toContain("joker-refuse");
  });
  it("rouge si la fiche est connue mais sa liste introuvable", () => {
    expect(regles(controler({ fichiers: ["src/a.ts"], fiche: "X-1" }))).toContain("liste-introuvable");
  });
  it("sans fiche identifiée : rouge « sans-fiche » (relecture v1-u3, constat 4)", () => {
    expect(regles(controler({ fichiers: ["src/a.ts"] }))).toContain("sans-fiche");
  });
  it("sans fiche : exception limitée à pilotage/autorises/** et pilotage/annonces/**", () => {
    expect(controler({ fichiers: ["pilotage/autorises/X-1.json", "pilotage/annonces/ANNONCE-X-1-a.md"] }).ok).toBe(true);
    expect(regles(controler({ fichiers: ["pilotage/autorises/X-1.json", "src/a.ts"] }))).toEqual(["sans-fiche"]);
    expect(regles(controler({ fichiers: ["pilotage/autorises/../../src/a.ts"] }))).toContain("sans-fiche");
  });
  it("sans fiche : la zone interdite reste rouge en plus", () => {
    expect(regles(controler({ fichiers: ["tests/zernio/a.test.ts"] }))).toEqual(expect.arrayContaining(["zone-interdite", "sans-fiche"]));
  });
  it("aucun fichier changé : vert", () => {
    expect(controler({ fichiers: [] }).ok).toBe(true);
  });
  it("extraireAutorises lit l'en-tête d'une fiche", () => {
    const md = '---\nid: X-1\nfichiers_autorises: ["src/a.ts (nouveau)", "tests/a.test.ts"]\nci: publique\n---\ncorps';
    expect(extraireAutorises(md)).toEqual(["src/a.ts (nouveau)", "tests/a.test.ts"]);
    expect(extraireAutorises("rien")).toBeNull();
  });
});

describe("ligne de commande (dépôt git temporaire fictif)", () => {
  const script = path.resolve(__dirname, "../../outils/gardes/zone-interdite.mjs");
  const git = (cwd: string, ...a: string[]) => execFileSync("git", ["-c", "user.email=a@exemple.fr", "-c", "user.name=t", ...a], { cwd, stdio: "pipe" });
  const lancer = (cwd: string, args: string[]) => {
    try {
      const out = execFileSync("node", [script, ...args], { cwd, stdio: "pipe" }).toString();
      return { code: 0, out };
    } catch (e) {
      const x = e as { status: number; stdout: Buffer; stderr: Buffer };
      return { code: x.status, out: x.stdout.toString() + x.stderr.toString() };
    }
  };
  function depot(fichiers: Record<string, string>) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "zone-"));
    git(d, "init", "-q", "-b", "master");
    fs.writeFileSync(path.join(d, "base.txt"), "x");
    git(d, "add", "."); git(d, "commit", "-qm", "base");
    git(d, "checkout", "-qb", "usine/X-1");
    for (const [n, c] of Object.entries(fichiers)) {
      fs.mkdirSync(path.dirname(path.join(d, n)), { recursive: true });
      fs.writeFileSync(path.join(d, n), c);
    }
    git(d, "add", "."); git(d, "commit", "-qm", "pr");
    return d;
  }
  const fiche = (liste: string[]) => `---\nid: X-1\nfichiers_autorises: ${JSON.stringify(liste)}\n---\n`;

  it("sort 0 sur une PR conforme", () => {
    const d = depot({ "src/a.ts": "1", "pilotage/fiches/X-1.md": fiche(["src/a.ts", "pilotage/fiches/X-1.md"]) });
    const r = lancer(d, ["--base", "master", "--branche", "usine/X-1"]);
    expect(r.code, r.out).toBe(0);
  });
  it("sort 1 et nomme le fichier de la zone de l'autre PC", () => {
    const d = depot({ "src/fournisseurs/zernio-inbox.ts": "1" });
    const r = lancer(d, ["--base", "master"]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("src/fournisseurs/zernio-inbox.ts");
  });
  it("sort 1 pour un fichier hors fiche", () => {
    const d = depot({ "src/a.ts": "1", "src/b.ts": "1", "pilotage/fiches/X-1.md": fiche(["src/a.ts", "pilotage/fiches/X-1.md"]) });
    const r = lancer(d, ["--base", "master", "--branche", "usine/X-1"]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("src/b.ts");
  });
  it("sort 1 si la branche est d'une fiche sans liste", () => {
    const d = depot({ "src/a.ts": "1" });
    expect(lancer(d, ["--base", "master", "--branche", "usine/X-1"]).code).toBe(1);
  });
  it("liste de fichiers fournie, annonce et accord par options", () => {
    const d = depot({ "src/components/ui/B.tsx": "1" });
    const ann = path.join(d, "annonces"); fs.mkdirSync(ann);
    fs.writeFileSync(path.join(ann, "ANNONCE-X-1-2026-11-12.md"), "libre");
    const aut = path.join(d, "aut.json"); fs.writeFileSync(aut, JSON.stringify(["src/components/ui/B.tsx"]));
    const ok = lancer(d, ["--base", "master", "--branche", "usine/X-1", "--autorises", aut, "--annonces", ann]);
    expect(ok.code, ok.out).toBe(0);
    const ko = lancer(d, ["--base", "master", "--branche", "usine/X-1", "--autorises", aut]);
    expect(ko.code).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Corrections après relecture (avis v1-s2) : le workflow doit être utilisable en conditions réelles.
// ---------------------------------------------------------------------------------------------------------------
describe("relecture v1-s2 : différentiel eslint et tsc", () => {
  const racineGarde = path.resolve(__dirname, "../../outils/gardes");
  const charger = async () => (await import(path.join(racineGarde, "zone-interdite.mjs"))) as {
    clesEslint: (json: string, racine: string) => Set<string>;
    clesTsc: (texte: string) => Set<string>;
    comparer: (a: { tete: Record<string, Set<string>>; base: Record<string, Set<string>> | null; connus: Record<string, string[]> }) => { nouveaux: Record<string, string[]> };
  };
  const rapport = (racine: string, ...fichiers: string[]) => JSON.stringify(fichiers.map((f) => ({ filePath: `${racine}/${f}`, messages: [{ severity: 2, ruleId: "no-undef", message: "x is not defined" }] })));

  it("une erreur eslint présente des deux côtés n'est pas nouvelle, même si la base a tourné dans un autre dossier", async () => {
    const { clesEslint, comparer } = await charger();
    const tete = clesEslint(rapport("/home/runner/work/depot/depot", "docs/m/planches.cjs"), "/home/runner/work/depot/depot");
    const base = clesEslint(rapport("/home/runner/work/_temp/base", "docs/m/planches.cjs"), "/home/runner/work/_temp/base");
    expect([...tete]).toEqual([...base]);
    expect(comparer({ tete: { eslint: tete }, base: { eslint: base }, connus: {} }).nouveaux.eslint).toEqual([]);
  });
  it("une erreur eslint absente de la base est nouvelle", async () => {
    const { clesEslint, comparer } = await charger();
    const tete = clesEslint(rapport("/w/d", "a.ts", "b.ts"), "/w/d");
    const base = clesEslint(rapport("/w/b", "a.ts"), "/w/b");
    expect(comparer({ tete: { eslint: tete }, base: { eslint: base }, connus: {} }).nouveaux.eslint).toEqual(["b.ts no-undef x is not defined"]);
  });
  it("les clés facultatives de echecs-connus.json restent tolérées", async () => {
    const { clesTsc, comparer } = await charger();
    const tete = clesTsc("src/a.ts(1,2): error TS2322: type faux");
    expect(comparer({ tete: { tsc: tete }, base: null, connus: { tsc: ["src/a.ts TS2322 type faux"] } }).nouveaux.tsc).toEqual([]);
    expect(comparer({ tete: { tsc: tete }, base: null, connus: {} }).nouveaux.tsc).toHaveLength(1);
  });
  it("le workflow compare toujours à une base (push sur master compris) et passe les deux racines", () => {
    const yml = fs.readFileSync(path.resolve(__dirname, "../../.github/workflows/verifier.yml"), "utf8");
    const job = yml.slice(yml.indexOf("  differentiel:"), yml.indexOf("  tests:"));
    expect(job).not.toMatch(/if:\s*github\.event_name == 'pull_request'/);
    expect(job).toContain("github.event.before");
    expect(job).toContain("--differentiel");
    expect(job).toMatch(/--racine-base/);
  });
});

describe("relecture v1-s2 : fichiers de test touchés, y compris à la racine de tests/", () => {
  it("les motifs du workflow trouvent un test à la racine, en sous-dossier et dans src/", () => {
    const yml = fs.readFileSync(path.resolve(__dirname, "../../.github/workflows/verifier.yml"), "utf8");
    const ligne = yml.split("\n").find((l) => l.includes("git diff --name-only --diff-filter=AM"))!;
    const motifs = [...ligne.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(motifs).toHaveLength(4);
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "motifs-"));
    const git = (...a: string[]) => execFileSync("git", ["-c", "user.email=a@exemple.fr", "-c", "user.name=t", ...a], { cwd: d, stdio: "pipe" }).toString();
    git("init", "-q", "-b", "master");
    fs.writeFileSync(path.join(d, "base.txt"), "x");
    git("add", "."); git("commit", "-qm", "base");
    for (const f of ["tests/racine.test.ts", "tests/sous/dossier.test.ts", "tests/ui/x.test.tsx", "tests/racine.test.tsx", "src/a/b.test.ts", "src/c.test.tsx", "src/pas-un-test.ts"]) {
      fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true });
      fs.writeFileSync(path.join(d, f), "1");
    }
    git("add", "."); git("commit", "-qm", "pr");
    const trouves = git("diff", "--name-only", "--diff-filter=AM", "HEAD~1...HEAD", "--", ...motifs).split("\n").filter(Boolean).sort();
    expect(trouves).toEqual(["src/a/b.test.ts", "src/c.test.tsx", "tests/racine.test.ts", "tests/racine.test.tsx", "tests/sous/dossier.test.ts", "tests/ui/x.test.tsx"]);
  });
});

describe("relecture v1-s2 : fichiers autorisés, annonces et accords lisibles dans le dépôt public", () => {
  const script = path.resolve(__dirname, "../../outils/gardes/zone-interdite.mjs");
  const git = (cwd: string, ...a: string[]) => execFileSync("git", ["-c", "user.email=a@exemple.fr", "-c", "user.name=t", ...a], { cwd, stdio: "pipe" });
  const lancer = (cwd: string, args: string[]) => {
    try { return { code: 0, out: execFileSync("node", [script, ...args], { cwd, stdio: "pipe" }).toString() }; }
    catch (e) { const x = e as { status: number; stdout: Buffer; stderr: Buffer }; return { code: x.status, out: x.stdout.toString() + x.stderr.toString() }; }
  };
  /** Dépôt fictif : la base porte les listes et annonces ; la PR (branche donnée) ajoute des fichiers. */
  function monde(branche: string, base: Record<string, string>, pr: Record<string, string>) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "monde-"));
    const ecrire = (m: Record<string, string>) => { for (const [n, c] of Object.entries(m)) { fs.mkdirSync(path.dirname(path.join(d, n)), { recursive: true }); fs.writeFileSync(path.join(d, n), c); } };
    git(d, "init", "-q", "-b", "master");
    ecrire({ "base.txt": "x", ...base });
    git(d, "add", "."); git(d, "commit", "-qm", "base");
    git(d, "checkout", "-qb", branche);
    ecrire(pr);
    git(d, "add", "."); git(d, "commit", "-qm", "pr");
    return d;
  }
  const opts = (d: string) => ["--base", "master", "--listes", path.join(d, "pilotage/autorises"), "--annonces", path.join(d, "pilotage/annonces")];

  it("branche usine/<ID> : la liste est lue dans le dossier fourni (sans pilotage/fiches), hors liste = rouge", () => {
    const d = monde("usine/X-1", { "pilotage/autorises/X-1.json": JSON.stringify(["src/a.ts"]) }, { "src/a.ts": "1", "src/b.ts": "1" });
    const r = lancer(d, [...opts(d), "--branche", "usine/X-1"]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("src/b.ts");
    expect(r.out).not.toContain("liste-introuvable");
  });
  it("branche usine/<ID> conforme : vert", () => {
    const d = monde("usine/X-1", { "pilotage/autorises/X-1.json": JSON.stringify(["src/a.ts"]) }, { "src/a.ts": "1", "pilotage/journal/X-1.md": "j" });
    expect(lancer(d, [...opts(d), "--branche", "usine/X-1"]).code).toBe(0);
  });
  it("PR « lot » : la fiche vient des lignes « Fiche: <ID> » du corps, et les fichiers hors liste sont rouges", () => {
    const d = monde("lot/v1", { "pilotage/autorises/X-1.json": JSON.stringify(["src/a.ts"]), "pilotage/autorises/X-2.json": JSON.stringify(["src/b.ts"]) }, { "src/a.ts": "1", "src/b.ts": "1", "src/c.ts": "1" });
    const corps = path.join(d, "corps.txt");
    fs.writeFileSync(corps, "Lot de deux fiches.\nFiche: X-1\nFiche : X-2\n");
    const r = lancer(d, [...opts(d), "--branche", "lot/v1", "--corps", corps]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("src/c.ts");
    expect(r.out).not.toContain("src/a.ts :");
    expect(r.out).not.toContain("src/b.ts :");
  });
  it("PR sans aucune ligne « Fiche: » ni branche usine/<ID> : rouge (relecture v1-u3, constat 4)", () => {
    const d = monde("correctif-x", {}, { "src/services/n-importe.ts": "1", "src/app/page.tsx": "1" });
    const corps = path.join(d, "corps.txt"); fs.writeFileSync(corps, "rien");
    const r = lancer(d, [...opts(d), "--branche", "correctif-x", "--corps", corps]);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain("sans-fiche");
  });
  it("PR sans fiche qui ne publie que des listes et des annonces : verte", () => {
    const d = monde("publier-listes", {}, { "pilotage/autorises/X-1.json": "[]", "pilotage/annonces/ANNONCE-X-1-a.md": "libre" });
    expect(lancer(d, [...opts(d), "--branche", "publier-listes"]).code).toBe(0);
  });
  it("une PR ne s'autorise pas elle-même : liste absente de la base, fiche de la tête ignorée (constat 2)", () => {
    const d = monde("usine/L9-99", {}, {
      "src/services/n-importe.ts": "1",
      "pilotage/fiches/L9-99.md": '---\nid: L9-99\nfichiers_autorises: ["**"]\n---\n',
    });
    const r = lancer(d, [...opts(d), "--branche", "usine/L9-99"]);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain("liste-introuvable");
  });
  it("le mode --differentiel est dans la garde (aucun fichier hors liste de la fiche)", () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "diff-"));
    fs.writeFileSync(path.join(d, "tsc-tete.txt"), "src/a.ts(1,2): error TS2322: faux\n");
    const r = lancer(d, ["--differentiel", "--dossier", d, "--racine-tete", d]);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain("ROUGE tsc");
    expect(fs.existsSync(path.resolve(__dirname, "../../outils/gardes/comparer-differentiel.mjs"))).toBe(false);
  });
  it("le workflow lance la garde depuis la base quand elle y existe", () => {
    const yml = fs.readFileSync(path.resolve(__dirname, "../../.github/workflows/verifier.yml"), "utf8");
    const etape = yml.slice(yml.indexOf("- name: Garde de zone"), yml.indexOf("  differentiel:"));
    expect(etape).toContain('$RUNNER_TEMP/base/$GARDE');
  });
  it("identifiant de fiche douteux dans le corps (chemin) : refusé, jamais lu", () => {
    const d = monde("lot/v1", {}, { "src/a.ts": "1" });
    const corps = path.join(d, "corps.txt"); fs.writeFileSync(corps, "Fiche: ../../etc/passwd\n");
    const r = lancer(d, [...opts(d), "--branche", "lot/v1", "--corps", corps]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("identifiant");
  });
  it("zone partagée : verte avec une annonce « libre » du dossier fourni, y compris pour une PR lot", () => {
    const base = { "pilotage/autorises/X-1.json": JSON.stringify(["src/components/ui/B.tsx"]), "pilotage/annonces/ANNONCE-X-1-2026-11-12.md": "libre" };
    const d = monde("lot/v1", base, { "src/components/ui/B.tsx": "1" });
    const corps = path.join(d, "corps.txt"); fs.writeFileSync(corps, "Fiche: X-1\n");
    expect(lancer(d, [...opts(d), "--branche", "lot/v1", "--corps", corps]).code).toBe(0);
    const sans = monde("lot/v1", { "pilotage/autorises/X-1.json": JSON.stringify(["src/components/ui/B.tsx"]) }, { "src/components/ui/B.tsx": "1" });
    fs.writeFileSync(path.join(sans, "corps.txt"), "Fiche: X-1\n");
    expect(lancer(sans, [...opts(sans), "--branche", "lot/v1", "--corps", path.join(sans, "corps.txt")]).code).toBe(1);
  });
  it("accord RC-40 rattaché à LA fiche : seule cette fiche passe sur zernio-client.ts", () => {
    const fichier = "src/fournisseurs/publication/zernio-client.ts";
    const base = {
      "pilotage/autorises/X-1.json": JSON.stringify({ fichiers: [fichier], accords: ["RC-40"] }),
      "pilotage/autorises/X-2.json": JSON.stringify({ fichiers: [fichier] }),
    };
    const d1 = monde("usine/X-1", base, { [fichier]: "1" });
    expect(lancer(d1, [...opts(d1), "--branche", "usine/X-1"]).code).toBe(0);
    const d2 = monde("usine/X-2", base, { [fichier]: "1" });
    expect(lancer(d2, [...opts(d2), "--branche", "usine/X-2"]).code).toBe(1);
  });
  it("le workflow passe les listes, les annonces et le corps lus sur la BASE de la PR", () => {
    const yml = fs.readFileSync(path.resolve(__dirname, "../../.github/workflows/verifier.yml"), "utf8");
    const job = yml.slice(yml.indexOf("  zone:"), yml.indexOf("  differentiel:"));
    expect(job).toContain("--listes");
    expect(job).toContain("--annonces");
    expect(job).toContain("--corps");
    expect(job).toContain("worktree add");
    expect(job).not.toContain("--annonces usine");
  });
});
