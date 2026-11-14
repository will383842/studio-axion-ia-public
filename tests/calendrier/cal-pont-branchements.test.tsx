/**
 * CAL-14P0 : le pont. Avec les versions vides des chargeurs, la page rend le même HTML qu'avant ;
 * chaque chargeur est réservé au serveur ; un jour passé n'affiche pas « Ajouter ce jour-là » (condition portée par page.tsx).
 */
import { readFileSync } from "node:fs";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async (o) => ({ ...(await o<typeof import("react")>()), ...(await import("../aides/crochets-factices")).crochets }));
vi.mock("@/app/(studio)/calendrier/actions/decaler", () => ({ decalerEntree: vi.fn(async () => ({ ok: false, message: "doublure" })) }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));
const listerCalendrier = vi.fn(async () => [] as unknown[]);
vi.mock("@/services/publications", () => ({ listerCalendrier: () => listerCalendrier(), listerAProgrammer: async () => [] }));

const { monter } = await import("../aides/crochets-factices");
const { cleJour } = await import("@/lib/dates");
const { entreeDepuisPublication } = await import("@/components/calendrier/apercu-reseau");

const lire = (chemin: string) => readFileSync(chemin, "utf8");
const DOSSIER = "src/app/(studio)/calendrier";
const publication = () => ({ jour: cleJour(new Date()), publications: [{ id: "p1", statut: "programmee", via: "manuel", date: new Date().toISOString(), texte: "Un texte", reseau: "linkedin", reseauNom: "LinkedIn", video: null }] });

async function rendre(params: Record<string, string>): Promise<string> {
  monter(() => null, {}).rendre();
  listerCalendrier.mockResolvedValue([publication()]);
  const { default: Page } = await import("../../src/app/(studio)/calendrier/page");
  return renderToStaticMarkup((await Page({ searchParams: Promise.resolve(params) })) as ReactElement);
}

beforeEach(() => {
  vi.resetModules();
});

describe("CAL-14P0 — pont du calendrier", () => {
  it("vue Jour : même HTML qu'avant (chargeurs et composants vides)", async () => {
    const reel = await rendre({ vue: "jour" });
    vi.resetModules();
    vi.doMock("@/components/calendrier/PlanDuJour", () => ({ PlanDuJour: () => null }));
    vi.doMock("@/components/calendrier/AjouterDuJour", () => ({ AjouterDuJour: () => null }));
    vi.doMock("@/app/(studio)/calendrier/charger-plan", () => ({ chargerPlanDuJour: async () => [] }));
    vi.doMock("@/app/(studio)/calendrier/charger-comptes", () => ({ comptesCibles: async () => ({}) }));
    const avant = await rendre({ vue: "jour" });
    vi.doUnmock("@/components/calendrier/PlanDuJour");
    vi.doUnmock("@/components/calendrier/AjouterDuJour");
    vi.doUnmock("@/app/(studio)/calendrier/charger-plan");
    vi.doUnmock("@/app/(studio)/calendrier/charger-comptes");
    expect(reel).toBe(avant);
    expect(reel).toContain("Retour à la semaine");
  });

  it("vue semaine : même HTML qu'avant (chargeur de médias vide)", async () => {
    const reel = await rendre({});
    vi.resetModules();
    vi.doMock("@/app/(studio)/calendrier/charger-medias", () => ({ entreesAvecMedias: async (s: Parameters<typeof entreeDepuisPublication>[0][]) => s.map(entreeDepuisPublication) }));
    const avant = await rendre({});
    vi.doUnmock("@/app/(studio)/calendrier/charger-medias");
    expect(reel).toBe(avant);
    expect(reel).toContain("Cette semaine");
  });

  it("versions vides des chargeurs", async () => {
    const { entreesAvecMedias } = await import("@/app/(studio)/calendrier/charger-medias");
    const { chargerPlanDuJour } = await import("@/app/(studio)/calendrier/charger-plan");
    const { comptesCibles } = await import("@/app/(studio)/calendrier/charger-comptes");
    const p = publication().publications[0];
    expect(await entreesAvecMedias([p])).toEqual([entreeDepuisPublication(p)]);
    expect(await chargerPlanDuJour("2030-01-02", "2030-01-01")).toEqual([]);
    expect(await comptesCibles(["linkedin", "tiktok"])).toEqual({ linkedin: "compte-studio", tiktok: "compte-studio" });
    expect(await comptesCibles([])).toEqual({});
  });

  it("chaque chargeur porte server-only et jamais use server", () => {
    for (const f of ["charger-medias.ts", "charger-plan.ts", "charger-comptes.ts"]) {
      const src = lire(`${DOSSIER}/${f}`);
      expect(src, f).toContain('import "server-only"');
      expect(src, f).not.toMatch(/["']use server["']/);
      expect(src, f).toContain("try {");
    }
  });

  it("un jour passé n'affiche pas AjouterDuJour : la condition est dans page.tsx", () => {
    const page = lire(`${DOSSIER}/page.tsx`);
    expect(page).toMatch(/\{jour >= aujourdhui && <AjouterDuJour [^>]*\/>\}/);
    expect(page).toContain("<PlanDuJour creneaux={plan}");
    expect(page).toContain("await entreesAvecMedias(semaine)");
    expect(page).toMatch(/Promise\.all\(\[listerCalendrier\([^\]]*chargerPlanDuJour\(jour, [^\]]*comptesCibles\(reseauxActifs\)\]\)/);
  });

  it("PlanDuJour rend null sans créneau et n'est pas un composant client ; AjouterDuJour l'est", async () => {
    const { PlanDuJour } = await import("@/components/calendrier/PlanDuJour");
    expect(renderToStaticMarkup(<PlanDuJour creneaux={[]} aujourdhui="2030-01-01" />)).toBe("");
    expect(lire("src/components/calendrier/PlanDuJour.tsx")).not.toContain('"use client"');
    expect(lire("src/components/calendrier/AjouterDuJour.tsx")).toMatch(/^"use client"/);
  });
});
