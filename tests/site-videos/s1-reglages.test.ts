/** S1.7 — interrupteurs « Sur le site » : un par générateur, tous éteints, session exigée, journalisés. */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./helpers";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { depots } = await import("@/donnees/memoire");
const site = await import("@/services/site-videos");
const { ErreurStudio, lireParametre } = await import("@/services/_commun");
const { listerFormatsActifs } = await import("@/formats");

beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});
beforeEach(preparerBase);

describe("S1.7 réglages Sur le site", () => {
  it("base vide : une ligne par format actif, tous les interrupteurs éteints", async () => {
    const lignes = await site.lireReglagesSite();
    expect(lignes.map((l) => l.formatId).sort()).toEqual(listerFormatsActifs().map((f) => f.id).sort());
    expect(lignes.length).toBeGreaterThan(0);
    for (const l of lignes) {
      expect(l.generateur).toBe(false);
      expect(l.auto).toBe(false);
    }
    expect(await lireParametre("site.passeportParClaude", false)).toBe(false);
    expect(await lireParametre("site.lienDansYoutube", false)).toBe(false);
  });

  it("définir un générateur : écrit le réglage et journalise", async () => {
    await site.definirSiteGenerateur("avocat", true);
    expect(await lireParametre("siteGenerateurs.avocat", false)).toBe(true);
    expect((await site.lireReglagesSite()).find((l) => l.formatId === "avocat")!.generateur).toBe(true);
    expect((await depots().evenements.lister((e) => e.message.includes("Sur le site"))).length).toBe(1);
    await site.definirSiteGenerateur("avocat", false);
    expect(await lireParametre("siteGenerateurs.avocat", true)).toBe(false);
  });

  it("exige la session", async () => {
    reinitialiserRequete();
    await expect(site.definirSiteGenerateur("avocat", true)).rejects.toThrow();
    await expect(site.definirSiteAuto("avocat", true)).rejects.toThrow();
  });

  it("refuse un format inconnu ou masqué", async () => {
    await expect(site.definirSiteGenerateur("nexiste-pas", true)).rejects.toBeInstanceOf(ErreurStudio);
    await expect(site.definirSiteGenerateur("image-video", true)).rejects.toBeInstanceOf(ErreurStudio);
    await expect(site.definirSiteAuto("nexiste-pas", true)).rejects.toBeInstanceOf(ErreurStudio);
    expect(await lireParametre("siteGenerateurs.image-video", false)).toBe(false);
  });

  it("l'envoi automatique est refusé tant que le générateur est éteint", async () => {
    await expect(site.definirSiteAuto("avocat", true)).rejects.toBeInstanceOf(ErreurStudio);
    expect(await lireParametre("siteAuto.avocat", false)).toBe(false);
    await site.definirSiteGenerateur("avocat", true);
    await site.definirSiteAuto("avocat", true);
    expect(await lireParametre("siteAuto.avocat", false)).toBe(true);
  });

  it("éteindre le générateur éteint aussi son envoi automatique", async () => {
    await site.definirSiteGenerateur("avocat", true);
    await site.definirSiteAuto("avocat", true);
    await site.definirSiteGenerateur("avocat", false);
    expect(await lireParametre("siteAuto.avocat", true)).toBe(false);
  });
});
