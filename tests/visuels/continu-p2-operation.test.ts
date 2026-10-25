import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ErreurRendu, OPERATIONS } from "../../studio-rendu/src/contrat";
import { erreurDeValidationToile, grapheDecoupe, reglagesToile, verifierDepotsPages } from "../../studio-rendu/src/operations/toile-continue";
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
