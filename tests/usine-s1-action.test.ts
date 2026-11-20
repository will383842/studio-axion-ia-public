/** PR S1 · l'action serveur du bouton : le navigateur n'envoie que `debut` et `cle` ; jour, réseau et sujet viennent du serveur. Aucun réseau, aucune dépense. */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => undefined }));
const gardee: { valeur: unknown } = { valeur: null };
vi.mock("@/services/_commun", async (orig) => {
  const reel = await orig<typeof import("@/services/_commun")>();
  return { ...reel, lireParametre: async (_id: string, defaut: unknown) => gardee.valeur ?? defaut, ecrireParametre: async (_id: string, v: unknown) => { gardee.valeur = v; } };
});
const vu: { appels: { options: unknown; visee: unknown }[]; libere?: () => void; attente?: Promise<void> } = { appels: [] };
vi.mock("@/services/usine-sujet", async () => {
  const porte = await import("@/services/usine-porte");
  return {
    ecrireSujetDeLUsine: vi.fn(async (_i: unknown, options: unknown) => {
      vu.appels.push({ options, visee: porte.viseeUsineCourante() });
      if (vu.attente) await vu.attente;
      return { id: `suj-${vu.appels.length}`, rappelUsine: false };
    }),
  };
});
const { retenirSujetSemaineAction } = await import("@/app/(studio)/calendrier/retenir-sujet");
const { PARAM_DERNIERE_SEMAINE } = await import("@/services/proposer-semaine");
const porte = await import("@/services/usine-porte");

const sujet = { signature: "s", parts: { metier: "m", actualite: null }, metier: "M", taille: "TPE", douleur: "d", casUsage: "c" };
const DEBUT = "2026-11-23";
const semaine = (propositions: unknown[] = [{ cle: "k1", jour: "2026-11-24", reseau: "instagram", sujet }]) => { gardee.valeur = { debut: DEBUT, propositions }; };

describe("action « Retenir ce sujet » : seulement debut et cle", () => {
  beforeEach(() => { vu.appels = []; delete vu.attente; gardee.valeur = null; delete process.env.USINE_URL; delete process.env.USINE_PORTE_SECRET; });
  const allumer = () => { process.env.USINE_URL = "https://usine.test"; process.env.USINE_PORTE_SECRET = "x".repeat(40); };

  it("l'action ne prend que debut et cle ; sujet, jour et réseau viennent de la semaine gardée par le serveur", async () => {
    allumer(); semaine();
    expect(PARAM_DERNIERE_SEMAINE).toBe("calendrier.proposerSemaine.derniere");
    expect(retenirSujetSemaineAction.length).toBe(2);
    const r = await retenirSujetSemaineAction(DEBUT, "k1");
    expect(r).toEqual({ ok: true, donnees: { id: "suj-1", rappelUsine: false } });
    expect(vu.appels[0]).toEqual({ options: { reseaux: ["instagram"], typeContenu: "video", dateVisee: "2026-11-24" }, visee: { jour: "2026-11-24", reseau: "instagram" } });
    expect(porte.viseeUsineCourante()).toBeUndefined();
  });
  it("clé inconnue, semaine différente, rien de gardé ou types faux : refus, rien n'est écrit", async () => {
    allumer(); semaine();
    expect((await retenirSujetSemaineAction(DEBUT, "inconnue")).ok).toBe(false);
    expect((await retenirSujetSemaineAction("2026-11-30", "k1")).ok).toBe(false);
    expect((await retenirSujetSemaineAction({ sujet }, { cle: "k1" })).ok).toBe(false);
    gardee.valeur = null;
    const r = await retenirSujetSemaineAction(DEBUT, "k1");
    expect(r.ok).toBe(false);
    expect(vu.appels).toHaveLength(0);
  });
  it("Usine non reliée : refus, rien n'est écrit", async () => {
    semaine();
    expect((await retenirSujetSemaineAction(DEBUT, "k1")).ok).toBe(false);
    expect(vu.appels).toHaveLength(0);
  });
  it("jour ou réseau gardés illisibles : refus", async () => {
    allumer();
    semaine([{ cle: "k1", jour: "demain", reseau: "instagram", sujet }, { cle: "k2", jour: "2026-11-24", reseau: "myspace", sujet }]);
    expect((await retenirSujetSemaineAction(DEBUT, "k1")).ok).toBe(false);
    expect((await retenirSujetSemaineAction(DEBUT, "k2")).ok).toBe(false);
    expect(vu.appels).toHaveLength(0);
  });
  it("verrou : deux demandes en même temps passent l'une après l'autre, jamais ensemble", async () => {
    allumer(); semaine();
    let libere!: () => void;
    vu.attente = new Promise<void>((r) => { libere = r; });
    const a = retenirSujetSemaineAction(DEBUT, "k1");
    const b = retenirSujetSemaineAction(DEBUT, "k1");
    await new Promise((r) => setTimeout(r, 20));
    expect(vu.appels).toHaveLength(1); // la seconde attend la fin de la première
    libere();
    await Promise.all([a, b]);
    expect(vu.appels).toHaveLength(2); // c'est ensuite `controlerSujetCentral` qui refuse la seconde (sujet déjà traité)
  });
});
