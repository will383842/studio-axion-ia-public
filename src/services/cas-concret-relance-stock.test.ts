import { beforeEach, describe, expect, it, vi } from "vitest";

// Relance d'un cas du stock, réglage éteint : refus net, avant tout prix et toute dépense.
const etat = vi.hoisted(() => ({ casId: "stock-fab", reessayer: vi.fn(), traite: vi.fn(), retires: new Set<string>() }));
vi.mock("./_commun", () => ({
  ErreurStudio: class extends Error {},
  depots: () => ({
    travaux: { obtenir: async () => ({ id: "t1", cibleId: "v-en-panne", type: "fabrication", statut: "echec", versionId: "ver1", etapes: [{ cle: "ecriture", statut: "echec" }] }) },
    versions: { obtenir: async () => ({ commande: { moteurId: "cas-concret", entrees: { casConcret: { casId: etat.casId } } } }) },
  }),
}));
vi.mock("./cas-concret-traites", () => ({ estCasTraite: etat.traite, PHRASE_CAS_TRAITE: "Ce cas est déjà traité : il n'est plus disponible." }));
vi.mock("./cas-concret-retires", () => ({ lireCasRetires: async () => etat.retires }));
vi.mock("./auth", () => ({ exigerSession: vi.fn(async () => undefined) }));
vi.mock("./travaux", () => ({ reessayerTravail: etat.reessayer }));
vi.mock("./cas-concret-reglages", () => ({ REGLAGES_CAS_CONCRET: { stockMetiers: "casConcret.stockMetiers" }, reglageAllume: vi.fn(async () => false) }));
vi.mock("@/moteurs/montage-cas-concret", () => ({
  ID_MOTEUR_CAS_CONCRET: "cas-concret",
  lireEntreesCasConcret: (e: { casConcret?: { casId?: string } }) => ({ casId: e.casConcret?.casId }),
  coutNouvelEssaiEcritureCentimes: () => 123,
  casDesEntrees: (e: { casId?: string }) => (e.casId ? { id: e.casId } : undefined),
}));
vi.mock("@/formats/cas-concret/catalogue", () => ({ estCasStock: (id: string) => id === "stock-fab", trouverCas: (id: string) => ({ id }) }));

import { PHRASES_RELANCE, relancerEtapeCasConcret } from "./cas-concret-relance";

beforeEach(() => {
  etat.reessayer.mockReset();
  etat.reessayer.mockResolvedValue({ id: "t1" });
  etat.traite.mockReset();
  etat.traite.mockResolvedValue(false);
  etat.retires = new Set();
});

describe("relance d'un cas du stock", () => {
  it("réglage éteint : refus explicite, aucune dépense, aucun prix annoncé", async () => {
    etat.casId = "stock-fab";
    const claudeActif = vi.fn(async () => true);
    const r = await relancerEtapeCasConcret("t1", undefined, { claudeActif, stockMetiersAllume: async () => false });
    expect(r).toEqual({ statut: "refusee", phrase: PHRASES_RELANCE.casIndisponible });
    expect(etat.reessayer).not.toHaveBeenCalled();
    expect(claudeActif).not.toHaveBeenCalled();
  });

  it("réglage illisible : même refus", async () => {
    etat.casId = "stock-fab";
    const r = await relancerEtapeCasConcret("t1", true, {
      stockMetiersAllume: async () => {
        throw new Error("illisible");
      },
    });
    expect(r.statut).toBe("refusee");
    expect(etat.reessayer).not.toHaveBeenCalled();
  });

  it("réglage allumé : la relance suit son cours (le prix est annoncé d'abord)", async () => {
    etat.casId = "stock-fab";
    const r = await relancerEtapeCasConcret("t1", undefined, { claudeActif: async () => true, stockMetiersAllume: async () => true });
    expect(r.statut).toBe("accord-requis");
  });

  it("un cas d'avant le stock : comportement inchangé, le réglage n'est même pas lu", async () => {
    etat.casId = "ancien";
    const lire = vi.fn(async () => false);
    const r = await relancerEtapeCasConcret("t1", undefined, { claudeActif: async () => true, stockMetiersAllume: lire });
    expect(r.statut).toBe("accord-requis");
    expect(lire).not.toHaveBeenCalled();
    const r2 = await relancerEtapeCasConcret("t1", 123, { claudeActif: async () => true, stockMetiersAllume: lire });
    expect(r2).toEqual({ statut: "relancee", travailId: "t1" });
  });
});

describe("relance d'un cas déjà traité (ordre de Will : jamais deux vidéos identiques)", () => {
  it("le cas est fini par une autre vidéo : refus net, ni prix ni relance", async () => {
    etat.casId = "ancien";
    etat.traite.mockResolvedValue(true);
    const claudeActif = vi.fn(async () => true);
    const r = await relancerEtapeCasConcret("t1", 123, { claudeActif });
    expect(r).toEqual({ statut: "refusee", phrase: PHRASES_RELANCE.dejaTraite });
    expect(etat.traite).toHaveBeenCalledWith("ancien", { saufVideoId: "v-en-panne" });
    expect(etat.reessayer).not.toHaveBeenCalled();
    expect(claudeActif).not.toHaveBeenCalled();
  });

  it("la vidéo en panne elle-même, cas non traité : la relance reste permise", async () => {
    etat.casId = "ancien";
    const r = await relancerEtapeCasConcret("t1", 123, { claudeActif: async () => true });
    expect(r).toEqual({ statut: "relancee", travailId: "t1" });
  });
});

describe("relance d'un cas retiré par Will", () => {
  it("le cas est retiré : refus net avant toute estimation, rien n'est relancé", async () => {
    etat.casId = "ancien";
    etat.retires = new Set(["ancien"]);
    const claudeActif = vi.fn(async () => true);
    const r = await relancerEtapeCasConcret("t1", 123, { claudeActif });
    expect(r).toEqual({ statut: "refusee", phrase: PHRASES_RELANCE.casRetire });
    expect(PHRASES_RELANCE.casRetire).toContain("Ce cas est retiré");
    expect(etat.reessayer).not.toHaveBeenCalled();
    expect(claudeActif).not.toHaveBeenCalled();
  });

  it("le cas n'est pas retiré : la relance suit son cours", async () => {
    etat.casId = "ancien";
    etat.retires = new Set(["un-autre"]);
    const r = await relancerEtapeCasConcret("t1", 123, { claudeActif: async () => true });
    expect(r).toEqual({ statut: "relancee", travailId: "t1" });
  });
});
