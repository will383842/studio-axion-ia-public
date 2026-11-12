// [NEW-ARG-02] Garde « règles de fer » : rouge sur chaque exemple fautif, vert sur un dépôt conforme.
// Données fictives seulement ; aucun réseau, aucun modèle ; le mot-clé « nom du fondateur » est remplacé par un nom fictif.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { controler, lireMots, EXCEPTIONS, REGLES } from "../../outils/gardes/regles-de-fer.mjs";

// Montants construits à l'exécution : le fichier ne contient aucun montant écrit.
const chiffre = () => String(2 + 3);
const EUR = String.fromCharCode(0x20ac);
const USD = String.fromCharCode(36);
const MOT = ["eu", "ros"].join("");
type F = { chemin: string; contenu: string };
const regles = (fs: F[], opt: Record<string, unknown> = {}) =>
  (controler(fs, { exceptions: {}, ...opt }) as { defauts: { regle: string }[] }).defauts.map((d) => d.regle);

describe("règles : rouge sur un exemple fautif", () => {
  it("montant en euros ou en dollars dans un écran", () => {
    expect(regles([{ chemin: "src/app/(studio)/x/page.tsx", contenu: `<p>Coût : ${chiffre()} ${EUR}</p>` }])).toContain("montant");
    expect(regles([{ chemin: "src/components/a/B.tsx", contenu: `const t = "Solde ${chiffre()} ${USD}";` }])).toContain("montant");
    expect(regles([{ chemin: "src/components/a/B.tsx", contenu: `const t = "${chiffre()} ${MOT}";` }])).toContain("montant");
  });
  it("montant calculé ou interpolé (correction après relecture)", () => {
    const c = (contenu: string) => regles([{ chemin: "src/components/a/B.tsx", contenu }]);
    expect(c("const t = `${(n / 100).toFixed(2)} " + EUR + "`;")).toContain("montant");
    expect(c("const t = `${new Intl.NumberFormat('fr-FR').format(n)} " + EUR + "`;")).toContain("montant");
    expect(c("<p>{prix.toFixed(2)} " + EUR + "</p>")).toContain("montant");
    expect(c("<p>{prix}" + EUR + "</p>")).toContain("montant");
    expect(c("const t = `Coût : " + chiffre() + " " + EUR + " pour ${n}`;")).toContain("montant");
    expect(c("new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })")).toContain("montant");
    expect(c("const t = `Prix : ${n} " + USD + "`;")).toContain("montant");
    expect(c("const t = `Bonjour ${nom}, ${n} messages`;")).not.toContain("montant");
  });
  it("montant formaté par un appel, sans symbole sur la ligne (relecture v1-u5, constat 1)", () => {
    const c = (contenu: string) => regles([{ chemin: "src/components/formats/x/B.tsx", contenu }]);
    expect(c("<p>Fabriquer (≈ ${euros(montantCentimes)})</p>")).toContain("montant");
    expect(c("<p>Coût total : {formaterMontant(total)}</p>")).toContain("montant");
    expect(c("<EncartCout cout={c} />")).toContain("montant");
    expect(c("<JaugeBudget valeur={v} />")).toContain("montant");
    expect(c("const m = { centimes: 5, devise: \"EUR\" };")).toContain("montant");
    expect(c("new Intl.NumberFormat('fr-FR', { currency: devise })")).toContain("montant");
    expect(c("import { formaterMontant } from \"@/lib/montants\";")).toContain("montant");
  });
  it("symbole ou mot de monnaie autour d'une expression (relecture v1-u5, constat 1)", () => {
    const c = (contenu: string) => regles([{ chemin: "src/app/(studio)/x/page.tsx", contenu }]);
    expect(c("<p>{n} " + MOT + "</p>")).toContain("montant");
    expect(c("const t = `${n} " + MOT + "`;")).toContain("montant");
    expect(c("<p>" + EUR + "{n}</p>")).toContain("montant");
    expect(c("const t = `" + EUR + "${n}`;")).toContain("montant");
    expect(c("const t = `" + USD + USD + "{n}`;".replace(USD + "{", "${"))).toContain("montant");
    expect(c("<p>{prix}&nbsp;" + EUR + "</p>")).toContain("montant");
    expect(c("<p>{n}  " + EUR + "</p>")).toContain("montant");
    expect(c("const t = `${n} " + EUR + "`;")).toContain("montant");
    expect(c("<p>{n} &euro;</p>")).toContain("montant");
    expect(c("const t = n + \" " + EUR + "\";")).toContain("montant");
    expect(c("<Champ suffixe=\"" + EUR + "\" />")).toContain("montant");
    expect(c("<p>{n}\n" + EUR + "</p>")).toContain("montant");
    expect(c("<p>{nombre} messages</p>")).not.toContain("montant");
  });
  it("exception par fichier : le nombre d'occurrences tolérées ne peut que baisser (relecture v1-u5, constat 5)", () => {
    const deux = "const a = `${x} " + EUR + "`;\nconst b = `${y} " + EUR + "`;";
    const f = (contenu: string) => [{ chemin: "src/components/formats/image-video/vue.ts", contenu }];
    const exc = { montant: { "src/components/formats/image-video/vue.ts": 2 } };
    const r = (contenu: string) => (controler(f(contenu), { exceptions: exc }) as { defauts: { regle: string }[] }).defauts.map((d) => d.regle);
    expect(r(deux)).toEqual([]);
    expect(r(deux + "\nconst c = `${z} " + EUR + "`;")).toEqual(["exception-depassee"]);
    expect(r("const a = `${x} " + EUR + "`;")).toEqual([]);
    expect(r("export const propre = 1;")).toEqual(["exception-perimee"]);
  });
  it("les écrans qui appellent un formateur de montant sont dans les exceptions de départ", () => {
    const fichiers = execFileSync("git", ["grep", "-lE", "formaterMontant|euros[(]|EncartCout|JaugeBudget", "--", "src/app", "src/components"], { encoding: "utf8" }).split("\n").filter(Boolean);
    expect(fichiers.length).toBeGreaterThan(0);
    for (const f of fichiers) expect(Object.keys(EXCEPTIONS.montant), f).toContain(f);
  });
  it("gh : clone et api d'un dépôt nommé rougissent, le dépôt lui-même jamais (relecture v1-u5, constat 4)", () => {
    const run = (cmd: string) => regles([{ chemin: ".github/workflows/a.yml", contenu: `steps:\n  - run: ${cmd}\n` }]);
    expect(run("gh repo clone org/prive")).toContain("workflow-externe");
    expect(run("gh api repos/org/prive/contents/x")).toContain("workflow-externe");
    expect(run("gh api -H 'Accept: x' /repos/org/prive/issues")).toContain("workflow-externe");
    expect(run("gh pr view --repo org/prive 3")).toContain("workflow-externe");
    expect(run("gh pr view --repo ${{ github.repository }} 3")).not.toContain("workflow-externe");
    expect(run("gh api repos/${{ github.repository }}/issues")).not.toContain("workflow-externe");
    expect(run("gh repo clone ${{ github.repository }}")).not.toContain("workflow-externe");
  });
  it("le workflow ne lit pas la liste des mots en clair : secret masqué, jamais une variable (relecture v1-u5, constat 3)", () => {
    const yml = fs.readFileSync(".github/workflows/verifier.yml", "utf8");
    expect(yml).not.toMatch(/vars\.MOTS_FONDATEUR/);
    expect(yml).toMatch(/secrets\.MOTS_FONDATEUR/);
  });
  it("workflow qui appelle un dépôt privé par run (correction après relecture)", () => {
    const run = (cmd: string) => regles([{ chemin: ".github/workflows/a.yml", contenu: `steps:\n  - run: ${cmd}\n` }]);
    expect(run("git clone https://github.com/org/prive.git")).toContain("workflow-externe");
    expect(run("gh workflow run x.yml -R org/prive")).toContain("workflow-externe");
    expect(run("gh workflow run x.yml --repo org/prive")).toContain("workflow-externe");
    expect(run("curl https://github.com/org/prive/archive/main.zip")).toContain("workflow-externe");
    expect(run("pnpm install --frozen-lockfile")).not.toContain("workflow-externe");
  });
  it("date Buffer écrite en toutes lettres (correction après relecture)", () => {
    expect(regles([{ chemin: "src/x.ts", contenu: "// Buffer jusqu'au 18 novembre" }])).toContain("date-buffer");
    expect(regles([{ chemin: "src/x.ts", contenu: "// Buffer : 20 novembre 2026" }])).toContain("date-buffer");
  });
  it("exception périmée : un fichier listé qui ne contient plus le motif rougit (correction après relecture)", () => {
    const f = [{ chemin: "src/services/x.ts", contenu: "export const propre = 1;" }];
    const r = controler(f, { exceptions: { purge: ["src/services/x.ts"] } }) as { defauts: { regle: string; fichier: string }[] };
    expect(r.defauts).toEqual([expect.objectContaining({ regle: "exception-perimee", fichier: "src/services/x.ts" })]);
    const encore = controler([{ chemin: "src/services/x.ts", contenu: "purger()" }], { exceptions: { purge: ["src/services/x.ts"] } }) as { defauts: unknown[] };
    expect(encore.defauts).toEqual([]);
  });
  it("exception d'un fichier absent du dépôt : périmée quand la liste est complète", () => {
    const r = controler([{ chemin: "a.md", contenu: "x" }], { exceptions: { purge: ["src/disparu.ts"] }, listeComplete: true }) as { defauts: { regle: string }[] };
    expect(r.defauts.map((d) => d.regle)).toEqual(["exception-perimee"]);
  });
  it("règle non vérifiée : avertissement visible (annotation GitHub)", () => {
    const sortie = execFileSync("node", ["outils/gardes/regles-de-fer.mjs"], { encoding: "utf8", maxBuffer: 1 << 28, env: { ...process.env, MOTS_FONDATEUR: "", GITHUB_ACTIONS: "true" } });
    expect(sortie).toMatch(/^::warning/m);
  }, 120000);
  it("workflow qui appelle un dépôt externe", () => {
    const wf = "jobs:\n  a:\n    steps:\n      - uses: autre-org/depot-ferme/.github/workflows/x.yml@main\n";
    expect(regles([{ chemin: ".github/workflows/a.yml", contenu: wf }])).toContain("workflow-externe");
    const co = "steps:\n  - uses: actions/checkout@v4\n    with:\n      repository: autre-org/depot-ferme\n";
    expect(regles([{ chemin: ".github/workflows/b.yml", contenu: co }])).toContain("workflow-externe");
  });
  it("modèle Haiku", () => {
    expect(regles([{ chemin: "src/services/x.ts", contenu: 'const modele = "claude-haiku-9";' }])).toContain("haiku");
  });
  it("purge de données", () => {
    expect(regles([{ chemin: "src/services/x.ts", contenu: "await purgerTout();" }])).toContain("purge");
    expect(regles([{ chemin: "scripts/x.sh", contenu: "rm -rf data/" }])).toContain("purge");
  });
  it("date Buffer périmée (18/11, 20/11)", () => {
    expect(regles([{ chemin: "src/x.ts", contenu: 'const finBuffer = "20/11";' }])).toContain("date-buffer");
    expect(regles([{ chemin: "src/y.ts", contenu: "// Buffer jusqu'au 2026-11-18" }])).toContain("date-buffer");
    expect(regles([{ chemin: "src/z.ts", contenu: "const d = '18/11'; // autre sujet" }])).not.toContain("date-buffer");
  });
  it("push : git push dans un workflow, notification push dans le code", () => {
    expect(regles([{ chemin: ".github/workflows/a.yml", contenu: "run: git push origin HEAD" }])).toContain("push");
    expect(regles([{ chemin: "src/x.ts", contenu: 'import webpush from "web-push";' }])).toContain("push");
  });
  it("nom du fondateur (mots fournis à l'exécution)", () => {
    const f = [{ chemin: "docs/a.md", contenu: "Voir Dupontel pour la suite" }];
    expect(regles(f, { mots: ["dupontel"] })).toContain("nom-fondateur");
    expect(regles([{ chemin: "docs/Dupontel.md", contenu: "x" }], { mots: ["dupontel"] })).toContain("nom-fondateur");
  });
  it("sans liste de mots : règle non vérifiée, dite en clair", () => {
    const r = controler([{ chemin: "a.md", contenu: "x" }], { exceptions: {}, mots: [] }) as { nonVerifiees: string[] };
    expect(r.nonVerifiees).toContain("nom-fondateur");
  });
});

describe("dépôt conforme : vert", () => {
  it("aucun défaut", () => {
    const ok: F[] = [
      { chemin: "src/app/(studio)/x/page.tsx", contenu: "<p>Gratuit pour le fondateur</p>" },
      { chemin: ".github/workflows/v.yml", contenu: "steps:\n  - uses: actions/checkout@v4\n  - uses: pnpm/action-setup@v4\n  - uses: ./.github/actions/local\n" },
      { chemin: "src/services/y.ts", contenu: "export const fin = new Date('2026-12-01'); // Buffer résilié" },
    ];
    expect(regles(ok, { mots: ["dupontel"] })).toEqual([]);
  });
  it("une exception listée est tolérée, une autre non", () => {
    const f = [{ chemin: "src/services/x.ts", contenu: "purger()" }];
    expect((controler(f, { exceptions: { purge: ["src/services/x.ts"] } }) as { defauts: unknown[] }).defauts).toEqual([]);
    expect((controler(f, { exceptions: { purge: ["src/autre.ts"] } }) as { defauts: unknown[] }).defauts.length).toBe(1);
  });
  it("lireMots : variable ou liste, sans doublon ni vide", () => {
    expect(lireMots({ MOTS_FONDATEUR: " a, B ,,a " })).toEqual(["a", "b"]);
    expect(lireMots({})).toEqual([]);
  });
});

describe("liste d'exceptions", () => {
  it("la liste du nom du fondateur est VIDE", () => {
    expect(Object.keys(EXCEPTIONS["nom-fondateur"] ?? {})).toEqual([]);
  });
  it("chaque règle est nommée", () => {
    expect(REGLES).toEqual(["montant", "workflow-externe", "haiku", "purge", "date-buffer", "push", "nom-fondateur"]);
  });
});

describe("dépôt réel (git ls-files, sans réseau)", () => {
  it("toutes les règles autres que le nom du fondateur sont vertes avec les exceptions de départ", () => {
    const liste = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", maxBuffer: 1 << 28 }).split("\0").filter(Boolean);
    const sortie = JSON.parse(execFileSync("node", ["outils/gardes/regles-de-fer.mjs", "--json"], { encoding: "utf8", maxBuffer: 1 << 28, env: { ...process.env, MOTS_FONDATEUR: "" } }));
    expect(liste.length).toBeGreaterThan(0);
    expect(sortie.defauts).toEqual([]);
  }, 120000);
});
