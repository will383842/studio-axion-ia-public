/**
 * Réglages › Plafond d'un sujet (Écrire) : Will règle LUI-MÊME `generateur.plafondSujetUsd`.
 * Montants en centimes de dollar entiers, bornes 0,50 $ à 5 $, session exigée, journal (ancienne et nouvelle valeur),
 * défaut 1,50 $ inchangé sans saisie, aucun effet sur le plafond de la grande chaîne, aucun réseau.
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
const { lirePlafondSujet, BORNES_PLAFOND_SUJET_CENTIMES } = await import("@/services/plafond-sujet");
const { definirPlafondSujetAction } = await import("@/app/(studio)/reglages/actions-plafond-sujet");

const { PlafondSujet, centimesDepuisTexte } = await import("@/components/reglages/PlafondSujet");

const MDP = "essai-plafond-sujet";
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

const journal = async () => (await depots().evenements.lister()).filter((e) => e.message.includes("Plafond d'un sujet"));

describe("défaut inchangé sans saisie", () => {
  it("rien d'écrit → 150 centimes (1,50 $), aucune ligne en base, aucune ligne de journal", async () => {
    expect(await lirePlafondSujet()).toMatchObject({ usd: 1.5, centimes: 150, reglee: false, horsBornes: false });
    expect(await lireParametre<unknown>(gc.PARAM_PLAFOND_SUJET, "absent")).toBe("absent");
    expect(gc.PLAFOND_PAR_DEFAUT_USD).toBe(1.5);
    expect(await journal()).toHaveLength(0);
  });
  it("valeur illisible en base → défaut", async () => {
    await ecrireParametre(gc.PARAM_PLAFOND_SUJET, "beaucoup");
    expect(await lirePlafondSujet()).toMatchObject({ usd: 1.5, centimes: 150, reglee: false, horsBornes: false });
  });
});

describe("valeur déjà posée hors des bornes de saisie : la VRAIE valeur appliquée", () => {
  it.each([
    [10, 1000, "10,00 $"],
    [0.2, 20, "0,20 $"],
    [0, 0, "0,00 $"],
    [1.234, 123, "1,234 $"],
  ])("%s $ en base : lue telle quelle, signalée hors bornes, identique à plafondChaineUsd", async (usd, centimes, texte) => {
    await ecrireParametre(gc.PARAM_PLAFOND_SUJET, usd);
    const l = await lirePlafondSujet();
    expect(l).toMatchObject({ usd, centimes, reglee: true, horsBornes: true });
    expect(l.usd).toBe(await gc.plafondChaineUsd("courte"));
    const html = renderToStaticMarkup(createElement(PlafondSujet, { ...l, chaine: "courte" }));
    expect(html).toContain(`Plafond actuel : ${texte}`);
    expect(html).not.toContain("par défaut");
    expect(html).toContain("hors des bornes de saisie");
  });
  it("une valeur dans les bornes n'est pas signalée", async () => {
    await ecrireParametre(gc.PARAM_PLAFOND_SUJET, 2);
    expect(await lirePlafondSujet()).toMatchObject({ usd: 2, centimes: 200, reglee: true, horsBornes: false });
  });
  it("le journal écrit la vraie ancienne valeur, pas 1,50 $", async () => {
    await ecrireParametre(gc.PARAM_PLAFOND_SUJET, 10);
    expect((await definirPlafondSujetAction(200)).ok).toBe(true);
    const l = await journal();
    expect(l).toHaveLength(1);
    expect(l[0].message).toContain("10,00 $ → 2,00 $");
    expect(l[0].message).not.toContain("1,50 $");
  });
  it("ressaisir la valeur déjà appliquée (hors bornes) n'écrit rien", async () => {
    await ecrireParametre(gc.PARAM_PLAFOND_SUJET, 5);
    expect((await definirPlafondSujetAction(500)).ok).toBe(true);
    expect(await journal()).toHaveLength(0);
  });
});

describe("refus hors bornes", () => {
  it.each([[49], [0], [-100], [501], [100000], [150.5], [Number.NaN], [Number.POSITIVE_INFINITY], ["200"], [null], [undefined]])("%s est refusé, rien n'est écrit ni journalisé", async (v) => {
    const r = await definirPlafondSujetAction(v);
    expect(r.ok).toBe(false);
    expect(await lireParametre<unknown>(gc.PARAM_PLAFOND_SUJET, "absent")).toBe("absent");
    expect(await journal()).toHaveLength(0);
  });
  it("les bornes elles-mêmes sont acceptées : 50 et 500", async () => {
    expect(BORNES_PLAFOND_SUJET_CENTIMES).toEqual({ min: 50, max: 500 });
    expect((await definirPlafondSujetAction(50)).ok).toBe(true);
    expect((await definirPlafondSujetAction(500)).ok).toBe(true);
  });
});

describe("écriture", () => {
  it("valeur posée, lue par lirePlafondSujet ET par la chaîne courte, journal avec ancienne et nouvelle valeur", async () => {
    const r = await definirPlafondSujetAction(200);
    expect(r.ok).toBe(true);
    expect(await lirePlafondSujet()).toMatchObject({ usd: 2, centimes: 200, reglee: true, horsBornes: false });
    expect(await gc.plafondChaineUsd("courte")).toBe(2);
    const l = await journal();
    expect(l).toHaveLength(1);
    expect(l[0].message).toContain("1,50 $");
    expect(l[0].message).toContain("2,00 $");
    expect(l[0].date).toBeTruthy();
  });
  it("une 2e modification journalise l'ancienne valeur saisie ; la même valeur ne journalise rien", async () => {
    await definirPlafondSujetAction(200);
    await definirPlafondSujetAction(200);
    expect(await journal()).toHaveLength(1);
    await definirPlafondSujetAction(75);
    const l = await journal();
    expect(l).toHaveLength(2);
    expect(l.some((e) => e.message.includes("2,00 $") && e.message.includes("0,75 $"))).toBe(true);
  });
  it("aucun effet sur le plafond de la grande chaîne", async () => {
    await definirPlafondSujetAction(300);
    expect(await lireParametre<unknown>(gc.PARAM_PLAFOND_GRANDE_CHAINE, "absent")).toBe("absent");
    expect(await gc.plafondChaineUsd("grande")).toBe(1.5);
  });
});

describe("session", () => {
  it("sans session, l'action refuse et n'écrit rien", async () => {
    await auth.seDeconnecter();
    reinitialiserRequete();
    await expect(definirPlafondSujetAction(200)).rejects.toBeDefined();
    expect(await lireParametre<unknown>(gc.PARAM_PLAFOND_SUJET, "absent")).toBe("absent");
  });
});

describe("l'écran", () => {
  it("lit la saisie en centimes entiers, sans flottant", () => {
    expect(centimesDepuisTexte("1,5")).toBe(150);
    expect(centimesDepuisTexte("1.50")).toBe(150);
    expect(centimesDepuisTexte("0,29")).toBe(29);
    expect(centimesDepuisTexte("2")).toBe(200);
    for (const mauvais of ["", "abc", "1,555", "-1", "1e2", "100"]) expect(centimesDepuisTexte(mauvais)).toBeNull();
  });
  it("affiche l'intitulé, l'explication et le plafond actuel (défaut signalé)", () => {
    const html = renderToStaticMarkup(createElement(PlafondSujet, { usd: 1.5, centimes: 150, reglee: false, horsBornes: false, chaine: null }));
    expect(html).toContain("Plafond d&#x27;un sujet (Écrire)");
    expect(html).toContain("pas le prix");
    expect(html).toContain("0,3 à 0,4 $");
    expect(html).toContain("Plafond actuel : 1,50 $");
    expect(html).toContain("par défaut");
    expect(html).not.toContain("hors des bornes");
  });
  it("dit que le plafond s'applique à la chaîne « courte » (équipe et grande verrouillées) et montre la chaîne active", () => {
    const rendu = (chaine: "courte" | "equipe" | null) => renderToStaticMarkup(createElement(PlafondSujet, { usd: 1.5, centimes: 150, reglee: false, horsBornes: false, chaine }));
    expect(rendu(null)).toContain("s&#x27;applique à la chaîne « courte »");
    expect(rendu("courte")).toContain("Chaîne active : courte");
    expect(rendu("equipe")).toContain("Chaîne active : équipe");
    expect(rendu(null)).toContain("Chaîne active : grande");
  });
});
