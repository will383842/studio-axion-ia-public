/**
 * Réglages › « Sujets déjà traités » : Will règle LUI-MÊME `sujets.garde` (bloquant / avertissement / eteint).
 * Valeur hors liste refusée, session exigée, valeur relue par `lireGardeSujets` sans redémarrage, défaut « bloquant », journal, aucun réseau.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { lireGardeSujets, REGLAGE_GARDE_SUJETS } = await import("@/services/sujets-traites");
const { definirGardeSujetsAction } = await import("@/app/(studio)/reglages/actions-garde-sujets");
const { GardeSujetsReglage, TEXTES_GARDE_SUJETS } = await import("@/components/reglages/GardeSujetsReglage");

const MDP = "essai-garde-sujets";
const appelsReseau: string[] = [];

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  appelsReseau.length = 0;
  vi.stubGlobal("fetch", (async (u: string | URL | Request) => {
    appelsReseau.push(String(u));
    throw new Error("réseau interdit");
  }) as typeof fetch);
  await auth.seConnecter(MDP, false);
});
afterEach(() => {
  vi.unstubAllGlobals();
  expect(appelsReseau).toEqual([]);
});

const journal = async () => (await depots().evenements.lister()).filter((e) => e.message.includes("Sujets déjà traités"));

describe("défaut", () => {
  it("rien d'écrit → « bloquant », aucune ligne en base", async () => {
    expect(await lireGardeSujets()).toBe("bloquant");
    expect(await lireParametre<unknown>(REGLAGE_GARDE_SUJETS, "absent")).toBe("absent");
  });
  it("valeur inconnue en base → « bloquant »", async () => {
    await ecrireParametre(REGLAGE_GARDE_SUJETS, "n'importe quoi");
    expect(await lireGardeSujets()).toBe("bloquant");
  });
});

describe("écriture", () => {
  it.each(["bloquant", "avertissement", "eteint"] as const)("« %s » enregistré, relu tout de suite par lireGardeSujets, journalisé", async (v) => {
    await definirGardeSujetsAction(v === "bloquant" ? "eteint" : "bloquant");
    const r = await definirGardeSujetsAction(v);
    expect(r.ok).toBe(true);
    expect(await lireGardeSujets()).toBe(v);
    const libelle = { bloquant: "bloquant", avertissement: "avertissement seulement", eteint: "éteint" }[v];
    const avantLibelle = v === "bloquant" ? "éteint" : "bloquant";
    expect((await journal()).some((e) => e.message === `Sujets déjà traités : ${avantLibelle} → ${libelle}`)).toBe(true);
  });
  it.each([["Bloquant"], ["off"], [""], [null], [undefined], [1], [true], [{ garde: "eteint" }], [["eteint"]]])("valeur invalide %j refusée, rien d'écrit", async (v) => {
    const r = await definirGardeSujetsAction(v);
    expect(r.ok).toBe(false);
    expect(await lireParametre<unknown>(REGLAGE_GARDE_SUJETS, "absent")).toBe("absent");
    expect(await journal()).toHaveLength(0);
  });
  it("même valeur deux fois : une seule ligne de journal", async () => {
    await definirGardeSujetsAction("eteint");
    await definirGardeSujetsAction("eteint");
    expect(await journal()).toHaveLength(1);
  });
  it("valeur illisible en base + choix « Bloquer » : la valeur propre est réécrite", async () => {
    await ecrireParametre(REGLAGE_GARDE_SUJETS, "n'importe quoi");
    expect((await definirGardeSujetsAction("bloquant")).ok).toBe(true);
    expect(await lireParametre<unknown>(REGLAGE_GARDE_SUJETS, "absent")).toBe("bloquant");
  });
  it("session exigée : déconnecté, rien n'est écrit", async () => {
    await auth.seDeconnecter();
    await expect(definirGardeSujetsAction("eteint")).rejects.toMatchObject({ vers: "/connexion" });
    expect(await lireParametre<unknown>(REGLAGE_GARDE_SUJETS, "absent")).toBe("absent");
  });
});

describe("écran", () => {
  it("trois choix en français simple, le choix en vigueur est coché", () => {
    const html = renderToStaticMarkup(createElement(GardeSujetsReglage, { garde: "avertissement" }));
    expect(html).toContain("Sujets déjà traités");
    expect(html).toContain(TEXTES_GARDE_SUJETS.bloquant);
    expect(html).toContain(TEXTES_GARDE_SUJETS.avertissement);
    expect(html).toContain(TEXTES_GARDE_SUJETS.eteint);
    expect(html).toContain(TEXTES_GARDE_SUJETS.detailBloquant);
    expect(TEXTES_GARDE_SUJETS.bloquant).toContain("conseillé");
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-checked="true"[^>]*>(?:(?!<button)[\s\S])*Prévenir seulement/);
    expect(html).not.toMatch(/Villeexemple|Aucun gain garanti/);
  });
});
