import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ErreurRendu, OPERATIONS, type DemandeRendu } from "../../studio-rendu/src/contrat";
import { colonneExacteLaPlusProche, creerToileContinue, erreurDeValidationToile, grapheDecoupe, reglagesToile, verifierDepotsPages, type DependancesToile } from "../../studio-rendu/src/operations/toile-continue";
import { PREFIXE_MESURE } from "../../studio-rendu/compositions/visuels/mesure/protocole";
import { GABARITS } from "../../src/briques/visuels/continu/registre-gabarits";
import { PARCOURS } from "../../src/briques/visuels/continu/registre-parcours";
import { VERSION_TOILE_SOCLE } from "../../src/domaine/visuels/continu/version";

const lire = (chemin: string) => readFileSync(chemin, "utf8");
const depot = (i: number) => ({ cle: `pages/p${i}.jpg`, urlDepot: `https://r2/pages/p${i}.jpg?sig=x` });

describe("continu P2 : réglages de l'opération toile-continue", () => {
  it("qualité 95 par défaut, bornée de 90 à 95", () => {
    expect(reglagesToile({ proprietes: {}, depotsPages: [] })).toEqual({ qualite: 95 });
    expect(reglagesToile({ proprietes: {}, depotsPages: [], qualite: 90 })).toEqual({ qualite: 90 });
  });
  it.each([{ qualite: 80 }, { qualite: 96 }, { qualite: 92.5 }, { qualite: "95" }])("refuse %o", (p) => {
    expect(() => reglagesToile({ proprietes: {}, depotsPages: [], ...p })).toThrow(ErreurRendu);
  });
  it("refuse un paramètre inconnu, et scale (jamais ×2 : la toile dépasserait 16 384 px)", () => {
    expect(() => reglagesToile({ proprietes: {}, depotsPages: [], zzz: 1 })).toThrow(/inconnu/);
    expect(() => reglagesToile({ proprietes: {}, depotsPages: [], scale: 1 })).toThrow(/scale/);
  });
});

describe("continu P2 : adresses de dépôt des pages", () => {
  it("une adresse permise par page, normalisée", () => {
    expect(verifierDepotsPages([depot(1), depot(2), depot(3)], 3)).toEqual([depot(1), depot(2), depot(3)]);
  });
  it("refuse un nombre d'adresses différent du nombre de pages", () => {
    expect(() => verifierDepotsPages([depot(1), depot(2)], 3)).toThrow(/3 adresses/);
    expect(() => verifierDepotsPages("x", 3)).toThrow(ErreurRendu);
  });
  it("refuse une adresse http: (hors poste d'essai) et une adresse hors stockage", () => {
    expect(() => verifierDepotsPages([depot(1), { cle: "a", urlDepot: "http://r2/a.jpg" }, depot(3)], 3)).toThrow(/stockage/);
    expect(() => verifierDepotsPages([depot(1), depot(2), { cle: "a", urlDepot: "https://exemple.com/a.jpg" }], 3)).toThrow(/stockage/);
  });
  it("refuse une entrée qui n'a pas exactement { cle, urlDepot }", () => {
    expect(() => verifierDepotsPages([depot(1), depot(2), { ...depot(3), autre: 1 }], 3)).toThrow(ErreurRendu);
    expect(() => verifierDepotsPages([depot(1), depot(2), { urlDepot: depot(3).urlDepot }], 3)).toThrow(ErreurRendu);
  });
});

describe("continu P2 : découpe exacte", () => {
  it("grapheDecoupe(2, 1350) prend les colonnes [2160, 3240)", () => {
    expect(grapheDecoupe(2, 1350)).toContain("crop=1080:1350:2160:0");
    expect(grapheDecoupe(0, 1440)).toContain("crop=1080:1440:0:0");
  });
});

describe("continu P2 : erreurs de validation", () => {
  it("une version de toile différente est indisponible, à réessayer ; le reste est un refus", () => {
    expect(erreurDeValidationToile("Version de toile indisponible : socle x").erreur).toMatchObject({ code: "indisponible", reessayable: true });
    expect(erreurDeValidationToile("Toile invalide : la page 1 : …").erreur).toMatchObject({ code: "refuse", reessayable: false });
  });
  it("une version absente ou invalide est un refus, pas une panne à réessayer", () => {
    for (const m of ["Version de toile absente ou invalide", "Version de toile absente : gabarit X01", "Version de toile invalide : objet attendu"]) {
      expect(erreurDeValidationToile(m).erreur, m).toMatchObject({ code: "refuse", reessayable: false });
    }
  });
});

describe("continu P2 : mesure discriminante de la couture", () => {
  const H = 4;
  // Toile de 3 colonnes de 1080 : chaque colonne x a une valeur propre (x % 251) ; la page copie la colonne exacte.
  const L = 3 * 1080;
  const toile = new Uint8Array(L * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) for (let k = 0; k < 3; k++) toile[(y * L + x) * 3 + k] = (x * 7) % 251;
  const pageDe = (colToile: number) => {
    const page = new Uint8Array(1080 * H * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < 1080; x++) for (let k = 0; k < 3; k++) page[(y * 1080 + x) * 3 + k] = toile[(y * L + colToile) * 3 + k];
    return page;
  };
  it("la colonne exacte est la plus proche", () => {
    expect(colonneExacteLaPlusProche(pageDe(1080), toile, L, H, 0, 1080)).toBe(true);
  });
  it("aux bords de la toile (première et dernière colonne), la colonne exacte reste la plus proche", () => {
    expect(colonneExacteLaPlusProche(pageDe(0), toile, L, H, 0, 0)).toBe(true);
    expect(colonneExacteLaPlusProche(pageDe(L - 1), toile, L, H, 0, L - 1)).toBe(true);
  });
  it("une voisine à peine meilleure (moins de 0,5) n'est pas une couture décalée", () => {
    const page = pageDe(1080);
    const proche = toile.slice();
    // Colonne exacte écartée de 0,25 en moyenne (un échantillon sur 12, de 3) ; la voisine 1081 est identique à la page.
    for (let y = 0; y < H; y++) for (let k = 0; k < 3; k++) proche[(y * L + 1081) * 3 + k] = page[y * 1080 * 3 + k];
    proche[1080 * 3] = page[0] + 3;
    expect(colonneExacteLaPlusProche(page, proche, L, H, 0, 1080)).toBe(true);
    // Écartée de 1 en moyenne : la voisine la bat de plus de 0,5, couture décalée.
    for (let y = 0; y < H; y++) for (let k = 0; k < 3; k++) proche[(y * L + 1080) * 3 + k] = page[y * 1080 * 3 + k] + 1;
    expect(colonneExacteLaPlusProche(page, proche, L, H, 0, 1080)).toBe(false);
  });
  it("une page décalée de 1 colonne est détectée", () => {
    expect(colonneExacteLaPlusProche(pageDe(1081), toile, L, H, 0, 1080)).toBe(false);
    expect(colonneExacteLaPlusProche(pageDe(1079), toile, L, H, 0, 1080)).toBe(false);
  });
});

describe("continu P2 : opération avec fausses dépendances", () => {
  let dossier: string;
  beforeEach(async () => {
    dossier = await mkdtemp(join(tmpdir(), "toile-continue-"));
  });
  afterEach(() => rm(dossier, { recursive: true, force: true }));

  const contexte = () => ({ progression: () => {}, dossier, signal: new AbortController().signal });
  const types = ["X00", "X01", "X02"];
  const proprietes = () => ({
    toile: { version: "toile/1", format: "4:5", pages: types.map((t) => GABARITS.find((g) => g.type === t)!.exemple), raccords: [] },
    versions: {
      socle: VERSION_TOILE_SOCLE,
      gabarits: Object.fromEntries(GABARITS.filter((g) => types.includes(g.type)).map((g) => [g.type, g.version])),
      parcours: Object.fromEntries(PARCOURS.filter((p) => p.pagesTypes.some((t) => types.includes(t))).map((p) => [p.id, p.version])),
      raccords: {},
    },
  });
  const demande = (parametres: Record<string, unknown>, entrees: Record<string, string> = {}): DemandeRendu => ({
    idRendu: "tc-1", operation: "toile-continue", file: "courte", entrees, sortie: { urlDepot: "https://r2/bande.jpg?sig=x", cle: "bande.jpg" }, parametres,
  });
  const complet = (extra = {}) => ({ proprietes: proprietes(), depotsPages: [1, 2, 3].map(depot), ...extra });
  const mesure = (nonce: string, extra: Record<string, number> = {}) =>
    `${PREFIXE_MESURE} ${nonce} ${JSON.stringify({ debordements: 0, taillePoliceMin: 30, textes: 1, textesSurCouture: 0, textesHorsMarge: 0, textesCoinReserve: 0, intrusionsMetaP1: 0, chevauchements: 0, debordCouture1: 0, traitsFinsSurCouture: 0, pages: 3, largeur: 3240, hauteur: 1350, ...extra })}`;
  function simule(opts: { mesure?: boolean; taille?: { largeur: number; hauteur: number }; extra?: Record<string, number> } = {}) {
    let appels = 0;
    const deps: DependancesToile = {
      async rendre(o) {
        appels++;
        await writeFile(o.sortie, Buffer.from([0]));
        if (opts.mesure !== false) o.surLog(mesure(o.inputProps.nonce as string, opts.extra));
        return opts.taille ?? { largeur: 3240, hauteur: 1350 };
      },
      async deposer() {},
    };
    return { op: creerToileContinue(deps), appels: () => appels };
  }

  it("refuse toute entrée, sans rendre", async () => {
    const { op, appels } = simule();
    await expect(op(demande(complet(), { image: "https://exemple.org/a.png" }), contexte())).rejects.toMatchObject({ erreur: { code: "refuse", reessayable: false } });
    expect(appels()).toBe(0);
  });
  it("refuse une URL dans les propriétés, sans rendre", async () => {
    const { op, appels } = simule();
    const p = proprietes();
    (p.toile as { titre?: string }).titre = "voir https://exemple.org/x";
    await expect(op(demande(complet({ proprietes: p })), contexte())).rejects.toMatchObject({ erreur: { code: "refuse", reessayable: false } });
    expect(appels()).toBe(0);
  });
  it("une version de toile différente est indisponible et réessayable", async () => {
    const { op, appels } = simule();
    const p = proprietes();
    p.versions.socle = "toile-continue/0";
    await expect(op(demande(complet({ proprietes: p })), contexte())).rejects.toMatchObject({ erreur: { code: "indisponible", reessayable: true } });
    expect(appels()).toBe(0);
  });
  it("une version absente est un refus", async () => {
    const { op, appels } = simule();
    await expect(op(demande(complet({ proprietes: { ...proprietes(), versions: undefined } })), contexte())).rejects.toMatchObject({ erreur: { code: "refuse", reessayable: false } });
    expect(appels()).toBe(0);
  });
  it("un nombre de depotsPages différent du nombre de pages est refusé", async () => {
    const { op, appels } = simule();
    await expect(op(demande(complet({ depotsPages: [depot(1), depot(2)] })), contexte())).rejects.toMatchObject({ erreur: { code: "refuse", reessayable: false } });
    expect(appels()).toBe(0);
  });
  it("une mesure absente est un échec", async () => {
    const { op } = simule({ mesure: false });
    await expect(op(demande(complet()), contexte())).rejects.toMatchObject({ erreur: { code: "inconnu", reessayable: false, message: expect.stringMatching(/Mesure absente/) } });
  });
  it("une largeur rendue fausse (mesure d'accord avec le rendu) est un échec non réessayable", async () => {
    const { op } = simule({ taille: { largeur: 3239, hauteur: 1350 }, extra: { largeur: 3239 } });
    await expect(op(demande(complet()), contexte())).rejects.toMatchObject({ erreur: { code: "inconnu", reessayable: false, message: expect.stringMatching(/au lieu de 3240/) } });
  });
  it("une hauteur rendue fausse (mesure d'accord avec le rendu) est un échec non réessayable", async () => {
    const { op } = simule({ taille: { largeur: 3240, hauteur: 1440 }, extra: { hauteur: 1440 } });
    await expect(op(demande(complet()), contexte())).rejects.toMatchObject({ erreur: { code: "inconnu", reessayable: false, message: expect.stringMatching(/de haut au lieu de 1350/) } });
  });
  it("une mesure dont la largeur ou la hauteur contredit le rendu est un échec", async () => {
    for (const extra of [{ largeur: 3000 } as Record<string, number>, { hauteur: 1000 }]) {
      const { op } = simule({ extra });
      await expect(op(demande(complet()), contexte())).rejects.toMatchObject({ erreur: { code: "inconnu", reessayable: false, message: expect.stringMatching(/contraire au rendu/) } });
    }
  });
});

describe("continu P2 : branchement", () => {
  it("le socle passe à toile-continue/1", () => {
    expect(VERSION_TOILE_SOCLE).toBe("toile-continue/1");
  });
  it("l'opération est déclarée des deux côtés du contrat et dans OPERATIONS", () => {
    expect(OPERATIONS).toContain("toile-continue");
    expect(lire("src/fournisseurs/types.ts")).toMatch(/\|\s*"toile-continue"/);
  });
  it("index.ts la charge au premier appel et préchauffe le paquet de la toile", () => {
    const index = lire("studio-rendu/src/index.ts");
    expect(index).toMatch(/"toile-continue":\s*async[^\n]*charger\("toile-continue", \(\) => import\("\.\/operations\/toile-continue\.js"\)\)\)\.toileContinue\(d, c\)/);
    expect(index).toMatch(/void import\("\.\/paquet-toile\.js"\)/);
  });
  it("la CI ciblée surveille les opérations de la toile", () => {
    const yaml = lire(".github/workflows/tests-visuels.yml");
    expect(yaml.match(/"studio-rendu\/src\/operations\/toile-\*\.ts"/g)).toHaveLength(2);
  });
});
