import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OPERATIONS, ErreurRendu, type DemandeRendu } from "../../studio-rendu/src/contrat";
import { creerVisuelPage, extraireMesure, formaterMesure, type DependancesVisuelPage } from "../../studio-rendu/src/operations/visuel-page";
import { CONTENU_ESSAI } from "../../studio-rendu/scripts/contenu-essai-visuel";

const lire = (chemin: string) => readFileSync(chemin, "utf8");
const NOUVELLES = ["visuel-page", "assemblage-pdf"] as const;
/** Les 13 opérations d'AVANT les carrousels V2-A, figées : la PR n'y fait que des ajouts. */
const ANCIENNES = [
  "nettoyage-audio", "tranches-audio", "analyse-media", "mesure-son", "composition", "image-fixe", "traitement-image",
  "assemblage", "capture-site", "miniature", "etalonnage", "mixage", "extrait",
] as const;
/** Leur gestionnaire dans index.ts (`tranches-audio` : volontairement sans gestionnaire, refusée clairement). */
const GESTIONNAIRES: Record<string, string> = {
  "nettoyage-audio": "nettoyageAudio", "analyse-media": "analyseMedia", "mesure-son": "mesureSon", composition: "composition",
  "image-fixe": "imageFixe", "traitement-image": "traitementImage", assemblage: "assemblage", "capture-site": "captureSite",
  miniature: "miniature", etalonnage: "etalonnage", mixage: "mixage", extrait: "extrait",
};

/** Opérations déclarées dans l'union `OperationRendu` d'un fichier : les chaînes de ses lignes « | "nom" ». */
function operationsDeclarees(source: string): string[] {
  const bloc = source.slice(source.indexOf("export type OperationRendu"));
  const fin = bloc.indexOf(";\n\n");
  return [...bloc.slice(0, fin + 1).matchAll(/^\s*\|\s*"([a-z0-9-]+)"/gm)].map((m) => m[1]);
}

describe("M2-01/M2-02 · concordance du contrat aux deux endroits (studio et studio-rendu)", () => {
  const studio = operationsDeclarees(lire("src/fournisseurs/types.ts"));
  const rendu = operationsDeclarees(lire("studio-rendu/src/contrat.ts"));

  it("les nouvelles opérations sont déclarées des deux côtés et dans OPERATIONS", () => {
    for (const nom of NOUVELLES) {
      expect(studio, `types.ts : ${nom}`).toContain(nom);
      expect(rendu, `contrat.ts : ${nom}`).toContain(nom);
      expect(OPERATIONS, `OPERATIONS : ${nom}`).toContain(nom);
    }
  });
  it("les deux unions sont identiques et OPERATIONS les reprend toutes", () => {
    expect([...studio].sort()).toEqual([...rendu].sort());
    expect([...OPERATIONS].sort()).toEqual([...rendu].sort());
  });
  it("chaque import dynamique est enveloppé : une panne de chargement donne une ErreurRendu sans chemin interne", () => {
    const index = lire("studio-rendu/src/index.ts");
    expect(index).toMatch(/"visuel-page":[^\n]*charger\("visuel-page"/);
    expect(index).toMatch(/"assemblage-pdf":[^\n]*charger\("assemblage-pdf"/);
    const corps = index.slice(index.indexOf("async function charger"));
    expect(corps).toMatch(/try\s*\{[\s\S]*await importer\(\)[\s\S]*\}\s*catch/);
    expect(corps).toMatch(/new ErreurRendu\(\{\s*code: "indisponible",\s*reessayable: false,\s*message: `Opération \$\{nom\} non chargeable dans ce conteneur`/);
    expect(corps).not.toMatch(/message:[^\n]*\$\{(e|err|erreur)\b/);
  });
  it("les opérations sont inscrites dans index.ts, en import dynamique (une panne d'import ne touche pas les autres)", () => {
    const index = lire("studio-rendu/src/index.ts");
    expect(index).toMatch(/"visuel-page":\s*async[^\n]*import\("\.\/operations\/visuel-page\.js"\)/);
    expect(index).toMatch(/"assemblage-pdf":\s*async[^\n]*import\("\.\/operations\/assemblage-pdf\.js"\)/);
    expect(index).not.toMatch(/^import[^\n]*operations\/(visuel-page|assemblage-pdf)/m);
  });
  it("ajouts seulement : les 13 opérations d'avant sont intactes (OPERATIONS, deux unions, gestionnaires d'index.ts)", () => {
    for (const nom of ANCIENNES) {
      expect(OPERATIONS, `OPERATIONS : ${nom}`).toContain(nom);
      expect(studio, `types.ts : ${nom}`).toContain(nom);
      expect(rendu, `contrat.ts : ${nom}`).toContain(nom);
    }
    expect(OPERATIONS.filter((o) => !(ANCIENNES as readonly string[]).includes(o)).sort()).toEqual([...NOUVELLES].sort());
    const index = lire("studio-rendu/src/index.ts");
    for (const [nom, fonction] of Object.entries(GESTIONNAIRES)) {
      // Ancré sur la ligne de l'objet `operations` : `nom,` (clé abrégée) ou `"nom": fonction,`.
      const ligne = fonction === nom ? `^\\s*${nom},` : `^\\s*"${nom}":\\s*${fonction},`;
      expect(index, `index.ts : ${nom}`).toMatch(new RegExp(ligne, "m"));
      expect(index, `index.ts : import de ${fonction}`).toMatch(new RegExp(`import \\{ ${fonction} \\} from "\\./operations/`));
    }
  });
});

describe("M2-01 · garde de l'image Docker de studio-rendu", () => {
  const RACINE = resolve(".");
  const RENDU = join(RACINE, "studio-rendu");
  const EXT = [".ts", ".tsx", ".js", ".json", ""];

  /** Sources copiées par les lignes COPY du Dockerfile (chemins relatifs à la racine du dépôt). */
  function sourcesCopiees(): string[] {
    const lignes = lire("deploiement/studio-rendu/Dockerfile").replace(/\\\n/g, " ").split("\n").filter((l) => /^COPY\s/.test(l) && !l.includes("--from="));
    return lignes.flatMap((l) => l.split(/\s+/).slice(1).filter((t) => !t.startsWith("--")).slice(0, -1)).map((t) => t.replace(/\/$/, ""));
  }
  const couvert = (chemin: string, copies: string[]) => copies.some((c) => chemin === c || chemin.startsWith(`${c}/`));

  function fichiers(dossier: string): string[] {
    return readdirSync(dossier).flatMap((n) => {
      const p = join(dossier, n);
      return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
  }
  function importsDe(fichier: string): string[] {
    const source = lire(fichier).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    return [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)"([^"]+)"/gm)].map((m) => m[1]);
  }
  function resoudre(depuis: string, spec: string): string | null {
    const base = resolve(dirname(depuis), spec);
    const candidats = [base, base.replace(/\.js$/, ""), ...EXT.map((e) => base.replace(/\.js$/, "") + e), ...EXT.map((e) => join(base, `index${e}`))];
    return candidats.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
  }
  /** Parcourt tous les fichiers atteignables depuis `departs`. */
  function atteignables(departs: string[]) {
    const vus = new Set<string>();
    const alias: string[] = [];
    const nus: { de: string; spec: string }[] = [];
    const pile = [...departs];
    while (pile.length) {
      const f = pile.pop()!;
      if (vus.has(f)) continue;
      vus.add(f);
      if (!/\.(ts|tsx)$/.test(f)) continue;
      for (const spec of importsDe(f)) {
        if (spec.startsWith("@/")) alias.push(`${relative(RACINE, f)} → ${spec}`);
        else if (spec.startsWith(".")) {
          const cible = resoudre(f, spec);
          if (cible) pile.push(cible);
          else expect.unreachable(`${relative(RACINE, f)} : import introuvable « ${spec} »`);
        } else if (!spec.startsWith("node:")) nus.push({ de: relative(RACINE, f), spec });
      }
    }
    return { vus: [...vus], alias, nus };
  }

  it("tout import sortant de studio-rendu/ (à tout niveau de la chaîne) est couvert par une ligne COPY du Dockerfile", () => {
    const copies = sourcesCopiees();
    const { vus } = atteignables([...fichiers(join(RENDU, "src")), ...fichiers(join(RENDU, "compositions"))]);
    const dehors = vus.filter((f) => !f.startsWith(`${RENDU}/`)).map((f) => relative(RACINE, f));
    expect(dehors).toContain("src/visuels/proprietes-page.ts");
    expect(dehors.filter((f) => !couvert(f, copies)), "fichiers importés mais absents de l'image").toEqual([]);
  });
  it("les règles JSON des visuels sont copiées avec la brique", () => {
    expect(couvert("src/briques/visuels/regles/carrousel-regles.json", sourcesCopiees())).toBe(true);
  });
  it("aucun alias @/ n'est atteignable depuis studio-rendu/src/index.ts (l'image n'a pas d'alias)", () => {
    expect(atteignables([join(RENDU, "src", "index.ts")]).alias).toEqual([]);
  });
  it("tout paquet importé hors Node et hors Remotion figure dans les dépendances de studio-rendu", () => {
    const paquet = JSON.parse(lire("studio-rendu/package.json")) as { dependencies: Record<string, string> };
    const { nus } = atteignables([join(RENDU, "src", "index.ts")]);
    const noms = [...new Set(nus.map((n) => (n.spec.startsWith("@") ? n.spec.split("/").slice(0, 2).join("/") : n.spec.split("/")[0])))];
    expect(noms.filter((n) => !(n in paquet.dependencies)), "paquets absents de studio-rendu/package.json").toEqual([]);
    expect(paquet.dependencies.zod).toMatch(/^\d+\.\d+\.\d+$/);
    // Node ne remonte jamais par /app/studio-rendu/node_modules : un import nu venu d'un fichier hors de studio-rendu/
    // (copié sous /app/src) exige le lien /app/node_modules ET un contrôle de chargement à la construction.
    const dehors = nus.filter((n) => !n.de.replaceAll("\\", "/").startsWith("studio-rendu/"));
    expect(dehors.map((n) => n.spec), "au moins un import nu hors studio-rendu (zod)").toContain("zod");
    if (dehors.length) {
      const dockerfile = lire("deploiement/studio-rendu/Dockerfile");
      expect(dockerfile, `import nu depuis ${dehors[0].de}`).toMatch(/ln -s \/app\/studio-rendu\/node_modules \/app\/node_modules/);
      expect(dockerfile).toMatch(/RUN [^\n]*tsx[^\n]*src\/operations\/visuel-page\.ts[^\n]*visuel-page chargeable/);
      expect(dockerfile, "le contrôle de chargement couvre aussi l'assemblage du PDF").toMatch(/RUN [^\n]*tsx[^\n]*import\('\.\/src\/operations\/assemblage-pdf\.ts'\)/);
    }
  });
});

describe("M2-01 · opération visuel-page", () => {
  let dossier: string;
  beforeEach(async () => {
    dossier = await mkdtemp(join(tmpdir(), "visuel-page-"));
  });
  afterEach(() => rm(dossier, { recursive: true, force: true }));

  const contexte = () => ({ progression: () => {}, dossier, signal: new AbortController().signal });
  const demande = (parametres: Record<string, unknown>, entrees: Record<string, string> = {}): DemandeRendu => ({
    idRendu: "vp-1", operation: "visuel-page", file: "courte", entrees, sortie: { urlDepot: "", cle: "k" }, parametres,
  });
  const proprietes = { spec: CONTENU_ESSAI, index: 1 };

  /** Rendu simulé : écrit un faux JPEG et émet les lignes de mesure voulues, avec le nonce reçu ou un autre. */
  function simule(emettre: (nonce: string, log: (l: string) => void) => void) {
    const appels: { scale: number; jpegQuality: number }[] = [];
    const depots: string[] = [];
    const deps: DependancesVisuelPage = {
      async rendre(o) {
        appels.push({ scale: o.scale, jpegQuality: o.jpegQuality });
        await writeFile(o.sortie, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
        emettre(o.inputProps.nonce as string, o.surLog);
        return { largeur: 1080 * o.scale, hauteur: 1350 * o.scale };
      },
      async deposer(url, chemin) {
        depots.push(`${url}|${(await stat(chemin)).size}`);
      },
    };
    return { op: creerVisuelPage(deps), appels, depots };
  }
  const bonne = (n: number, extra = {}) => (nonce: string, log: (l: string) => void) => log(formaterMesure(nonce, { debordements: n, taillePoliceMin: 26, ...extra }));

  it("rend en ×1 et ×2 (qualité 88 par défaut) et remonte les mesures", async () => {
    const { op, appels } = simule(bonne(0));
    const r1 = await op(demande({ proprietes }), contexte());
    const r2 = await op(demande({ proprietes, scale: 2, jpegQuality: 90 }), contexte());
    expect(appels).toEqual([{ scale: 1, jpegQuality: 88 }, { scale: 2, jpegQuality: 90 }]);
    expect(r1.mesures).toMatchObject({ debordements: 0, largeur: 1080, hauteur: 1350, scale: 1, taillePoliceMin: 26 });
    expect(r2.mesures).toMatchObject({ largeur: 2160, hauteur: 2700, scale: 2 });
    expect(r1.mesures?.octets).toBe(4);
  });
  it("refuse un scale ou une qualité hors des valeurs permises", async () => {
    const { op, appels } = simule(bonne(0));
    for (const p of [{ scale: 3 }, { scale: 1.5 }, { jpegQuality: 70 }, { jpegQuality: 95 }, { inconnu: 1 }]) {
      await expect(op(demande({ proprietes, ...p }), contexte())).rejects.toBeInstanceOf(ErreurRendu);
    }
    expect(appels).toHaveLength(0);
  });
  it("refuse toute URL dans les propriétés, et toute entrée", async () => {
    const { op, appels } = simule(bonne(0));
    const specUrl = { ...CONTENU_ESSAI, alt: "voir https://exemple.org/x" };
    for (const cas of [
      demande({ proprietes: { spec: specUrl, index: 0 } }),
      demande({ proprietes: { ...proprietes, image: "https://exemple.org/a.png" } }),
      demande({ proprietes: { ...proprietes, fond: "data:image/png;base64,AAAA" } }),
      demande({ proprietes: { ...proprietes, x: "//exemple.org/a" } }),
      demande({ proprietes }, { image: "https://exemple.org/a.png" }),
    ]) {
      await expect(op(cas, contexte())).rejects.toMatchObject({ erreur: { code: "refuse", reessayable: false } });
    }
    expect(appels).toHaveLength(0);
  });
  it("refuse un index hors du spec (validerProprietesPage)", async () => {
    const { op } = simule(bonne(0));
    await expect(op(demande({ proprietes: { spec: CONTENU_ESSAI, index: 9 } }), contexte())).rejects.toBeInstanceOf(ErreurRendu);
  });
  it("une ligne de mesure avec un mauvais nonce est ignorée ; sans le bon nonce, la mesure est absente = échec", async () => {
    const faux = simule((_n, log) => log(formaterMesure("nonce-forge", { debordements: 0, taillePoliceMin: 26 })));
    await expect(faux.op(demande({ proprietes }), contexte())).rejects.toMatchObject({ erreur: { code: "inconnu" } });
    expect(faux.depots).toHaveLength(0);
    const mele = simule((n, log) => {
      log(formaterMesure("nonce-forge", { debordements: 0, taillePoliceMin: 99 }));
      log(formaterMesure(n, { debordements: 3, taillePoliceMin: 26 }));
    });
    const r = await mele.op(demande({ proprietes }), contexte());
    expect(r.mesures).toMatchObject({ debordements: 3, taillePoliceMin: 26 });
  });
  it("extraireMesure : ignore le bruit, le JSON illisible et les valeurs non numériques", () => {
    expect(extraireMesure(["bruit", "AXION-MESURE n1 {illisible", formaterMesure("n1", { debordements: 2, taillePoliceMin: 30 })], "n1")).toEqual({ debordements: 2, taillePoliceMin: 30 });
    expect(extraireMesure([`AXION-MESURE n1 ${JSON.stringify({ debordements: "2" })}`], "n1")).toBeNull();
    expect(extraireMesure([], "n1")).toBeNull();
  });
  it("extraireMesure exige les DEUX clés debordements et taillePoliceMin", () => {
    expect(extraireMesure([formaterMesure("n1", { debordements: 0 })], "n1")).toBeNull();
    expect(extraireMesure([formaterMesure("n1", { taillePoliceMin: 26 })], "n1")).toBeNull();
    expect(extraireMesure([formaterMesure("n1", { debordements: 0, taillePoliceMin: 26 })], "n1")).not.toBeNull();
  });
  it("le message d'erreur ne reprend aucun chemin interne", async () => {
    const deps: DependancesVisuelPage = {
      rendre: async () => {
        throw new Error("Échec dans /app/studio-rendu/src/remotion.js et C:\\\\x\\\\y.ts : navigateur introuvable");
      },
      deposer: async () => {},
    };
    const err = await creerVisuelPage(deps)(demande({ proprietes }), contexte()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ErreurRendu);
    expect(JSON.stringify((err as ErreurRendu).erreur.message)).not.toMatch(/\/app|studio-rendu|\.js|\.ts|C:/);
  });
  it("un cancelSignal relie l'annulation à renderStill (selectComposition n'accepte pas de cancelSignal)", () => {
    const src = lire("studio-rendu/src/operations/visuel-page.ts");
    expect(src).toMatch(/makeCancelSignal/);
    expect(src).toMatch(/renderStill\(\{[^}]*cancelSignal/);
    expect(src).toMatch(/addEventListener\("abort"/);
  });
  it("la composition de mesure pose delayRender dans l'initialiseur d'état et mesure après deux images", () => {
    const src = lire("studio-rendu/compositions/visuels/mesure/MesureVisuelPage.tsx");
    expect(src).toMatch(/useState\(\(\) => delayRender\(/);
    expect(src.match(/requestAnimationFrame/g)?.length).toBeGreaterThanOrEqual(2);
  });
  it("assemblage-pdf : 3 Mo au plus par page", () => {
    expect(lire("studio-rendu/src/operations/assemblage-pdf.ts")).toMatch(/OCTETS_MAX_PAGE = 3 \* 1024 \* 1024/);
  });
  it("studio-rendu précharge le paquet de mesure au démarrage, sans bloquer", () => {
    expect(lire("studio-rendu/src/index.ts")).toMatch(/void import\("\.\/paquet-mesure\.js"\)/);
  });
  it("une page qui déborde exprès donne debordements >= 1", async () => {
    const { op } = simule(bonne(2));
    const r = await op(demande({ proprietes }), contexte());
    expect(r.mesures?.debordements).toBeGreaterThanOrEqual(1);
  });
  it("un rendu échoué pour texte coupé (composition) devient un refus non réessayable", async () => {
    const deps: DependancesVisuelPage = {
      rendre: async () => {
        throw new Error("Le texte de la carte « X » déborde de son cadre (hauteur 700 px pour 250 px disponibles)");
      },
      deposer: async () => {},
    };
    await expect(creerVisuelPage(deps)(demande({ proprietes }), contexte())).rejects.toMatchObject({ erreur: { code: "refuse", reessayable: false } });
  });
});
