/**
 * T-EXT-V2-04 · Poste de capture : écrire la maquette créée, la contrôler, préparer l'aperçu.
 * AUCUN navigateur, AUCUN appel réel, 0 € : le capteur est un double ; tout est écrit sous `os.tmpdir()`.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { empreinteDescription, lireApercu } from "@/moteurs/montage-tutoriel-outil/maquette-creee";
import { lireDescriptionMaquette } from "@/moteurs/montage-tutoriel-outil/description-maquette";
import {
  apercuPiece,
  CODE_EMPREINTE,
  CODE_ENVIRONNEMENT,
  CODE_OK,
  CODE_REFUSE,
  dansLeDepot,
  ecrireMaquette,
  nomsPermis,
  planEcriture,
  policesJoignables,
  rapportMaquette,
  type DependancesEcriture,
// @ts-expect-error TS5097 : l'extension .mts est voulue (outil lancé par tsx, comme capturer.mts) ; les types restent résolus.
} from "../../../outils/maquettes-tableaux-de-bord/constructeur/ecrire-maquette.mts";
import { adresseAutorisee, RACINES_PAR_DEFAUT } from "../../../outils/maquettes-tableaux-de-bord/capture/garde";
import { NOMS_FICHIERS } from "../../../outils/maquettes-tableaux-de-bord/constructeur/construire";
import type { NomsNeutres } from "../../../outils/maquettes-tableaux-de-bord/charte/controle";

const RACINE = process.cwd();
const neutres = JSON.parse(readFileSync(join(RACINE, "outils/maquettes-tableaux-de-bord/charte/noms-neutres.json"), "utf8")) as NomsNeutres;

const brut = {
  version: "description-maquette.v1",
  nom: "Espace démo · Atelier",
  entreprise: "Entreprise exemple",
  metier: "Atelier",
  ecrans: [
    {
      id: "accueil",
      modele: "tableau-de-bord",
      titre: "Votre journée",
      zones: [
        { id: "resume", type: "kpi", libelle: "À traiter", donnees: [{ id: "a-traiter", libelle: "À traiter", valeur: 8, exemple: true, etat: "maintenant" }, { id: "avant-tri", libelle: "Avant le tri", valeur: "Tout à la main", etat: "avant" }] },
      ],
    },
    { id: "liste", modele: "tableau-de-bord", titre: "Vos messages", zones: [{ id: "messages", type: "liste", libelle: "Messages", donnees: [{ id: "m-un", libelle: "Devis demandé", valeur: "Nouveau" }] }] },
  ],
  etats: { avant: "Avant : tout à la main", maintenant: "Maintenant : tout est prêt" },
};

const lire = (b: unknown) => {
  const l = lireDescriptionMaquette(b, { interdits: neutres.interdits });
  if (!l.ok) throw new Error(l.erreurs.join(" | "));
  return l.description;
};

const dossiers: string[] = [];
afterEach(() => {
  for (const d of dossiers.splice(0)) rmSync(d, { recursive: true, force: true });
});
const temp = (): string => {
  const d = mkdtempSync(join(tmpdir(), "ecrire-maquette-"));
  dossiers.push(d);
  return d;
};

function sans(): { dep: DependancesEcriture; appels: string[][]; messages: string[] } {
  const appels: string[][] = [];
  const messages: string[] = [];
  return {
    appels,
    messages,
    dep: {
      env: { CI: "true" },
      plateforme: "linux",
      racineDepot: RACINE,
      lancerCapteur: (argv) => {
        appels.push([...argv]);
        return { status: 0 };
      },
      journal: (t) => messages.push(t),
    },
  };
}

function ecrireDescription(dir: string, b: unknown = brut, nom = "description.json"): string {
  const f = join(dir, nom);
  writeFileSync(f, JSON.stringify(b));
  return f;
}

/** Double du capteur : écrit un PNG factice par étape du scénario, comme le vrai (`NN-<étape>.png`). */
function capteurDouble(statut = 0): { dep: Partial<DependancesEcriture>; appels: string[][] } {
  const appels: string[][] = [];
  return {
    appels,
    dep: {
      lancerCapteur: (argv) => {
        appels.push([...argv]);
        if (statut !== 0) return { status: statut };
        const scenario = JSON.parse(readFileSync(argv[argv.indexOf("--scenario") + 1]!, "utf8")) as { etapes: { id: string }[] };
        const sortie = join(argv[argv.indexOf("--sortie") + 1]!, "atelier-abc123");
        mkdirSync(sortie, { recursive: true });
        scenario.etapes.forEach((e, i) => writeFileSync(join(sortie, `${String(i + 1).padStart(2, "0")}-${e.id}.png`), "png"));
        return { status: 0 };
      },
    },
  };
}

describe("planEcriture (pur)", () => {
  it("lit les arguments et ne garde « attendue » que si elle est donnée", () => {
    const p = planEcriture(["--description", "d.json", "--sortie", "/tmp/s", "--apercu", "--attendue", "abc"]);
    expect(p).toEqual({ ok: true, args: { description: "d.json", sortie: "/tmp/s", apercu: true, attendue: "abc" } });
    const q = planEcriture(["--description", "d.json", "--sortie", "/tmp/s"]);
    expect(q).toEqual({ ok: true, args: { description: "d.json", sortie: "/tmp/s", apercu: false } });
  });

  it("refuse un argument inconnu, une valeur manquante ou un argument obligatoire absent", () => {
    for (const argv of [["--sortie", "/tmp/s"], ["--description", "d.json"], ["--description", "d.json", "--sortie"], ["--description", "d.json", "--sortie", "/tmp/s", "--calage", "c.json"], ["--description", "d.json", "--sortie", "/tmp/s", "--attendue", "--apercu"]]) {
      const p = planEcriture(argv);
      expect(p.ok).toBe(false);
    }
  });
});

describe("fonctions pures", () => {
  it("dansLeDepot : le dépôt et dessous sont refusés, le reste non", () => {
    expect(dansLeDepot("/depot/x/y", "/depot")).toBe(true);
    expect(dansLeDepot("/depot", "/depot")).toBe(true);
    expect(dansLeDepot("/depot/../ailleurs", "/depot")).toBe(false);
    expect(dansLeDepot("/depot-autre/x", "/depot")).toBe(false);
  });

  it("rapportMaquette : ok seulement avec le code 0", () => {
    expect(rapportMaquette(0, []).ok).toBe(true);
    expect(rapportMaquette(4, ["x"])).toMatchObject({ ok: false, code: 4, erreurs: ["x"] });
  });

  it("nomsPermis : noms neutres + écrans d'outils (produit, organisation, vues)", () => {
    const n = nomsPermis(neutres, { maquettes: { x: { produit: "Espace démo · Boîte", organisation: "Entreprise exemple", vues: { a: "Espace démo · Agenda" } } } });
    expect(n).toEqual(expect.arrayContaining(["Espace démo · Courriels", "Espace démo · Boîte", "Espace démo · Agenda", "Entreprise exemple"]));
    expect(nomsPermis(neutres, null).length).toBeGreaterThan(0);
  });

  it("apercuPiece : un « avant » par écran et un « maintenant », relu par lireApercu", () => {
    const d = lire(brut);
    const png = ["apercu/x/01-ecran-accueil.png", "apercu/x/02-ecran-liste.png", "apercu/x/03-maintenant.png"];
    const piece = apercuPiece(d, png, { ok: true, defauts: [] });
    expect(piece.images.map((i) => [i.ecranId, i.etat])).toEqual([["accueil", "avant"], ["liste", "avant"], ["accueil", "maintenant"]]);
    expect(piece.empreinteDescription).toBe(empreinteDescription(d));
    expect(lireApercu(JSON.parse(JSON.stringify(piece))).ok).toBe(true);
  });
});

describe("ecrireMaquette (dossier temporaire, capteur en double)", () => {
  it("écrit les 4 fichiers + maquette-creee.json ; deux fois la même description : mêmes empreintes", () => {
    const dir = temp();
    const f = ecrireDescription(dir);
    const { dep } = sans();
    const a = join(dir, "a");
    const b = join(dir, "b");
    expect(ecrireMaquette(["--description", f, "--sortie", a], dep)).toBe(CODE_OK);
    expect(ecrireMaquette(["--description", f, "--sortie", b], dep)).toBe(CODE_OK);
    expect(readdirSync(join(a, "maquette")).sort()).toEqual([...NOMS_FICHIERS].sort());
    const ra = JSON.parse(readFileSync(join(a, "maquette-creee.json"), "utf8"));
    const rb = JSON.parse(readFileSync(join(b, "maquette-creee.json"), "utf8"));
    expect(ra).toEqual(rb);
    expect(ra.empreinteDescription).toBe(empreinteDescription(lire(brut)));
    expect(Object.keys(ra.fichiers).sort()).toEqual([...NOMS_FICHIERS].sort());
    expect(ra.controle).toEqual({ ok: true, defauts: [] });
    expect(ra.apercu).toBeUndefined();
    expect(existsSync(join(a, "apercu-piece.json"))).toBe(false);
    expect(JSON.parse(readFileSync(join(a, "rapport.json"), "utf8"))).toMatchObject({ ok: true, code: 0 });
  });

  it("la maquette écrite est vivante (option V2-03) et sans réseau", () => {
    const dir = temp();
    const f = ecrireDescription(dir);
    const { dep } = sans();
    ecrireMaquette(["--description", f, "--sortie", join(dir, "s")], dep);
    const html = readFileSync(join(dir, "s/maquette/index.html"), "utf8");
    const tout = NOMS_FICHIERS.map((n) => readFileSync(join(dir, "s/maquette", n), "utf8")).join("\n");
    expect(html).toContain("vivant");
    expect(tout).not.toMatch(/https?:\/\/|fetch\(|XMLHttpRequest/);
  });

  it("styles.css écrit hors du dépôt : chaque police pointe un fichier qui existe, sous une racine acceptée par le capteur", () => {
    const dir = temp();
    const { dep } = sans();
    expect(ecrireMaquette(["--description", ecrireDescription(dir), "--sortie", join(dir, "s")], dep)).toBe(CODE_OK);
    const dossierMaquette = join(dir, "s/maquette");
    const css = readFileSync(join(dossierMaquette, "styles.css"), "utf8");
    const urls = [...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1]!);
    const polices = urls.filter((u) => /\.woff2?$/i.test(u));
    expect(polices.length).toBeGreaterThan(0);
    // Racines du capteur + le dossier de la maquette, comme le fait capturer.mts.
    const racines = [...RACINES_PAR_DEFAUT.map((r) => resolve(RACINE, r)), dossierMaquette];
    for (const u of polices) {
      expect(u.startsWith("file://"), u).toBe(true);
      expect(existsSync(fileURLToPath(u)), u).toBe(true);
      expect(adresseAutorisee(u, racines), u).toBe(true);
    }
    expect(css).toContain("manrope-latin.woff2");
    expect(css).not.toContain("../../../src/app/polices");
  });

  it("policesJoignables : seules les polices relatives de la charte sont réécrites", () => {
    const css = '@font-face{src:url("../../../src/app/polices/manrope-latin.woff2") format("woff2")}.a{background:url(data:image/png;base64,AA)}';
    const sortie = policesJoignables(css, "/depot");
    expect(sortie).toContain('url("file:///depot/src/app/polices/manrope-latin.woff2")');
    expect(sortie).toContain("url(data:image/png;base64,AA)");
    expect(policesJoignables(".b{color:red}", "/depot")).toBe(".b{color:red}");
  });

  it("sans « --apercu » : le capteur n'est jamais lancé", () => {
    const dir = temp();
    const { dep, appels } = sans();
    expect(ecrireMaquette(["--description", ecrireDescription(dir), "--sortie", join(dir, "s")], dep)).toBe(CODE_OK);
    expect(appels).toEqual([]);
  });

  it("« --attendue » fausse : code 7, aucun fichier de maquette", () => {
    const dir = temp();
    const { dep, messages } = sans();
    const sortie = join(dir, "s");
    const code = ecrireMaquette(["--description", ecrireDescription(dir), "--sortie", sortie, "--attendue", "pas-la-bonne"], dep);
    expect(code).toBe(CODE_EMPREINTE);
    expect(existsSync(join(sortie, "maquette"))).toBe(false);
    expect(existsSync(join(sortie, "maquette-creee.json"))).toBe(false);
    expect(JSON.parse(readFileSync(join(sortie, "rapport.json"), "utf8"))).toMatchObject({ ok: false, code: 7 });
    expect(messages.join(" ")).toContain("validée");
  });

  it("« --attendue » juste : écrit la maquette", () => {
    const dir = temp();
    const { dep } = sans();
    const code = ecrireMaquette(["--description", ecrireDescription(dir), "--sortie", join(dir, "s"), "--attendue", empreinteDescription(lire(brut))], dep);
    expect(code).toBe(CODE_OK);
  });

  it("« --attendue » : même description, clés dans un autre ordre = même empreinte", () => {
    const dir = temp();
    const { dep } = sans();
    const melange = { etats: brut.etats, ecrans: brut.ecrans, metier: brut.metier, entreprise: brut.entreprise, nom: brut.nom, version: brut.version };
    expect(ecrireMaquette(["--description", ecrireDescription(dir, melange), "--sortie", join(dir, "s"), "--attendue", empreinteDescription(lire(brut))], dep)).toBe(CODE_OK);
  });

  it("tutoiement (« Ton atelier ») : code 4, rapport.json contient « tutoiement », aucune maquette", () => {
    const dir = temp();
    const { dep } = sans();
    const mauvais = { ...brut, ecrans: [{ ...brut.ecrans[0]!, titre: "Ton atelier" }, brut.ecrans[1]] };
    const sortie = join(dir, "s");
    expect(ecrireMaquette(["--description", ecrireDescription(dir, mauvais), "--sortie", sortie], dep)).toBe(CODE_REFUSE);
    expect(readFileSync(join(sortie, "rapport.json"), "utf8")).toContain("tutoiement");
    expect(existsSync(join(sortie, "maquette"))).toBe(false);
  });

  it("nom réel interdit ou nom propre non choisi : code 4", () => {
    const dir = temp();
    const { dep } = sans();
    const marque = { ...brut, ecrans: [{ ...brut.ecrans[0]!, titre: "Votre Velora" }, brut.ecrans[1]] };
    expect(ecrireMaquette(["--description", ecrireDescription(dir, marque), "--sortie", join(dir, "s1")], dep)).toBe(CODE_REFUSE);
    const propre = { ...brut, ecrans: [{ ...brut.ecrans[0]!, titre: "Votre journée avec Martine" }, brut.ecrans[1]] };
    expect(ecrireMaquette(["--description", ecrireDescription(dir, propre, "d2.json"), "--sortie", join(dir, "s2")], dep)).toBe(CODE_REFUSE);
  });

  it("description illisible ou arguments absents : code 4", () => {
    const dir = temp();
    const { dep } = sans();
    expect(ecrireMaquette(["--description", join(dir, "absent.json"), "--sortie", join(dir, "s")], dep)).toBe(CODE_REFUSE);
    const f = join(dir, "casse.json");
    writeFileSync(f, "{ pas du json");
    expect(ecrireMaquette(["--description", f, "--sortie", join(dir, "s2")], dep)).toBe(CODE_REFUSE);
    expect(ecrireMaquette(["--description", f], dep)).toBe(CODE_REFUSE);
  });

  it("« --sortie » dans le dépôt : code 3, rien écrit", () => {
    const dir = temp();
    const { dep } = sans();
    const dedans = join(RACINE, "sortie-ecrire-maquette-test");
    expect(ecrireMaquette(["--description", ecrireDescription(dir), "--sortie", dedans], dep)).toBe(CODE_ENVIRONNEMENT);
    expect(existsSync(dedans)).toBe(false);
  });

  it("hors cloud et hors CI, ou sous Windows : code 3, rien écrit", () => {
    const dir = temp();
    const { dep } = sans();
    const sortie = join(dir, "s");
    expect(ecrireMaquette(["--description", ecrireDescription(dir), "--sortie", sortie], { ...dep, env: {} })).toBe(CODE_ENVIRONNEMENT);
    expect(ecrireMaquette(["--description", ecrireDescription(dir), "--sortie", sortie], { ...dep, plateforme: "win32" })).toBe(CODE_ENVIRONNEMENT);
    expect(existsSync(sortie)).toBe(false);
  });

  it("« --apercu » : lance le capteur sans --calage, un PNG par écran et un « maintenant », apercu-piece.json relu", () => {
    const dir = temp();
    const { dep: base } = sans();
    const double = capteurDouble();
    const sortie = join(dir, "s");
    const code = ecrireMaquette(["--description", ecrireDescription(dir), "--sortie", sortie, "--apercu"], { ...base, ...double.dep });
    expect(code).toBe(CODE_OK);
    expect(double.appels).toHaveLength(1);
    const argv = double.appels[0]!;
    expect(argv).not.toContain("--calage");
    expect(argv).toEqual(["--maquette", join(sortie, "maquette"), "--scenario", join(sortie, "apercu-scenario.json"), "--sortie", join(sortie, "apercu")]);
    const piece = JSON.parse(readFileSync(join(sortie, "apercu-piece.json"), "utf8"));
    const lu = lireApercu(piece);
    expect(lu.ok).toBe(true);
    if (!lu.ok) return;
    const images = lu.apercu.images;
    expect(images.filter((i) => i.etat === "avant").map((i) => i.ecranId)).toEqual(["accueil", "liste"]);
    expect(images.filter((i) => i.etat === "maintenant")).toHaveLength(1);
    for (const im of images) expect(existsSync(join(sortie, im.cle))).toBe(true);
    const creee = JSON.parse(readFileSync(join(sortie, "maquette-creee.json"), "utf8"));
    expect(creee.apercu).toHaveLength(3);
    expect(creee.empreinteDescription).toBe(lu.apercu.empreinteDescription);
  });

  it("le code du capteur est renvoyé tel quel, sans pièce d'aperçu", () => {
    const dir = temp();
    const { dep: base } = sans();
    for (const statut of [2, 5, 6]) {
      const sortie = join(dir, `s${statut}`);
      const code = ecrireMaquette(["--description", ecrireDescription(dir), "--sortie", sortie, "--apercu"], { ...base, ...capteurDouble(statut).dep });
      expect(code).toBe(statut);
      expect(existsSync(join(sortie, "apercu-piece.json"))).toBe(false);
    }
  });

  it("un capteur tué (statut nul) donne le code 1", () => {
    const dir = temp();
    const { dep } = sans();
    expect(ecrireMaquette(["--description", ecrireDescription(dir), "--sortie", join(dir, "s"), "--apercu"], { ...dep, lancerCapteur: () => ({ status: null }) })).toBe(1);
  });
});

describe("le fichier lui-même", () => {
  const source = readFileSync(join(RACINE, "outils/maquettes-tableaux-de-bord/constructeur/ecrire-maquette.mts"), "utf8");

  it("n'ouvre aucun navigateur, aucun réseau, aucun fournisseur ; appelle le capteur comme processus, sans --calage", () => {
    expect(source).not.toMatch(/chromium|playwright|fetch\(|https?:\/\/|anthropic|heygen|elevenlabs/i);
    expect(source).toContain("capture/capturer.mts");
    expect(source).not.toContain("--calage");
  });

  it("construit en mode vivant et ne lance rien à l'import", () => {
    expect(source).toContain("{ vivant: true }");
    expect(source).toMatch(/import\.meta\.url === pathToFileURL/);
  });
});
