/**
 * L1-07 — migration étape 23 : les publications existantes entrent au plan éditorial.
 * Premier passage = N créneaux ; deuxième = null ; les Publications restent identiques en JSON. Données fictives.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { Publication } from "@/domaine/types";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { etape23PlanEditorial } = await import("@/services/migrations/etape-23-plan-editorial");

const MAINTENANT = "2026-11-25T08:00:00.000Z";
beforeEach(() => reinitialiserDepots());

function pub(id: string, p: Partial<Publication>): Publication {
  return { id, reseau: "linkedin", statut: "programmee", via: "manuel", date: "2026-11-30T23:30:00.000Z", texte: "Texte fictif", creeLe: "2026-11-01T00:00:00.000Z", modifieLe: "2026-11-01T00:00:00.000Z", videoId: "vid-1", ...p } as Publication;
}

async function semer() {
  const d = depots();
  for (const e of await d.publications.lister()) await d.publications.supprimer(e.id); // la mémoire sème des exemples : on repart d'un jeu connu
  await d.publications.enregistrer(pub("pub-1", { statut: "programmee", canalId: "compte-fictif-1" }));
  await d.publications.enregistrer(pub("pub-2", { statut: "publiee", reseau: "instagram", date: "2026-11-10T10:00:00.000Z" }));
  await d.publications.enregistrer(pub("pub-3", { statut: "brouillon", videoId: undefined, visuelId: "vis-1" }));
  await d.publications.enregistrer(pub("pub-4", { statut: "echec", reseau: "tiktok" }));
  return d;
}

describe("migration 23 · l'existant entre au plan", () => {
  it("premier passage : un créneau par publication ; deuxième passage : null", async () => {
    const d = await semer();
    const r = await etape23PlanEditorial(d, MAINTENANT);
    expect(r).toEqual({ creneaux: 4 });
    expect(await d.creneauxEditoriaux.compter()).toBe(4);
    expect(await etape23PlanEditorial(d, "2026-11-25T09:00:00.000Z")).toBeNull();
    expect(await d.creneauxEditoriaux.compter()).toBe(4);
  });

  it("les Publications sont identiques en JSON avant et après", async () => {
    const d = await semer();
    const avant = JSON.stringify(await d.publications.lister());
    await etape23PlanEditorial(d, MAINTENANT);
    await etape23PlanEditorial(d, MAINTENANT);
    expect(JSON.stringify(await d.publications.lister())).toBe(avant);
  });

  it("le créneau reprend statut, réseau, heure UTC, source et jour de Paris", async () => {
    const d = await semer();
    await etape23PlanEditorial(d, MAINTENANT);
    const c = (await d.creneauxEditoriaux.lister()).find((x) => x.videoId === "vid-1" && x.statut === "programme")!;
    expect(c.heuresParReseau).toEqual({ linkedin: "2026-11-30T23:30:00.000Z" });
    expect(c.jourVise).toBe("2026-12-01");
    expect(c.compteCible).toBe("compte-fictif-1");
    expect(c.decalages).toBe(0);
    const v = (await d.creneauxEditoriaux.lister()).find((x) => x.visuelId === "vis-1")!;
    expect(v.videoId).toBeUndefined();
    expect(v.statut).toBe("propose");
    expect((await d.creneauxEditoriaux.lister()).map((x) => x.statut).sort()).toEqual(["echec", "programme", "propose", "publie"]);
  });

  it("une publication nouvelle après la migration n'est pas reprise (jouée une seule fois) ; base vide : null", async () => {
    const d = depots();
    for (const e of await d.publications.lister()) await d.publications.supprimer(e.id);
    expect(await etape23PlanEditorial(d, MAINTENANT)).toBeNull();
    // Le repère est posé même sans publication : la migration ne rejoue pas plus tard (constat de relecture).
    expect(await d.parametres.obtenir("migrations.plan-editorial")).not.toBeNull();
    reinitialiserDepots();
    const d2 = await semer();
    await etape23PlanEditorial(d2, MAINTENANT);
    await d2.publications.enregistrer(pub("pub-5", {}));
    expect(await etape23PlanEditorial(d2, MAINTENANT)).toBeNull();
    expect(await d2.creneauxEditoriaux.compter()).toBe(4);
  });

  it("un créneau déjà présent (même identifiant) n'est jamais écrasé", async () => {
    const d = await semer();
    await d.creneauxEditoriaux.enregistrer({ id: "cre-pub-1", jourVise: "2026-12-24", heuresParReseau: {}, compteCible: "x", statut: "valide", decalages: 2 } as never);
    expect(await etape23PlanEditorial(d, MAINTENANT)).toEqual({ creneaux: 3 });
    expect(await d.creneauxEditoriaux.obtenir("cre-pub-1")).toMatchObject({ jourVise: "2026-12-24", decalages: 2 });
  });

  it("relecture : une publication de démonstration (estDemo) ne devient pas un créneau", async () => {
    const d = await semer();
    await d.publications.enregistrer(pub("pub-demo", { estDemo: true }));
    expect(await etape23PlanEditorial(d, MAINTENANT)).toEqual({ creneaux: 4 });
    expect(await d.creneauxEditoriaux.obtenir("cre-pub-demo")).toBeNull();
  });

  it("relecture : une date vide ou illisible est sautée et comptée, sans faire échouer la migration", async () => {
    const d = await semer();
    await d.publications.enregistrer(pub("pub-vide", { date: "" }));
    await d.publications.enregistrer(pub("pub-bizarre", { date: "pas une date" }));
    const avant = JSON.stringify(await d.publications.lister());
    expect(await etape23PlanEditorial(d, MAINTENANT)).toEqual({ creneaux: 4, illisibles: 2 });
    expect(await d.creneauxEditoriaux.obtenir("cre-pub-vide")).toBeNull();
    expect(JSON.stringify(await d.publications.lister())).toBe(avant);
    expect(await etape23PlanEditorial(d, MAINTENANT)).toBeNull();
  });
});
