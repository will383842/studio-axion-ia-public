// [L0-15] Garde des fiches : doit passer au rouge sur chaque défaut décrit par la fiche, au vert sur un registre sain.
// Données fictives seulement. Aucun appel réel (ni réseau ni modèle).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  analyserFiche, verifierFiches, verifierCopiePublique, expurger, genererLots, lireMotifs, retenirFichesEnDefaut, principal,
  inventairePublic, nomsCitesSousDossierPublic,
} from "../../outils/gardes/fiches.mjs";

type F = Record<string, unknown>;
const base = (id: string, o: F = {}): F => ({
  id, titre: "Titre fictif", version: "V1", lot: "L-A", depot: "studio-axion-ia-public", ordre: 1, statut: "a_faire",
  modele: "Sonnet", zone: "aucune", zone_interdite: "non", manuel: "non", ci: "publique", depend_de: [],
  fichiers_autorises: [`src/${id}.ts (nouveau)`], criteres: ["Un test rouge puis vert."], ...o,
});
const lotsDe = (fiches: F[]) => [{ lot: "L-A", fiches: fiches.map((f) => f.id as string) }];
const erreurs = (fiches: F[], opt: F = {}) => verifierFiches(fiches, (opt.lots as never) ?? lotsDe(fiches), opt as never).map((e: { regle: string }) => e.regle);

describe("garde des fiches : vert", () => {
  it("accepte un registre sain", () => {
    const f = [base("A-1"), base("A-2", { depend_de: ["A-1"], ordre: 2, fichiers_autorises: ["src/autre.ts"] })];
    expect(verifierFiches(f, lotsDe(f))).toEqual([]);
  });
});

describe("garde des fiches : rouge", () => {
  it("cycle", () => {
    const f = [base("A-1", { depend_de: ["A-2"] }), base("A-2", { depend_de: ["A-1"] })];
    expect(erreurs(f)).toContain("cycle");
  });
  it("V1 qui dépend de la V2", () => {
    const f = [base("A-1", { depend_de: ["B-1"] }), base("B-1", { version: "V2" })];
    expect(erreurs(f)).toContain("version");
  });
  it("recoupement de fichiers non ordonné", () => {
    const f = [base("A-1", { fichiers_autorises: ["src/x.ts"] }), base("A-2", { fichiers_autorises: ["src/x.ts (nouveau)"] })];
    expect(erreurs(f)).toContain("recoupement");
  });
  it("recoupement ordonné par dépendance : accepté", () => {
    const f = [base("A-1", { fichiers_autorises: ["src/x.ts"] }), base("A-2", { fichiers_autorises: ["src/x.ts"], depend_de: ["A-1"] })];
    expect(erreurs(f)).not.toContain("recoupement");
  });
  it("recoupement par motif récursif", () => {
    const f = [base("A-1", { fichiers_autorises: ["src/ui/**"] }), base("A-2", { fichiers_autorises: ["src/ui/bouton.ts"] })];
    expect(erreurs(f)).toContain("recoupement");
  });
  it("zone étendue sans drapeau", () => {
    const f = [base("A-1", { fichiers_autorises: ["src/fournisseurs/x/zernio-envoi.ts"] })];
    expect(erreurs(f)).toContain("zone");
    const g = [base("A-1", { fichiers_autorises: ["src/components/ui/bouton.tsx"] })];
    expect(erreurs(g)).toContain("zone");
    const ok = [base("A-1", { zone: "interface", fichiers_autorises: ["src/components/ui/bouton.tsx"] })];
    expect(erreurs(ok)).not.toContain("zone");
  });
  it("haiku", () => {
    expect(erreurs([base("A-1", { modele: "Haiku" })])).toContain("modele");
  });
  it("mots interdits", () => {
    const f = [base("A-1", { titre: "Parler à zorglub" })];
    expect(erreurs(f, { motifs: lireMotifs("zorglub") })).toContain("mots-interdits");
  });
  it("plus de 6 fichiers", () => {
    const f = [base("A-1", { fichiers_autorises: ["a.md", "b.md", "c.md", "d.md", "e.md", "f.md", "g.md"] })];
    expect(erreurs(f)).toContain("taille");
    const gk = [base("A-1", { fichiers_autorises: ["a.md", "b.md", "c.md", "d.md", "e.md", "f.md", "x/.gitkeep"] })];
    expect(erreurs(gk)).not.toContain("taille");
  });
  it("dépôt vide", () => {
    expect(erreurs([base("A-1", { depot: "" })])).toContain("depot");
  });
  it("workflow dans un dépôt privé", () => {
    const f = [base("A-1", { depot: "depot-prive", fichiers_autorises: [".github/workflows/x.yml"] })];
    expect(erreurs(f)).toContain("workflow-prive");
    const pub = [base("A-1", { fichiers_autorises: [".github/workflows/x.yml"] })];
    expect(erreurs(pub)).not.toContain("workflow-prive");
  });
  it("identifiant de depend_de inconnu", () => {
    expect(erreurs([base("A-1", { depend_de: ["ZZ-9"] })])).toContain("depend-inconnu");
    expect(erreurs([base("A-1", { depend_de: ["ZZ-9"] })], { externes: ["ZZ-9"] })).not.toContain("depend-inconnu");
  });
  it("fiche a_faire dans aucun lot", () => {
    const f = [base("A-1"), base("A-2", { fichiers_autorises: ["src/b.ts"] })];
    expect(erreurs(f, { lots: [{ lot: "L-A", fiches: ["A-1"] }] })).toContain("lot");
    const fait = [base("A-1", { statut: "fait" })];
    expect(erreurs(fait, { lots: [] })).not.toContain("lot");
  });
  it("fiche de code en ci « aucune » sans critère de script node", () => {
    const f = [base("A-1", { ci: "aucune" })];
    expect(erreurs(f)).toContain("ci-aucune");
    const ok = [base("A-1", { ci: "aucune", criteres: ["Script node sans IA lancé par l'auteur, résultat collé dans la PR."] })];
    expect(erreurs(ok)).not.toContain("ci-aucune");
    const doc = [base("A-1", { ci: "aucune", fichiers_autorises: ["docs/x.md"] })];
    expect(erreurs(doc)).not.toContain("ci-aucune");
  });
});

// Mots fictifs : « zorglub » joue le nom du fondateur, « quux-prive » le dépôt privé. Aucune donnée réelle.
const MOTIFS = lireMotifs("zorglub\n# commentaire\nquux-prive\n\\bzorg\\b\n[0-9]+ ?€\n");
const INV = { racine: new Set(["src", "docs", "tests", "fiches", "lots"]), dossiers: new Set(["src", "docs", "tests", "pilotage", "fiches", "lots", "ecrire"]), fichiers: new Set(["LISEZMOI.md", "README.md"]) };
const OPT = { motifs: MOTIFS, public: INV };
const RACINE = path.resolve(__dirname, "../..");
const FICHIER_PRIVE = process.env.FICHES_INTERDITS_FICHIER;

describe("constat 1-2 : aucune liste privée dans le code public", () => {
  it("le garde ne contient aucune empreinte (ni sha ni md5) ni table de correspondance", () => {
    const code = fs.readFileSync(path.join(RACINE, "outils/gardes/fiches.mjs"), "utf8");
    expect(code).not.toMatch(/\b[0-9a-f]{32,}\b/i);
    expect(code).not.toMatch(/createHash|EMPREINTES/);
  });
  it("le garde lit les motifs dans un fichier fourni à l'exécution", () => {
    expect(verifierCopiePublique({ "a.md": "Zorglub est là" }, OPT).map((e) => e.message)).toEqual(["motif de la liste privée"]);
    expect(verifierCopiePublique({ "a.md": "Zorglub est là" }, { public: INV })).toEqual([]);
  });
  it.skipIf(!FICHIER_PRIVE)("avec la vraie liste privée : code du garde, tests et pilotage/** sans aucun motif", () => {
    const motifs = lireMotifs(fs.readFileSync(FICHIER_PRIVE as string, "utf8"));
    const textes: Record<string, string> = {
      "outils/gardes/fiches.mjs": fs.readFileSync(path.join(RACINE, "outils/gardes/fiches.mjs"), "utf8"),
      "tests/gardes/fiches.test.ts": fs.readFileSync(path.join(RACINE, "tests/gardes/fiches.test.ts"), "utf8"),
    };
    const marche = (d: string) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) marche(p); else textes[path.relative(RACINE, p)] = fs.readFileSync(p, "utf8");
    } };
    marche(path.join(RACINE, "pilotage"));
    const touches = Object.entries(textes).filter(([, t]) => motifs.some((m) => new RegExp(m.source, "gi").test(t))).map(([n]) => n);
    expect(touches).toEqual([]);
  });
});

describe("constat 3 : chemins du dépôt privé", () => {
  const prives = ["classeur/COMPTE-RENDU-2026-01-01.md", "classeur/AVIS-<fiche>-<date>.md", "archives-x/releve-y.txt",
    "outil-kit/generer-lots.mjs", "CARNET.md:12", "BILAN-FINAL-9-AGENTS.md", "ecrire/NOTE-INTERNE.md"];
  for (const c of prives) it(`refuse et remplace ${c}`, () => {
    const brut = `Voir ${c}, puis agir.`;
    expect(verifierCopiePublique({ "a.md": brut }, OPT).map((e) => e.message)).toContain("chemin privé");
    const net = expurger(brut, OPT);
    expect(net).toBe("Voir un fichier du dépôt privé, puis agir.");
    expect(verifierCopiePublique({ "a.md": net }, OPT)).toEqual([]);
  });
  it("laisse les chemins publics, les branches et les dates", () => {
    const t = "Créer docs/CONTRAT-X.md et src/a.ts (branche usine/L0-15, le 11/11/2026), voir LISEZMOI.md et lots/*.json.";
    expect(expurger(t, OPT)).toBe(t);
    expect(verifierCopiePublique({ "a.md": t }, OPT)).toEqual([]);
  });
  it("un nom en majuscules cité ailleurs sous un dossier public reste public", () => {
    const inv = { ...INV, cites: nomsCitesSousDossierPublic(["créer docs/CONTRAT-Y.md"], INV) };
    expect(expurger("Lire CONTRAT-Y.md.", { motifs: MOTIFS, public: inv })).toBe("Lire CONTRAT-Y.md.");
  });
  it("l'inventaire du dépôt réel connaît src, pilotage et lots", () => {
    const inv = inventairePublic(RACINE);
    for (const d of ["src", "tests", "pilotage", "lots", "fiches"]) expect(inv.dossiers.has(d)).toBe(true);
  });
});

describe("constat 4 : champ de validation et mots entiers", () => {
  it("validation_<mot> devient exactement validation_fondateur, lisible par analyserFiche", () => {
    const net = expurger("---\nid: A-1\nvalidation_zorglub: oui\n---\nSi validation_zorglub vaut oui.\n", OPT);
    expect(net).toContain("validation_fondateur: oui");
    expect(net).not.toMatch(/validation_le|zorglub/i);
    expect(analyserFiche(net).validation_fondateur).toBe("oui");
    expect(verifierCopiePublique({ "a.md": "validation_autre: oui" }, OPT).map((e) => e.message)).toContain("champ de validation autre que validation_fondateur");
  });
  it("élisions, majuscules, mots composés", () => {
    expect(expurger("accord de Zorglub", OPT)).toBe("accord du fondateur");
    expect(expurger("VALIDATION DE ZORGLUB REQUISE", OPT)).toBe("VALIDATION DU FONDATEUR REQUISE");
    expect(expurger("label attend-zorglub", OPT)).toBe("label attend-fondateur");
    expect(expurger("demandé à la session interface et à Zorglub", OPT)).toBe("demandé à la session interface et au fondateur");
  });
  it("le nom du dépôt privé, seul ou dans un chemin", () => {
    expect(expurger("dans quux-prive, puis quux-prive/usine et quux-prive/usine/X.md.", OPT))
      .toBe("dans le dépôt privé, puis le dépôt privé et un fichier du dépôt privé.");
  });
  it("aucun motif ne survit, même à cheval sur deux jetons", () => {
    const m = lireMotifs("zorglub\nab cd");
    expect(expurger("x ab cd y", { motifs: m, public: INV })).toBe("x [retiré] y");
  });
});

// Montant fictif construit à l'exécution (nombre sans lien avec un vrai plafond).
const montantFictif = (n: number) => `${n} ` + String.fromCharCode(0x20ac);

describe("remarque 9 : montants", () => {
  it("un montant est refusé et remplacé", () => {
    const texte = `plafond de ${montantFictif(7)} par défaut`;
    expect(verifierCopiePublique({ "a.md": texte }, { public: INV }).map((e) => e.message)).toContain("montant");
    expect(expurger(texte, OPT)).toBe("plafond d'un montant par défaut");
  });
});

describe("constat 6 : publier seulement les fiches qui passent", () => {
  it("retient la fiche en défaut, la plus tardive d'un recoupement", () => {
    const f = [base("A-1", { fichiers_autorises: ["src/x.ts"] }), base("A-2", { ordre: 2, fichiers_autorises: ["src/x.ts"] }),
      base("A-3", { ordre: 3, fichiers_autorises: ["a", "b", "c", "d", "e", "f", "g"] }), base("A-4", { ordre: 4, depend_de: ["A-3"], fichiers_autorises: ["src/y.ts"] })];
    const { publiees, retenues } = retenirFichesEnDefaut(f as never);
    expect(retenues).toEqual([{ id: "A-3", regle: "taille" }, { id: "A-2", regle: "recoupement" }]);
    expect(publiees.map((x: F) => x.id)).toEqual(["A-1", "A-4"]);
  });
  it("le garde est vert sur la copie publiée pilotage/**", () => {
    const sortie = { log: () => {}, error: (m: string) => { if (!/^avertissement/.test(m)) erreursVues.push(m); } };
    const erreursVues: string[] = [];
    const args = ["--racine", path.join(RACINE, "pilotage"), "--depot", RACINE];
    if (FICHIER_PRIVE) args.push("--interdits", FICHIER_PRIVE);
    const code = principal(args, sortie);
    expect(erreursVues).toEqual([]);
    expect(code).toBe(0);
  });
  it("sans liste privée, le garde fait ses autres contrôles et le dit", () => {
    const vus: string[] = [];
    const dir = fs.mkdtempSync(path.join(RACINE, "node_modules/.garde-"));
    fs.mkdirSync(path.join(dir, "fiches"));
    fs.writeFileSync(path.join(dir, "fiches/A-1.md"), `---\nid: A-1\nstatut: a_faire\ndepot: x\nmodele: haiku\n---\nplafond ${montantFictif(3)}\n`);
    const ancien = process.env.FICHES_INTERDITS_FICHIER;
    delete process.env.FICHES_INTERDITS_FICHIER;
    try {
      const code = principal(["--racine", dir, "--depot", RACINE], { log: () => {}, error: (m: string) => vus.push(m) });
      expect(code).toBe(1);
      expect(vus.join("\n")).toMatch(/\[modele\] A-1/);
      expect(vus.join("\n")).toMatch(/montant/);
      expect(vus.join("\n")).toMatch(/liste des motifs refusés absente/);
    } finally {
      if (ancien) process.env.FICHES_INTERDITS_FICHIER = ancien;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  it("--expurger refuse de produire une copie sans liste privée", () => {
    const vus: string[] = [];
    const ancien = process.env.FICHES_INTERDITS_FICHIER;
    delete process.env.FICHES_INTERDITS_FICHIER;
    try { expect(principal(["--expurger", "inexistant"], { log: () => {}, error: (m: string) => vus.push(m) })).toBe(2); }
    finally { if (ancien) process.env.FICHES_INTERDITS_FICHIER = ancien; }
  });
});

describe("analyse d'une fiche et lots", () => {
  it("lit l'en-tête", () => {
    const f = analyserFiche('---\nid: A-1\nversion: V1\nordre: 3\ndepend_de: ["B-1"]\nfichiers_autorises: ["x (nouveau)"]\ntitre: "T"\n---\n\n## Contexte\n');
    expect(f.id).toBe("A-1");
    expect(f.ordre).toBe(3);
    expect(f.depend_de).toEqual(["B-1"]);
    expect(f.titre).toBe("T");
  });
  it("génère les lots triés par ordre, sans les remplacées", () => {
    const l = genererLots([base("A-2", { ordre: 2 }), base("A-1", { ordre: 1 }), base("A-3", { statut: "remplacee" })]);
    expect(l).toEqual([{ lot: "L-A", fiches: ["A-1", "A-2"] }]);
  });
});
