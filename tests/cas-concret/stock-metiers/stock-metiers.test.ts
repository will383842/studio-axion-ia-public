/**
 * Stock de cas par métier · lot K1 : le chargeur valide chaque ligne (cas, rangement, id et mot uniques), écarte et liste ce
 * qui est invalide, et le réglage `casConcret.stockMetiers` éteint laisse exactement les cas d'aujourd'hui.
 * Aucun fichier écrit, aucun appel réel.
 */
import { existsSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { alerteCourte } from "@/formats/cas-concret/catalogue/alerte-courte";
import { CATALOGUE_TS } from "@/formats/cas-concret/catalogue/base";
import { chargerStock } from "@/formats/cas-concret/stock-metiers/charger";
import { verifierRangement, type Rangement } from "@/formats/cas-concret/stock-metiers/schema";
import type { CasConcret } from "@/formats/cas-concret/cas";

export const RANGEMENT_TYPE: Rangement = {
  fiche: "IN-01",
  secteur: "IN",
  metier: "industrie.mecanique-metallurgie",
  metierNom: "Atelier d'usinage",
  taille: "TPE",
  socle: "S02",
  inventaire: ["A7", "A3"],
  niveauPreuve: "lu-dans-le-code",
  douleur: "demandes-entrantes",
  casUsage: "industrie.mecanique-metallurgie.integration.c03",
  voisinCatalogue: "contact-vers-crm",
  angle: "Ici on trie la demande de prix avant le chiffrage.",
};

/** Un cas valide fabriqué à partir d'un cas du catalogue, avec son propre id et son propre mot. */
export const casFabrique = (id: string, mot: string): CasConcret => ({ ...alerteCourte, id, mot, version: 1 });
export const ligne = (id: string, mot: string, fiche = "IN-01") => ({ rangement: { ...RANGEMENT_TYPE, fiche }, cas: casFabrique(id, mot) });

const DEJA = { ids: CATALOGUE_TS.map((c) => c.id), mots: CATALOGUE_TS.map((c) => c.mot) };

describe("stock de cas · chargeur (K1)", () => {
  it("charge un cas valide avec son rangement", () => {
    const r = chargerStock([ligne("usinage-demandes-de-prix", "USINAGE")], DEJA);
    expect(r.refuses).toEqual([]);
    expect(r.cas.map((c) => c.id)).toEqual(["usinage-demandes-de-prix"]);
    expect(r.rangement["usinage-demandes-de-prix"]).toEqual(RANGEMENT_TYPE);
  });

  it("écarte un cas invalide et le liste avec sa fiche, son id et les raisons ; les autres restent", () => {
    const mauvais = ligne("usinage-mauvais", "MAUVAIS", "IN-02");
    (mauvais.cas as { promesse: string }).promesse = "Votre rendez-vous se confirme tout seul sans que personne ne bouge";
    const r = chargerStock([mauvais, ligne("usinage-bon", "BONMOT", "IN-03")], DEJA);
    expect(r.cas.map((c) => c.id)).toEqual(["usinage-bon"]);
    expect(r.refuses).toHaveLength(1);
    expect(r.refuses[0]).toMatchObject({ fiche: "IN-02", id: "usinage-mauvais" });
    expect(r.refuses[0]?.raisons.join(" ")).toMatch(/plus de 8 mots/);
    expect(r.rangement["usinage-mauvais"]).toBeUndefined();
  });

  it("écarte un rangement invalide et une ligne mal formée", () => {
    const sansTaille = { rangement: { ...RANGEMENT_TYPE, taille: "GRANDE" }, cas: casFabrique("usinage-taille", "TAILLE") };
    const extra = { rangement: RANGEMENT_TYPE, cas: casFabrique("usinage-extra", "EXTRA"), statut: "retenu-will" };
    const r = chargerStock([sansTaille, extra, null], DEJA);
    expect(r.cas).toEqual([]);
    expect(r.refuses.map((x) => x.fiche)).toEqual(["IN-01", "IN-01", "ligne 3"]);
    expect(r.refuses[0]?.raisons.join(" ")).toMatch(/rangement\.taille/);
  });

  it("refuse un id déjà au catalogue", () => {
    const r = chargerStock([ligne("alerte-courte", "NOUVEAUMOT")], DEJA);
    expect(r.cas).toEqual([]);
    expect(r.refuses[0]?.raisons.join(" ")).toMatch(/id « alerte-courte » déjà pris/);
  });

  it("refuse un mot déjà pris : par le catalogue, ou par une fiche précédente (la première reste)", () => {
    const motCatalogue = CATALOGUE_TS[0]!.mot;
    const r = chargerStock([ligne("cas-un", "DOUBLE", "IN-01"), ligne("cas-deux", "double", "IN-02"), ligne("cas-trois", motCatalogue.toLowerCase(), "IN-03")], DEJA);
    expect(r.cas.map((c) => c.id)).toEqual(["cas-un"]);
    expect(r.refuses.map((x) => x.id)).toEqual(["cas-deux", "cas-trois"]);
    expect(r.refuses.every((x) => /mot « .+ » déjà pris/.test(x.raisons.join(" ")))).toBe(true);
  });

  it("refuse un id ou une fiche en double dans le stock", () => {
    const r = chargerStock([ligne("meme-id", "UNMOT", "IN-01"), ligne("meme-id", "AUTREMOT", "IN-02"), ligne("autre-id", "TROISMOT", "IN-01")], DEJA);
    expect(r.cas.map((c) => c.id)).toEqual(["meme-id"]);
    expect(r.refuses).toHaveLength(2);
  });

  it("le contrat du rangement est strict", () => {
    expect(verifierRangement(RANGEMENT_TYPE).ok).toBe(true);
    expect(verifierRangement({ ...RANGEMENT_TYPE, voisinCatalogue: null }).ok).toBe(true);
    expect(verifierRangement({ ...RANGEMENT_TYPE, qualite: 19 }).ok).toBe(false);
    expect(verifierRangement({ ...RANGEMENT_TYPE, fiche: "in-1" }).ok).toBe(false);
  });
});

describe("stock de cas · catalogue et réglage (K1)", () => {
  afterEach(() => {
    vi.doUnmock("@/formats/cas-concret/stock-metiers/stock.json");
    vi.resetModules();
  });

  it("le vrai stock.json livré se charge sans aucun refus (vide au départ) et le catalogue garde ses 22 cas intacts", async () => {
    const stock = await import("@/formats/cas-concret/stock-metiers");
    const { CATALOGUE } = await import("@/formats/cas-concret/catalogue");
    expect(stock.REFUSES_STOCK).toEqual([]);
    expect(CATALOGUE.slice(0, 22)).toEqual([...CATALOGUE_TS]);
    expect(CATALOGUE).toHaveLength(22 + stock.CAS_STOCK.length);
  });

  it("réglage éteint : exactement les cas d'aujourd'hui ; stockMetiers allumé : les cas du stock s'ajoutent à la fin", async () => {
    vi.resetModules();
    vi.doMock("@/formats/cas-concret/stock-metiers/stock.json", () => ({ default: { version: 1, cas: [ligne("usinage-demandes-de-prix", "USINAGE")] } }));
    const { CATALOGUE, casVisibles, estCasStock } = await import("@/formats/cas-concret/catalogue");
    expect(CATALOGUE).toHaveLength(23);
    expect(CATALOGUE[22]?.id).toBe("usinage-demandes-de-prix");
    expect(estCasStock("usinage-demandes-de-prix")).toBe(true);
    expect(estCasStock("alerte-courte")).toBe(false);
    const liste = CATALOGUE.map((cas) => ({ cas }));
    const ids = (r: typeof liste) => r.map((x) => x.cas.id);
    const huit = CATALOGUE_TS.slice(0, 8).map((c) => c.id);
    const vingtDeux = CATALOGUE_TS.map((c) => c.id);
    expect(ids(casVisibles(liste, { catalogueEtendu: false }))).toEqual(huit);
    expect(ids(casVisibles(liste, { catalogueEtendu: false, stockMetiers: false }))).toEqual(huit);
    expect(ids(casVisibles(liste, { catalogueEtendu: true }))).toEqual(vingtDeux);
    expect(ids(casVisibles(liste, { catalogueEtendu: true, stockMetiers: true }))).toEqual([...vingtDeux, "usinage-demandes-de-prix"]);
    expect(ids(casVisibles(liste, { catalogueEtendu: false, stockMetiers: true }))).toEqual([...huit, "usinage-demandes-de-prix"]);
  });

  it("un stock.json qui contient un cas invalide : le cas n'entre pas au catalogue et il est listé", async () => {
    vi.resetModules();
    const mauvais = ligne("usinage-mauvais", "MAUVAIS");
    (mauvais.cas as { id: string }).id = "Mauvais Id";
    vi.doMock("@/formats/cas-concret/stock-metiers/stock.json", () => ({ default: { version: 1, cas: [mauvais] } }));
    const { CATALOGUE } = await import("@/formats/cas-concret/catalogue");
    const { REFUSES_STOCK } = await import("@/formats/cas-concret/stock-metiers");
    expect(CATALOGUE).toHaveLength(22);
    expect(REFUSES_STOCK).toHaveLength(1);
  });

  it("un stock.json sans tableau « cas » ne casse pas le chargement : liste vide et un refus listé", async () => {
    vi.resetModules();
    vi.doMock("@/formats/cas-concret/stock-metiers/stock.json", () => ({ default: { version: 1 } }));
    const { CAS_STOCK, REFUSES_STOCK } = await import("@/formats/cas-concret/stock-metiers");
    expect(CAS_STOCK).toEqual([]);
    expect(REFUSES_STOCK).toHaveLength(1);
    expect(REFUSES_STOCK[0]?.fiche).toBe("stock.json");
  });

  it("le réglage casConcret.stockMetiers n'est jamais allumé par le code : lu avec défaut faux, et le réglage absent vaut éteint", () => {
    const t = readFileSync("src/services/cas-concret-reglages.ts", "utf8");
    expect(t).toContain('stockMetiers: "casConcret.stockMetiers"');
    const sujets = readFileSync("src/services/sujets-traites.ts", "utf8");
    expect(sujets).toContain('stockMetiers: async () => (await lireParametre<unknown>("casConcret.stockMetiers", false)) === true');
  });
});

/** Chemin de l'export des vraies fiches (hors dépôt) ; absent (cloud), le test est sauté. */
export const EXPORT_VRAIES_FICHES = process.env.STOCK_CAS_METIERS_JSON ?? "<fichier local non publié>";

describe.skipIf(!existsSync(EXPORT_VRAIES_FICHES))("stock de cas · les VRAIES fiches (K1)", () => {
  it("toutes les fiches de l'export, marquées retenues en mémoire, passent le chargeur : zéro cas écarté", () => {
    const exporte = JSON.parse(readFileSync(EXPORT_VRAIES_FICHES, "utf8").replace(/^\uFEFF/, "")) as { fiches: Array<{ rangement: Record<string, unknown>; cas: unknown }> };
    expect(exporte.fiches.length).toBeGreaterThan(0);
    const lignes = exporte.fiches.map((f) => {
      const { statut: _s, qualite: _q, descriptionPorteB: _d, ...rangement } = f.rangement;
      return { rangement, cas: f.cas };
    });
    const r = chargerStock(lignes, DEJA);
    expect(r.refuses.map((x) => `${x.fiche} ${x.id ?? ""} : ${x.raisons.join(" ; ")}`)).toEqual([]);
    expect(r.cas).toHaveLength(exporte.fiches.length);
  });
});
