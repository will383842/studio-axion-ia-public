/**
 * Réglages › Écriture des scripts : le bouton qui choisit la chaîne d'écriture (réglage `generateur.chaine`).
 * Depuis le 23/10/2026 (Will : « on garde l'Économique »), seule « courte » se choisit ; « equipe » et la grande sont verrouillées.
 * Valeurs strictes (« courte » seulement), session exigée, journal sans doublon, aucun réseau.
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

describe("l'aiguillage : toute NOUVELLE écriture passe par la courte", () => {
  it.each([undefined, "courte", "equipe", "complete", "grande", "equipe-v2", "Equipe", "", null, 1, {}])("réglage %j : la courte écrit et l'écran coche « courte »", async (v) => {
    if (v !== undefined) await ecrireParametre(gc.PARAM_CHAINE, v);
    expect(await gc.chaineDeLEcriture()).toBe("courte");
    expect(await lireChaineReglee()).toBe("courte");
  });
  it("le mode « je choisis » ne ramène jamais la grande chaîne", async () => {
    for (const v of ["courte", "equipe", "complete"]) {
      await ecrireParametre(gc.PARAM_CHAINE, v);
      expect(await gc.chaineDeLEcriture("je-choisis")).toBe("courte");
    }
  });
  it("le crochet d'essai peut encore forcer equipe ou la grande (leur code reste), puis revenir à la courte", async () => {
    gc.forcerChainePourEssai("equipe");
    expect(await gc.chaineDeLEcriture()).toBe("equipe");
    gc.forcerChainePourEssai("grande");
    expect(await gc.chaineDeLEcriture()).toBe("grande");
    gc.forcerChainePourEssai(null);
    expect(await gc.chaineDeLEcriture()).toBe("courte");
  });
});

describe("l'action serveur", () => {
  it("« courte » : réglage posé, une ligne de journal ; un second appel identique ne journalise rien", async () => {
    await ecrireParametre(gc.PARAM_CHAINE, "equipe");
    const avant = await lignesReglages();
    const r = await definirChaineEcritureAction("courte");
    expect(r.ok).toBe(true);
    expect(await lireParametre(gc.PARAM_CHAINE, null)).toBe("courte");
    expect(await lignesReglages()).toBe(avant + 1);
    expect((await definirChaineEcritureAction("courte")).ok).toBe(true);
    expect(await lignesReglages()).toBe(avant + 1);
  });

  it.each(["equipe", "complete", "grande", "equipe-v2", "Equipe", "", null, 1, {}, ["courte"]])("valeur refusée %j : rien ne change", async (v) => {
    await ecrireParametre(gc.PARAM_CHAINE, "courte");
    const r = await definirChaineEcritureAction(v);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("CHOIX_INCONNU");
    expect(await lireParametre(gc.PARAM_CHAINE, null)).toBe("courte");
  });

  it("sans session : refusé, rien ne change", async () => {
    await ecrireParametre(gc.PARAM_CHAINE, "courte");
    await auth.seDeconnecter();
    await expect(definirChaineEcritureAction("courte")).rejects.toBeTruthy();
    expect(await lireParametre(gc.PARAM_CHAINE, null)).toBe("courte");
  });
});

describe("l'affichage", () => {
  it("un seul choix, « Économique », coché, avec son coût et l'avertissement ; plus de Premium, rien de garanti", () => {
    const html = renderToStaticMarkup(createElement(ChoixChaineEcriture, { initiale: "courte" }));
    expect(html).toContain('role="radiogroup"');
    for (const t of ["Économique", "0,28 $", "prochains scripts"]) expect(html).toContain(t);
    for (const t of ["Premium", "0,39 $", "grande chaîne"]) expect(html).not.toContain(t);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html.match(/role="radio"/g)).toHaveLength(1);
    expect(html).not.toMatch(/garanti/i);
  });
  it("valeur inconnue en base (« complete », « equipe ») : l'écran montre « Économique » cochée", async () => {
    for (const v of ["complete", "equipe", "n'importe quoi"]) {
      await ecrireParametre(gc.PARAM_CHAINE, v);
      const html = renderToStaticMarkup(createElement(ChoixChaineEcriture, { initiale: await lireChaineReglee() }));
      expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
      expect(html).not.toContain("Premium");
    }
  });
});
