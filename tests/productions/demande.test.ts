/**
 * L6-02 · contrats de production, de textes et de cadence : 3 demandes mixtes = 3 suivis en file selon la date cible ; un lot de 10
 * respecte le plafond ; l'API de proximité et de cadence n'expose que empreinteDe, proximite, verifierEspacement, planifier.
 * Aucun appel réel : tout est injecté.
 */
import { describe, expect, it, vi } from "vitest";
import { lireDemande, ordreDeFile, type DemandeDeProduction } from "@/domaine/productions/demande";
import { deposerDemandes, type SuiviDeProduction } from "@/services/productions-demande";
import { demanderTextes, PLAFOND_TEXTES_LOT } from "@/services/texte-post-lot";
import * as cadence from "@/domaine/cadence/index";
import * as proximite from "@/domaine/proximite/index";

const demande = (id: string, type: DemandeDeProduction["type"], dateCible: string): DemandeDeProduction => ({ id, type, sujet: `Sujet ${id}`, dateCible, reseaux: ["linkedin"] });

describe("L6-02 · demande de production", () => {
  it("lireDemande accepte une demande valide et refuse le reste", () => {
    expect(lireDemande(demande("a", "video", "2026-12-01"))).toEqual(demande("a", "video", "2026-12-01"));
    expect(lireDemande({ ...demande("a", "video", "2026-12-01"), type: "podcast" })).toBeNull();
    expect(lireDemande({ ...demande("a", "video", "2026-12-01"), dateCible: "demain" })).toBeNull();
    expect(lireDemande({ ...demande("a", "video", "2026-12-01"), reseaux: [] })).toBeNull();
    expect(lireDemande({ ...demande("a", "video", "2026-12-01"), sujet: "  " })).toBeNull();
    expect(lireDemande(null)).toBeNull();
  });
  it("la file suit la date cible, puis l'identifiant", () => {
    const o = ordreDeFile([demande("c", "video", "2026-12-09"), demande("b", "carrousel", "2026-12-01"), demande("a", "infographie", "2026-12-01")]);
    expect(o.map((d) => d.id)).toEqual(["a", "b", "c"]);
  });
});

describe("L6-02 · dépôt des demandes", () => {
  it("3 demandes mixtes = 3 suivis en file, dans l'ordre de la date cible", async () => {
    const gardes: SuiviDeProduction[] = [];
    const suivis = await deposerDemandes([demande("v", "video", "2026-12-09"), demande("c", "carrousel", "2026-12-01"), demande("i", "infographie", "2026-12-05")], {
      enregistrer: async (s) => void gardes.push(s),
    });
    expect(suivis).toHaveLength(3);
    expect(gardes).toHaveLength(3);
    expect(suivis.map((s) => s.demandeId)).toEqual(["c", "i", "v"]);
    expect(suivis.map((s) => s.rang)).toEqual([1, 2, 3]);
    expect(suivis.every((s) => s.statut === "en_file")).toBe(true);
    expect(suivis.map((s) => s.type)).toEqual(["carrousel", "infographie", "video"]);
  });
  it("une demande invalide ou en double refuse tout le dépôt, rien n'est enregistré", async () => {
    const enregistrer = vi.fn(async () => {});
    await expect(deposerDemandes([demande("a", "video", "2026-12-01"), { ...demande("b", "video", "x") } as DemandeDeProduction], { enregistrer })).rejects.toThrow();
    await expect(deposerDemandes([demande("a", "video", "2026-12-01"), demande("a", "carrousel", "2026-12-02")], { enregistrer })).rejects.toThrow();
    expect(enregistrer).not.toHaveBeenCalled();
  });
});

describe("L6-02 · textes en lot sous plafond", () => {
  const lot = (n: number) => Array.from({ length: n }, (_, i) => demande(`d${String(i).padStart(2, "0")}`, "carrousel", "2026-12-01"));
  it("un lot de 10 respecte le plafond : 10 textes écrits, aucun reporté", async () => {
    const ecrire = vi.fn(async (d: DemandeDeProduction) => `Texte ${d.id}`);
    const r = await demanderTextes(lot(10), { ecrire });
    expect(PLAFOND_TEXTES_LOT).toBe(10);
    expect(ecrire).toHaveBeenCalledTimes(10);
    expect(r.ecrits).toHaveLength(10);
    expect(r.reportes).toHaveLength(0);
  });
  it("au-delà du plafond : le reste est reporté, jamais écrit", async () => {
    const ecrire = vi.fn(async (d: DemandeDeProduction) => `Texte ${d.id}`);
    const r = await demanderTextes(lot(13), { ecrire });
    expect(ecrire).toHaveBeenCalledTimes(10);
    expect(r.reportes.map((d) => d.id)).toEqual(["d10", "d11", "d12"]);
  });
  it("budget épuisé : on s'arrête, le reste est reporté", async () => {
    const ecrire = vi.fn(async (d: DemandeDeProduction) => `Texte ${d.id}`);
    const r = await demanderTextes(lot(6), { ecrire, budgetTextes: 3 });
    expect(ecrire).toHaveBeenCalledTimes(3);
    expect(r.reportes).toHaveLength(3);
  });
  it("un texte en échec est noté, les autres continuent", async () => {
    const ecrire = vi.fn(async (d: DemandeDeProduction) => {
      if (d.id === "d01") throw new Error("panne");
      return `Texte ${d.id}`;
    });
    const r = await demanderTextes(lot(3), { ecrire });
    expect(r.ecrits.map((e) => e.demandeId)).toEqual(["d00", "d02"]);
    expect(r.echecs.map((e) => e.demandeId)).toEqual(["d01"]);
  });
  it("sans rédacteur injecté : aucun appel possible", async () => {
    await expect(demanderTextes(lot(1), {} as never)).rejects.toThrow();
  });
});

describe("L6-02 · API publique de cadence et de proximité", () => {
  it("n'expose que empreinteDe, proximite, verifierEspacement, planifier", () => {
    expect(Object.keys(cadence).sort()).toEqual(["planifier", "verifierEspacement"]);
    expect(Object.keys(proximite).sort()).toEqual(["empreinteDe", "proximite"]);
  });
  it("proximité : deux sujets identiques valent 1, sans axe commun 0", () => {
    const a = proximite.empreinteDe({ sujet: "Automatiser ses devis avec une IA" });
    expect(proximite.proximite(a, a)).toBe(1);
    expect(proximite.proximite(a, proximite.empreinteDe({ sujet: "Recette de cuisine" }))).toBe(0);
  });
  it("cadence : planifier donne des créneaux, verifierEspacement les contrôle", () => {
    const plan = cadence.planifier("2026-12-07", [{ id: "s1", pilier: "p", cible: "c" }], ["linkedin"], []);
    expect(plan.length).toBeGreaterThan(0);
    expect(cadence.verifierEspacement(plan)).toEqual([]);
  });
});
