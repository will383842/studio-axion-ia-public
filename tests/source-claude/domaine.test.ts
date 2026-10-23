/** Socle multi-sources Claude — règles PURES (domaine/source-claude.ts). Aucune clé réelle. */
import { describe, expect, it } from "vitest";
import {
  choisirSource,
  cleDeLaSource,
  clesClaudeConnues,
  consommationParSource,
  debutPeriode,
  epuiseeMaintenant,
  lireReglageSources,
  prochaineSourceAbonnement,
  REGLAGE_SOURCES_PAR_DEFAUT,
  type ReglageSources,
} from "@/domaine/source-claude";

const ENV = { ANTHROPIC_API_KEY: "A1", ANTHROPIC_API_KEY_2: "A2", ANTHROPIC_API_KEY_3: "A3", ANTHROPIC_API_KEY_PAYANTE: "P" };
const defaut = (): ReglageSources => lireReglageSources(null);

describe("lireReglageSources", () => {
  it("illisible → défaut (abonnements, ordre 1-2-3)", () => {
    for (const v of [null, undefined, "x", 3, [], { mode: 5 }]) expect(lireReglageSources(v)).toEqual(REGLAGE_SOURCES_PAR_DEFAUT);
  });
  it("le mode « api » n'existe que si la valeur est exactement « api »", () => {
    expect(lireReglageSources({ mode: "API" }).mode).toBe("abonnements");
    expect(lireReglageSources({ mode: " api" }).mode).toBe("abonnements");
    expect(lireReglageSources({ mode: "api" }).mode).toBe("api");
  });
  it("ordre incomplet, doublé ou inconnu → défaut ; complet → gardé", () => {
    expect(lireReglageSources({ ordre: ["abonnement-2", "abonnement-1"] }).ordre).toEqual(["abonnement-1", "abonnement-2", "abonnement-3"]);
    expect(lireReglageSources({ ordre: ["abonnement-2", "abonnement-2", "abonnement-1"] }).ordre).toEqual(["abonnement-1", "abonnement-2", "abonnement-3"]);
    expect(lireReglageSources({ ordre: ["abonnement-3", "abonnement-1", "api"] }).ordre).toEqual(["abonnement-1", "abonnement-2", "abonnement-3"]);
    expect(lireReglageSources({ ordre: ["abonnement-3", "abonnement-1", "abonnement-2"] }).ordre).toEqual(["abonnement-3", "abonnement-1", "abonnement-2"]);
  });
  it("désactivés filtrés (« api » et inconnus écartés)", () => {
    expect(lireReglageSources({ desactives: ["abonnement-2", "api", "zzz"] }).desactives).toEqual(["abonnement-2"]);
  });
});

describe("clés", () => {
  it("cleDeLaSource : trim, AUCUN repli vers une autre variable", () => {
    expect(cleDeLaSource("abonnement-1", { ANTHROPIC_API_KEY: "  A1  " })).toBe("A1");
    expect(cleDeLaSource("abonnement-2", { ANTHROPIC_API_KEY: "A1" })).toBeNull();
    expect(cleDeLaSource("api", { ANTHROPIC_API_KEY: "A1", ANTHROPIC_API_KEY_2: "A2" })).toBeNull();
    expect(cleDeLaSource("abonnement-1", { ANTHROPIC_API_KEY: "  " })).toBeNull();
  });
  it("clesClaudeConnues : les quatre, pour masquer", () => {
    expect(clesClaudeConnues(ENV).sort()).toEqual(["A1", "A2", "A3", "P"]);
  });
});

describe("choisirSource", () => {
  it("défaut : le compte 1", () => {
    expect(choisirSource(defaut(), ENV, {})).toEqual({ etat: "pret", source: "abonnement-1", cle: "A1" });
  });
  it("suit l'ordre choisi", () => {
    const r = lireReglageSources({ ordre: ["abonnement-3", "abonnement-1", "abonnement-2"] });
    expect(choisirSource(r, ENV, {})).toMatchObject({ source: "abonnement-3" });
  });
  it("saute un compte désactivé, un compte sans clé, un compte épuisé", () => {
    expect(choisirSource(lireReglageSources({ desactives: ["abonnement-1"] }), ENV, {})).toMatchObject({ source: "abonnement-2" });
    expect(choisirSource(defaut(), { ANTHROPIC_API_KEY_3: "A3" }, {})).toMatchObject({ source: "abonnement-3" });
    expect(choisirSource(defaut(), ENV, { "abonnement-1": true, "abonnement-2": true })).toMatchObject({ source: "abonnement-3" });
  });
  it("exclusion", () => {
    expect(choisirSource(defaut(), ENV, {}, ["abonnement-1"])).toMatchObject({ source: "abonnement-2" });
  });
  it("clé en doublon : le second compte est ignoré", () => {
    const env = { ANTHROPIC_API_KEY: "A1", ANTHROPIC_API_KEY_2: "A1", ANTHROPIC_API_KEY_3: "A3" };
    expect(choisirSource(defaut(), env, { "abonnement-1": true })).toMatchObject({ source: "abonnement-3" });
    // un compte 1 exclu ne rend pas le doublon utilisable
    expect(choisirSource(defaut(), env, {}, ["abonnement-1"])).toMatchObject({ source: "abonnement-3" });
  });
  it("tous épuisés → tous-epuises (nombre de comptes retenus)", () => {
    expect(choisirSource(defaut(), ENV, { "abonnement-1": true, "abonnement-2": true, "abonnement-3": true })).toEqual({ etat: "tous-epuises", comptes: 3 });
    expect(choisirSource(defaut(), { ANTHROPIC_API_KEY: "A1" }, { "abonnement-1": true })).toEqual({ etat: "tous-epuises", comptes: 1 });
  });
  it("aucun compte retenu → aucun", () => {
    expect(choisirSource(defaut(), {}, {})).toEqual({ etat: "aucun" });
    expect(choisirSource(lireReglageSources({ desactives: ["abonnement-1", "abonnement-2", "abonnement-3"] }), ENV, {})).toEqual({ etat: "aucun" });
  });
  it("mode api : la clé payante si posée, sinon aucun — jamais un abonnement", () => {
    const api = lireReglageSources({ mode: "api" });
    expect(choisirSource(api, ENV, {})).toEqual({ etat: "pret", source: "api", cle: "P" });
    expect(choisirSource(api, { ANTHROPIC_API_KEY: "A1" }, {})).toEqual({ etat: "aucun" });
  });
  it("4 clés posées + 3 abonnements épuisés → JAMAIS api", () => {
    const tous = { "abonnement-1": true, "abonnement-2": true, "abonnement-3": true } as const;
    expect(choisirSource(defaut(), ENV, tous)).toEqual({ etat: "tous-epuises", comptes: 3 });
    expect(prochaineSourceAbonnement(defaut(), ENV, tous, [])).toBeNull();
    expect(prochaineSourceAbonnement(defaut(), ENV, {}, ["abonnement-1", "abonnement-2", "abonnement-3"])).toBeNull();
  });
});

describe("prochaineSourceAbonnement", () => {
  it("saute les essayées, les épuisées et les doublons ; jamais en mode api", () => {
    expect(prochaineSourceAbonnement(defaut(), ENV, {}, ["abonnement-1"])).toEqual({ source: "abonnement-2", cle: "A2" });
    expect(prochaineSourceAbonnement(defaut(), ENV, { "abonnement-2": true }, ["abonnement-1"])).toEqual({ source: "abonnement-3", cle: "A3" });
    expect(prochaineSourceAbonnement(defaut(), { ANTHROPIC_API_KEY: "A1", ANTHROPIC_API_KEY_2: "A1" }, {}, ["abonnement-1"])).toBeNull();
    expect(prochaineSourceAbonnement(lireReglageSources({ mode: "api" }), ENV, {}, [])).toBeNull();
  });
});

describe("période de renouvellement", () => {
  it("jour J : avant J → mois précédent ; à J (minuit) → ce mois", () => {
    expect(debutPeriode("2026-10-19T10:00:00Z", 10)).toBe("2026-10-10T00:00:00.000Z");
    expect(debutPeriode("2026-10-05T10:00:00Z", 10)).toBe("2026-09-10T00:00:00.000Z");
    expect(debutPeriode("2026-10-10T00:00:00Z", 10)).toBe("2026-10-10T00:00:00.000Z");
    expect(debutPeriode("2026-01-05T10:00:00Z", 10)).toBe("2025-12-10T00:00:00.000Z");
  });
  it("jour absent, 0, 31 ou non entier → le 1er ; février correct", () => {
    for (const j of [null, undefined, 0, 29, 31, 2.5]) expect(debutPeriode("2026-10-19T10:00:00Z", j)).toBe("2026-10-01T00:00:00.000Z");
    expect(debutPeriode("2026-03-01T12:00:00Z", 28)).toBe("2026-02-28T00:00:00.000Z");
    expect(debutPeriode("2026-02-28T12:00:00Z", 28)).toBe("2026-02-28T00:00:00.000Z");
    expect(debutPeriode("2026-02-27T12:00:00Z", 28)).toBe("2026-01-28T00:00:00.000Z");
  });
  it("epuiseeMaintenant : marque de la période en cours seulement", () => {
    expect(epuiseeMaintenant({ depuis: "2026-10-12T00:00:00Z" }, "2026-10-19T10:00:00Z", 10)).toBe(true);
    expect(epuiseeMaintenant({ depuis: "2026-10-09T23:59:59Z" }, "2026-10-19T10:00:00Z", 10)).toBe(false);
    expect(epuiseeMaintenant({ depuis: "2026-09-30T00:00:00Z" }, "2026-10-19T10:00:00Z", null)).toBe(false);
    expect(epuiseeMaintenant(null, "2026-10-19T10:00:00Z", null)).toBe(false);
  });
});

describe("consommationParSource", () => {
  const ligne = (centimes: number, fournisseur = "anthropic", nature: "reel" | "estime" = "reel") => ({ fournisseur, nature, total: { centimes, devise: "EUR" } }) as never;
  it("compte par source ; sans sourceClaude → compte 1 ; ignore avant `depuis`, l'estimé et les autres fournisseurs", () => {
    const depenses = [
      { date: "2026-10-12T00:00:00Z", lignes: [ligne(100)] },
      { date: "2026-10-13T00:00:00Z", lignes: [ligne(100)], sourceClaude: "abonnement-2" as const },
      { date: "2026-10-14T00:00:00Z", lignes: [ligne(50, "fal")], sourceClaude: "api" as const },
      { date: "2026-10-14T00:00:00Z", lignes: [ligne(100, "anthropic", "estime")] },
      { date: "2026-09-01T00:00:00Z", lignes: [ligne(900)] },
    ];
    const c = consommationParSource(depenses as never, "2026-10-01T00:00:00Z", 1);
    expect(c["abonnement-1"]).toBe(100);
    expect(c["abonnement-2"]).toBe(100);
    expect(c["abonnement-3"]).toBe(0);
    expect(c.api).toBe(0);
  });
});
