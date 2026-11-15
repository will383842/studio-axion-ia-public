/**
 * G1-01 · « Inscrit partout » : chaque format du registre doit figurer dans chacune des tables dispersées
 * (code, moteur, ratios, LUT, composition, navigation) et le rendu ne doit lire que des fichiers copiés dans l'image (règle R-2).
 *
 * Lecture seule de `deploiement/` et `.github/` ; aucun de ces fichiers n'est modifié.
 * (Le Dockerfile n'est lu que comme du texte ; `.github/workflows/*.yml` n'est pas lu par ce test.)
 *
 * Les oublis déjà présents au 15/11/2026 sont écrits en dur dans EXCEPTIONS : le test échoue sur tout oubli NOUVEAU
 * et sur toute exception devenue fausse (la liste ne fait que rétrécir). Corriger un oubli = G1-05a à e / G1-07 / décision de Williams.
 *
 * Composition : seuls les identifiants déclarés par une constante `COMPOSITION_*` du moteur sont contrôlés ; un moteur qui n'en déclare aucune n'est pas signalé.
 *
 * NON SUIVI par la règle R-2 : les imports non relatifs (paquets npm), les chemins calculés (`import(variable)`),
 * les fichiers de `studio-rendu/` hors `src/` et `compositions/` (scripts, essais-visuels), et les alias de `tsconfig` autres que `@/`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { listerFormats } from "@/formats";
import { codeDuFormat } from "@/formats/registre-codes";
import { formatAvocat } from "@/formats/avocat";
import { moteurExiste, obtenirMoteur } from "@/moteurs";
import { RENDU_COULEUR } from "@/briques/charte/rendu-couleur";
import type { DefinitionFormat } from "@/formats/types";

const RACINE = resolve(__dirname, "../..");
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), "utf8");

export type TableOubliee = "code" | "moteur" | "ratios" | "LUT" | "composition" | "navigation";
interface Oubli {
  format: string;
  table: TableOubliee;
}
const cle = (o: Oubli) => `${o.format} | ${o.table}`;

/** Un oubli constaté aujourd'hui : « format, table, constaté le 15/11/2026 ». */
const CONSTATE = "15/11/2026";
const EXCEPTIONS: { format: string; table: TableOubliee; constateLe: string }[] = [];

// ---------------------------------------------------------------------------------------------------------------------
// Lectures de texte (jamais d'import de `deploiement/`)
// ---------------------------------------------------------------------------------------------------------------------

const TEXTE_RACINE = lire("studio-rendu/compositions/Racine.tsx");
const TEXTE_INDEX_COMPOSITIONS = lire("studio-rendu/compositions/index.ts");

/**
 * Identifiants de composition enregistrés (`<Composition id="X"`, `<Still id="X"`) : `Racine.tsx`, `index.ts`, et les fichiers
 * `Compositions.tsx` des dossiers de formats que `Racine.tsx` importe (lecture du texte de tout `studio-rendu/compositions/**`).
 */
function compositionsEnregistrees(): Set<string> {
  const ids = new Set<string>();
  const textes = [TEXTE_RACINE, TEXTE_INDEX_COMPOSITIONS, ...fichiersSousDossier("studio-rendu/compositions", /\.tsx?$/).map(lire)];
  for (const texte of textes) {
    // Toute chaîne littérale entre guillemets : `id="X"`, `id: "X"`, ou un objet de noms (`{ ecran: "CasConcretEcran" }`).
    for (const m of texte.matchAll(/["']([A-Za-z][A-Za-z0-9_-]*)["']/g)) ids.add(m[1]);
  }
  return ids;
}

function fichiersSousDossier(dossier: string, extensions: RegExp): string[] {
  const abs = join(RACINE, dossier);
  if (!existsSync(abs)) return [];
  const sortie: string[] = [];
  for (const nom of readdirSync(abs)) {
    const chemin = join(dossier, nom);
    const s = statSync(join(RACINE, chemin));
    if (s.isDirectory()) sortie.push(...fichiersSousDossier(chemin, extensions));
    else if (extensions.test(nom) && !/\.test\.tsx?$/.test(nom)) sortie.push(chemin);
  }
  return sortie;
}

/**
 * Identifiants de composition déclarés par le code d'un moteur (`src/moteurs/<moteur>/**`) : chaînes affectées à une constante
 * `COMPOSITION_*` / `ID_COMPOSITION_*`. Vide = le moteur n'en déclare aucune par constante (facecam, facecam-animee, image-video :
 * leurs compositions sont choisies plus bas dans la chaîne ; NON VÉRIFIABLE par texte, donc jamais signalé).
 */
function compositionsDuMoteur(moteur: string): string[] {
  const ids = new Set<string>();
  for (const f of fichiersSousDossier(`src/moteurs/${moteur}`, /\.tsx?$/)) {
    const t = lire(f);
    for (const m of t.matchAll(/\b(?:ID_)?COMPOSITION_[A-Z_]*\s*=\s*["']([A-Za-z0-9_-]+)["']/g)) ids.add(m[1]);
  }
  return [...ids];
}

/** Préfixes de `ACTIF_SUR_VIDEOS` (lus dans le texte de `navigation.ts`). */
function prefixesNavigation(): string[] {
  const m = /ACTIF_SUR_VIDEOS\s*:\s*string\[\]\s*=\s*\[([^\]]*)\]/.exec(lire("src/components/coquille/navigation.ts"));
  if (!m) throw new Error("ACTIF_SUR_VIDEOS introuvable dans navigation.ts : le test doit suivre le changement");
  return [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
}
const TEXTE_NAVIGATION = lire("src/components/coquille/navigation.ts");

// ---------------------------------------------------------------------------------------------------------------------
// Les six tables
// ---------------------------------------------------------------------------------------------------------------------

export function oublisDesFormats(formats: readonly DefinitionFormat[]): Oubli[] {
  const oublis: Oubli[] = [];
  const compos = compositionsEnregistrees();
  const prefixes = prefixesNavigation();
  const ajouter = (format: string, table: TableOubliee) => oublis.push({ format, table });

  for (const f of formats) {
    // 1. code de classement
    if (!codeDuFormat(f.id)) ajouter(f.id, "code");

    // 2. moteur
    const moteurOk = moteurExiste(f.moteur);
    if (!moteurOk) ajouter(f.id, "moteur");

    // 3. ratios de la fiche ⊆ ratios du moteur
    if (moteurOk) {
      const ratiosMoteur = obtenirMoteur(f.moteur).capacites.ratios;
      if (!f.ratios.every((r) => ratiosMoteur.includes(r))) ajouter(f.id, "ratios");
    }

    // 4. LUT : une entrée dans la table, sinon « rendu neutre des formats inconnus »
    if (!(f.id in RENDU_COULEUR)) ajouter(f.id, "LUT");

    // 5. composition du moteur enregistrée dans studio-rendu (le moteur « simulation » ne rend rien)
    if (moteurOk && f.moteur !== "simulation") {
      const ids = compositionsDuMoteur(f.moteur);
      if (!ids.every((id) => compos.has(id))) ajouter(f.id, "composition");
    }

    // 6. navigation : adresse de création présente quand le format est actif (ouvert dans la navigation)
    const actif = f.statut === "actif" || (f.statut === "masque" && f.ouvertDansLaNavigation === true);
    if (actif) {
      const adresse = f.adresseCreation ?? `/nouvelle/${f.id}`;
      const couvert = prefixes.some((p) => adresse === p || adresse.startsWith(`${p}/`)) || TEXTE_NAVIGATION.includes(adresse) || adresse.startsWith("/nouvelle/");
      if (!couvert) ajouter(f.id, "navigation");
    }
  }
  return oublis;
}

describe("inscrit partout : tables par format", () => {
  const formats = listerFormats({ inclureMasques: true, inclureReservesAWill: true });
  const oublis = oublisDesFormats(formats);

  it("ne laisse aucun oubli nouveau (hors exceptions datées)", () => {
    const permis = new Set(EXCEPTIONS.map((e) => cle({ format: e.format, table: e.table })));
    const nouveaux = oublis.filter((o) => !permis.has(cle(o))).map(cle);
    expect(nouveaux, "oubli(s) d'inscription nouveau(x) : inscrire le format dans la table citée").toEqual([]);
  });

  it("n'a aucune exception devenue fausse (la liste ne fait que rétrécir)", () => {
    const reels = new Set(oublis.map(cle));
    const perimees = EXCEPTIONS.filter((e) => !reels.has(cle({ format: e.format, table: e.table }))).map((e) => `${e.format} | ${e.table}`);
    expect(perimees, "exception(s) à retirer : l'oubli est corrigé").toEqual([]);
  });

  it("date chaque exception du jour de constat", () => {
    for (const e of EXCEPTIONS) expect(e.constateLe).toBe(CONSTATE);
  });
});

describe("inscrit partout : la détection marche (format fictif)", () => {
  afterEach(() => vi.resetModules());

  async function registreNeuf() {
    vi.resetModules();
    return await import("@/formats");
  }

  it("un format fictif sans code ni LUT fait apparaître exactement code + LUT (masqué : pas de navigation)", async () => {
    const reg = await registreNeuf();
    reg.inscrireFormat({ ...formatAvocat, id: "fictif-g1-01", statut: "masque", reserveAWill: false, ouvertDansLaNavigation: false });
    const fictifs = reg.listerFormats({ inclureMasques: true, inclureReservesAWill: true }).filter((f) => f.id === "fictif-g1-01");
    expect(oublisDesFormats(fictifs).map(cle).sort()).toEqual(["fictif-g1-01 | LUT", "fictif-g1-01 | code"]);
  });

  it("actif et sans adresse déclarée : la navigation s'ajoute aux oublis seulement si l'adresse n'y figure pas", async () => {
    const reg = await registreNeuf();
    reg.inscrireFormat({ ...formatAvocat, id: "fictif-g1-01", statut: "actif", reserveAWill: false, adresseCreation: "/page-inconnue-g1-01" });
    const fictifs = reg.listerFormats({ inclureMasques: true, inclureReservesAWill: true }).filter((f) => f.id === "fictif-g1-01");
    expect(oublisDesFormats(fictifs).map(cle).sort()).toEqual(["fictif-g1-01 | LUT", "fictif-g1-01 | code", "fictif-g1-01 | navigation"]);
  });

  it("un moteur inconnu et des ratios hors moteur sont détectés", async () => {
    const reg = await registreNeuf();
    reg.inscrireFormat({ ...formatAvocat, id: "fictif-g1-01", statut: "masque", reserveAWill: false, moteur: "moteur-inexistant" });
    const fictifs = reg.listerFormats({ inclureMasques: true, inclureReservesAWill: true }).filter((f) => f.id === "fictif-g1-01");
    expect(oublisDesFormats(fictifs).map(cle)).toContain("fictif-g1-01 | moteur");
    const ratios = oublisDesFormats([{ ...formatAvocat, id: "fictif-ratio", ratios: ["1:1" as never, "21:9" as never] }]);
    expect(ratios.map(cle)).toContain("fictif-ratio | ratios");
  });

  it("lit bien les compositions des moteurs et celles du rendu (la vérification n'est pas vide)", () => {
    const compos = compositionsEnregistrees();
    for (const [moteur, id] of [["montage-tutoriel-outil", "TutorielOutil"], ["montage-demo-facecam", "DemoFacecam"], ["montage-cas-concret", "CasConcretEcran"], ["montage-tableau", "TableauScene"]]) {
      expect(compositionsDuMoteur(moteur)).toContain(id);
      expect(compos.has(id)).toBe(true);
    }
    expect(compos.has("CompositionInventeeG101")).toBe(false);
  });

  it("n'a pas pollué le registre réel", () => {
    expect(listerFormats({ inclureMasques: true, inclureReservesAWill: true }).some((f) => f.id.startsWith("fictif-"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Règle R-2 : ce que le rendu importe depuis `src/` doit être copié dans l'image, sans alias `@/`
// ---------------------------------------------------------------------------------------------------------------------

/** Sources des lignes `COPY` du Dockerfile (texte seul), relatives à la racine du dépôt, sans `--flags` ni destination. */
export function sourcesCopiees(dockerfile: string): string[] {
  const sources: string[] = [];
  const logique = dockerfile.replace(/\\\r?\n/g, " ");
  for (const ligne of logique.split(/\r?\n/)) {
    if (!/^\s*COPY\s/i.test(ligne)) continue;
    const jetons = ligne.trim().split(/\s+/).slice(1).filter((j) => !j.startsWith("--"));
    if (jetons.length < 2) continue;
    sources.push(...jetons.slice(0, -1).map((j) => j.replace(/\/+$/, "")));
  }
  return sources;
}

const EXTENSIONS_RESOLUES = ["", ".ts", ".tsx", ".json", ".js", ".mjs", "/index.ts", "/index.tsx", "/index.js"];
function resoudreFichier(base: string): string | null {
  // `studio-rendu/src` écrit ses imports en `.js` (ESM) alors que le fichier est `.ts` / `.tsx`.
  if (base.endsWith(".js")) {
    const sans = base.slice(0, -3);
    for (const ext of [".ts", ".tsx"]) if (existsSync(sans + ext)) return sans + ext;
  }
  for (const ext of EXTENSIONS_RESOLUES) {
    const c = base + ext;
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;

export interface ResultatR2 {
  /** Fichiers sous `src/` atteints par imports relatifs depuis `studio-rendu/`, avec le premier importeur. */
  atteints: Map<string, string>;
  /** Fichiers qui utilisent `@/` (rendu ou atteints). */
  aliases: string[];
  /** Imports relatifs qui ne se résolvent à aucun fichier. */
  introuvables: string[];
}

export function analyserR2(racine: string = RACINE): ResultatR2 {
  const atteints = new Map<string, string>();
  const aliases = new Set<string>();
  const introuvables: string[] = [];
  const vus = new Set<string>();
  const dossierSrc = join(racine, "src") + sep;

  const departs = [...fichiersSousDossier("studio-rendu/src", /\.tsx?$/), ...fichiersSousDossier("studio-rendu/compositions", /\.tsx?$/)].map((f) => join(racine, f));
  const pile = departs.map((f) => ({ f, de: relative(racine, f) }));
  while (pile.length) {
    const { f, de } = pile.pop()!;
    if (vus.has(f)) continue;
    vus.add(f);
    if (!/\.tsx?$/.test(f)) continue;
    const texte = readFileSync(f, "utf8");
    for (const m of texte.matchAll(IMPORT)) {
      const spec = m[1];
      if (spec.startsWith("@/")) {
        aliases.add(relative(racine, f));
        continue;
      }
      if (!spec.startsWith(".")) continue; // paquet npm : non suivi
      const cible = resoudreFichier(resolve(dirname(f), spec));
      if (!cible) {
        introuvables.push(`${relative(racine, f)} -> ${spec}`);
        continue;
      }
      if (cible.startsWith(dossierSrc)) {
        const rel = relative(racine, cible);
        if (!atteints.has(rel)) atteints.set(rel, relative(racine, f));
      }
      pile.push({ f: cible, de: relative(racine, f) });
    }
    void de;
  }
  return { atteints, aliases: [...aliases].sort(), introuvables };
}

function estCouvert(fichier: string, copies: string[]): boolean {
  return copies.some((c) => fichier === c || fichier.startsWith(`${c}/`));
}

describe("règle R-2 : ce que le rendu importe est copié dans l'image", () => {
  const copies = sourcesCopiees(lire("deploiement/studio-rendu/Dockerfile"));
  const r2 = analyserR2();

  it("lit bien des lignes COPY et suit des imports sous src/", () => {
    expect(copies.length).toBeGreaterThan(10);
    expect(r2.atteints.size).toBeGreaterThan(20);
  });

  it("chaque fichier de src/ importé par le rendu est couvert par une ligne COPY (hors exceptions)", () => {
    const manquants = [...r2.atteints].filter(([f]) => !estCouvert(f, copies)).map(([f, par]) => `${f} (importé par ${par})`);
    expect(manquants).toEqual([...EXCEPTIONS_R2_COPY]);
  });

  it("aucun fichier lu par le rendu n'utilise l'alias @/ (hors exceptions)", () => {
    expect(r2.aliases).toEqual([...EXCEPTIONS_R2_ALIAS]);
  });

  it("aucun import relatif du rendu ne reste introuvable", () => {
    expect(r2.introuvables).toEqual([]);
  });

  it("détecte un fichier non copié et un alias sur un faux dépôt", () => {
    expect(estCouvert("src/briques/neuf/x.ts", ["src/briques/motion", "src/lib/lut3d.ts"])).toBe(false);
    expect(estCouvert("src/briques/motion/x.ts", ["src/briques/motion"])).toBe(true);
    expect(estCouvert("src/lib/lut3d.ts", ["src/lib/lut3d.ts"])).toBe(true);
    expect(sourcesCopiees("COPY --chown=a:b src/x /app/src/x\nCOPY a.ts b.ts /app/\nRUN echo")).toEqual(["src/x", "a.ts", "b.ts"]);
  });
});

/** Exceptions datées du 15/11/2026 pour la règle R-2 (importeurs cités) ; vide = aucune. */
const EXCEPTIONS_R2_COPY: string[] = [];
const EXCEPTIONS_R2_ALIAS: string[] = [];
