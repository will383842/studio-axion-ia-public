/**
 * Réglages › Écriture des scripts : 4 interrupteurs (mémoire centrale, tableaux, cas concrets, adaptation par réseau).
 * Liste blanche de 4 clés, booléen exact, éteints par défaut, session exigée, aucun réseau.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));
const branchement = vi.hoisted(() => ({ branchees: false }));
vi.mock("@/reseaux/branchement-adaptations", () => ({
  get ADAPTATIONS_BRANCHEES() {
    return branchement.branchees;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { memoireCentraleAllumee } = await import("@/services/memoire-centrale");
const { memoireTableauAllumee } = await import("@/services/tableau-scripts/memoire");
const { memoireCasConcretAllumee } = await import("@/services/memoire-cas-concret");
const { CLE_ADAPTATIONS_RESEAUX, adaptationsActives } = await import("@/reseaux/adaptations");
const { CLES_INTERRUPTEURS_ECRITURE, lireInterrupteursEcriture } = await import("@/services/interrupteurs-ecriture");
const { definirInterrupteurEcritureAction } = await import("@/app/(studio)/reglages/actions-interrupteurs-ecriture");
const { InterrupteursEcriture } = await import("@/components/reglages/InterrupteursEcriture");
const moduleBranchement = await import("@/reseaux/branchement-adaptations");
const { ADAPTATIONS_BRANCHEES: ADAPTATIONS_BRANCHEES_REELLE } = await vi.importActual<typeof import("@/reseaux/branchement-adaptations")>("@/reseaux/branchement-adaptations");

const MDP = "essai-interrupteurs-ecriture";
const appelsReseau: string[] = [];

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  branchement.branchees = false;
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

describe("liste blanche et état par défaut", () => {
  it("exactement 4 clés", () => {
    expect([...CLES_INTERRUPTEURS_ECRITURE].sort()).toEqual(["adaptations_reseaux.actif", "ecriture.memoireCasConcret", "ecriture.memoireCentrale", "ecriture.memoireTableau"]);
    expect(CLE_ADAPTATIONS_RESEAUX).toBe("adaptations_reseaux.actif");
  });
  it("base vide : les 4 sont éteints, et les services lisent éteint", async () => {
    expect(await lireInterrupteursEcriture()).toEqual({
      "ecriture.memoireCentrale": false,
      "ecriture.memoireTableau": false,
      "ecriture.memoireCasConcret": false,
      "adaptations_reseaux.actif": false,
    });
    expect(await memoireCentraleAllumee()).toBe(false);
    expect(await memoireTableauAllumee()).toBe(false);
    expect(await memoireCasConcretAllumee()).toBe(false);
  });
  it("seul `true` exact s'affiche allumé", async () => {
    await ecrireParametre("ecriture.memoireCentrale", "true");
    await ecrireParametre("ecriture.memoireTableau", 1);
    expect((await lireInterrupteursEcriture())["ecriture.memoireCentrale"]).toBe(false);
    expect((await lireInterrupteursEcriture())["ecriture.memoireTableau"]).toBe(false);
  });
  it("simulation du branchement : false par défaut, bascule à true", () => {
    expect(moduleBranchement.ADAPTATIONS_BRANCHEES).toBe(false);
    branchement.branchees = true;
    expect(moduleBranchement.ADAPTATIONS_BRANCHEES).toBe(true);
  });
  it("la vraie constante est à true (réglage toujours éteint par défaut)", () => {
    expect(ADAPTATIONS_BRANCHEES_REELLE).toBe(true);
  });
});

describe("l'action serveur : round-trip avec les services", () => {
  it("mémoire centrale : true → le service renvoie true, false → false, une ligne de journal par changement", async () => {
    const avant = await lignesReglages();
    expect((await definirInterrupteurEcritureAction("ecriture.memoireCentrale", true)).ok).toBe(true);
    expect(await lireParametre("ecriture.memoireCentrale", null)).toBe(true);
    expect(await memoireCentraleAllumee()).toBe(true);
    expect(await lignesReglages()).toBe(avant + 1);
    expect((await definirInterrupteurEcritureAction("ecriture.memoireCentrale", true)).ok).toBe(true);
    expect(await lignesReglages()).toBe(avant + 1);
    expect((await definirInterrupteurEcritureAction("ecriture.memoireCentrale", false)).ok).toBe(true);
    expect(await lireParametre("ecriture.memoireCentrale", null)).toBe(false);
    expect(await memoireCentraleAllumee()).toBe(false);
    expect(await lignesReglages()).toBe(avant + 2);
  });
  it("tableaux : round-trip, sans toucher aux autres", async () => {
    await definirInterrupteurEcritureAction("ecriture.memoireTableau", true);
    expect(await memoireTableauAllumee()).toBe(true);
    expect(await memoireCentraleAllumee()).toBe(false);
    expect(await memoireCasConcretAllumee()).toBe(false);
  });
  it("cas concrets : round-trip", async () => {
    await definirInterrupteurEcritureAction("ecriture.memoireCasConcret", true);
    expect(await memoireCasConcretAllumee()).toBe(true);
    expect(await memoireCentraleAllumee()).toBe(false);
  });
  it("adaptation par réseau : refusée tant que non branchée ; extinction toujours permise", async () => {
    branchement.branchees = false;
    const r = await definirInterrupteurEcritureAction("adaptations_reseaux.actif", true);
    expect(r.ok).toBe(false);
    expect(adaptationsActives(await lireParametre("adaptations_reseaux.actif", false))).toBe(false);
    expect((await definirInterrupteurEcritureAction("adaptations_reseaux.actif", false)).ok).toBe(true);
  });
  it("adaptation par réseau : constante à true => l'écriture true est acceptée et relue true", async () => {
    branchement.branchees = true;
    const r = await definirInterrupteurEcritureAction("adaptations_reseaux.actif", true);
    expect(r.ok).toBe(true);
    expect(await lireParametre("adaptations_reseaux.actif", false)).toBe(true);
    expect(adaptationsActives(await lireParametre("adaptations_reseaux.actif", false))).toBe(true);
    expect((await lireInterrupteursEcriture())["adaptations_reseaux.actif"]).toBe(true);
    expect((await definirInterrupteurEcritureAction("adaptations_reseaux.actif", false)).ok).toBe(true);
    expect(await lireParametre("adaptations_reseaux.actif", true)).toBe(false);
  });
  it.each(["ecriture.autre", "generateur.chaine", "", null, 1, {}, ["ecriture.memoireCentrale"], "__proto__"])("clé refusée %j : rien n'est écrit", async (cle) => {
    const r = await definirInterrupteurEcritureAction(cle, true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("CHOIX_INCONNU");
    expect(await lireParametre("ecriture.autre", null)).toBeNull();
    expect(await lireParametre("generateur.chaine", null)).toBeNull();
  });
  it.each(["true", 1, 0, null, undefined, {}, "false"])("valeur refusée %j : rien ne change", async (v) => {
    const r = await definirInterrupteurEcritureAction("ecriture.memoireCentrale", v);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("CHOIX_INCONNU");
    expect(await lireParametre("ecriture.memoireCentrale", null)).toBeNull();
  });
  it("sans session : refusé, rien ne change", async () => {
    await auth.seDeconnecter();
    await expect(definirInterrupteurEcritureAction("ecriture.memoireCentrale", true)).rejects.toBeTruthy();
    expect(await lireParametre("ecriture.memoireCentrale", null)).toBeNull();
  });
});

describe("l'affichage", () => {
  const etat = { "ecriture.memoireCentrale": false, "ecriture.memoireTableau": true, "ecriture.memoireCasConcret": false, "adaptations_reseaux.actif": false } as const;
  it("4 interrupteurs, titres, bandeau, un seul allumé", () => {
    const html = renderToStaticMarkup(createElement(InterrupteursEcriture, { etat, adaptationsBranchees: false }));
    for (const t of ["Variété des scripts centraux", "Variété des tableaux", "Variété des cas concrets", "Adaptation par réseau", "Ne pas allumer pendant qu&#x27;une écriture est en cours"]) expect(html).toContain(t);
    expect(html.match(/role="switch"/g)).toHaveLength(4);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
  });
  it("adaptation : mention « pas encore actif » et interrupteur désactivé tant que non branchée", () => {
    const html = renderToStaticMarkup(createElement(InterrupteursEcriture, { etat, adaptationsBranchees: false }));
    expect(html).toContain("pas encore actif : en cours de branchement");
    const boutons = html.match(/<button[^>]*role="switch"[^>]*>/g) ?? [];
    expect(boutons).toHaveLength(4);
    expect(boutons.filter((b) => / disabled=""/.test(b))).toHaveLength(1);
    const branche = renderToStaticMarkup(createElement(InterrupteursEcriture, { etat, adaptationsBranchees: true }));
    expect(branche).not.toContain("pas encore actif");
    expect((branche.match(/<button[^>]*role="switch"[^>]*>/g) ?? []).filter((b) => / disabled=""/.test(b))).toHaveLength(0);
  });
  it("adaptation déjà allumée en base alors que non branchée : l'interrupteur reste utilisable pour l'éteindre", () => {
    const allume = { ...etat, "adaptations_reseaux.actif": true } as const;
    const html = renderToStaticMarkup(createElement(InterrupteursEcriture, { etat: allume, adaptationsBranchees: false }));
    const boutons = html.match(/<button[^>]*role="switch"[^>]*>/g) ?? [];
    expect(boutons.filter((b) => / disabled=""/.test(b))).toHaveLength(0);
  });
  it("adaptation : le texte annonce que seule la coupe de LinkedIn est branchée et déconseille d'allumer avant la répétition générale", () => {
    const html = renderToStaticMarkup(createElement(InterrupteursEcriture, { etat, adaptationsBranchees: true }));
    expect(html).toContain("seule la coupe des parties facultatives de LinkedIn est branchée");
    expect(html).toContain("répétition générale");
    expect(html).not.toContain("docs/");
    expect(html).not.toContain("pas encore actif");
  });
});
