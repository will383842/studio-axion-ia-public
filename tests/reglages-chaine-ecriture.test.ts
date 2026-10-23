/**
 * Réglages › Écriture des scripts : le bouton qui choisit la chaîne d'écriture (réglage `generateur.chaine`).
 * Valeurs strictes (« courte » / « equipe »), session exigée, journal sans doublon, aucun réseau.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const gc = await import("@/services/generation-claude");
const { lireChaineReglee } = await import("@/services/chaine-ecriture");
const { definirChaineEcritureAction } = await import("@/app/(studio)/reglages/actions-chaine");
const { ChoixChaineEcriture } = await import("@/components/reglages/ChoixChaineEcriture");

const MDP = "essai-chaine-ecriture";
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

const lignesReglages = async () => (await depots().evenements.lister()).filter((e) => e.type === "reglages").length;

describe("lecture de ce que l'écran coche", () => {
  it("absent → « courte » cochée (c'est elle qui écrit, lot A5) ; « complete » → rien de coché ; « courte » et « equipe » → coché", async () => {
    expect(await lireChaineReglee()).toBe("courte");
    expect(await gc.chaineDeLEcriture()).toBe("courte");
    await ecrireParametre(gc.PARAM_CHAINE, "complete");
    expect(await lireChaineReglee()).toBeNull();
    expect(await gc.chaineDeLEcriture()).toBe("grande");
    await ecrireParametre(gc.PARAM_CHAINE, "courte");
    expect(await lireChaineReglee()).toBe("courte");
    await ecrireParametre(gc.PARAM_CHAINE, "equipe");
    expect(await lireChaineReglee()).toBe("equipe");
  });
});

describe("l'action serveur", () => {
  it("« equipe » : réglage posé, lu par l'écriture, une ligne de journal ; un second appel identique ne journalise rien", async () => {
    const avant = await lignesReglages();
    const r = await definirChaineEcritureAction("equipe");
    expect(r.ok).toBe(true);
    expect(await lireParametre(gc.PARAM_CHAINE, null)).toBe("equipe");
    expect(await gc.chaineDeLEcriture()).toBe("equipe");
    expect(await lignesReglages()).toBe(avant + 1);
    const encore = await definirChaineEcritureAction("equipe");
    expect(encore.ok).toBe(true);
    expect(await lignesReglages()).toBe(avant + 1);
  });

  it("revenir à « courte » est pris en compte tout de suite", async () => {
    await definirChaineEcritureAction("equipe");
    expect((await definirChaineEcritureAction("courte")).ok).toBe(true);
    expect(await gc.chaineDeLEcriture()).toBe("courte");
  });

  it.each(["complete", "grande", "equipe-v2", "Equipe", "", null, 1, {}, ["courte"]])("valeur refusée %j : rien ne change", async (v) => {
    await ecrireParametre(gc.PARAM_CHAINE, "courte");
    const r = await definirChaineEcritureAction(v);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("CHOIX_INCONNU");
    expect(await lireParametre(gc.PARAM_CHAINE, null)).toBe("courte");
  });

  it("sans session : refusé, rien ne change", async () => {
    await ecrireParametre(gc.PARAM_CHAINE, "courte");
    await auth.seDeconnecter();
    await expect(definirChaineEcritureAction("equipe")).rejects.toBeTruthy();
    expect(await lireParametre(gc.PARAM_CHAINE, null)).toBe("courte");
  });

  it("réglage ABSENT : la chaîne courte écrit (lot A5) ; « complete » : la grande", async () => {
    expect(await lireParametre(gc.PARAM_CHAINE, null)).toBeNull();
    expect(await gc.chaineDeLEcriture()).toBe("courte");
    await ecrireParametre(gc.PARAM_CHAINE, "complete");
    expect(await gc.chaineDeLEcriture()).toBe("grande");
  });

  it("le mode « je choisis » reste sur la grande chaîne, quel que soit le bouton", async () => {
    await definirChaineEcritureAction("equipe");
    expect(await gc.chaineDeLEcriture("je-choisis")).toBe("grande");
  });
});

describe("l'affichage", () => {
  it("deux choix avec leur coût, un seul coché, l'avertissement, rien de garanti", () => {
    const html = renderToStaticMarkup(createElement(ChoixChaineEcriture, { initiale: "courte" }));
    expect(html).toContain('role="radiogroup"');
    for (const t of ["Économique", "Premium", "0,28 $", "0,39 $", "prochains scripts"]) expect(html).toContain(t);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html).not.toMatch(/garanti/i);
  });
  it("réglage « complete » en base : aucun choix coché, la grande chaîne écrit", () => {
    const html = renderToStaticMarkup(createElement(ChoixChaineEcriture, { initiale: null }));
    expect(html).not.toContain('aria-checked="true"');
    expect(html).toContain("grande chaîne");
  });
});
