/**
 * Portage phase 2 · P4 : la porte B est derrière `casConcret.porteB`, ÉTEINT par défaut. Éteint : aucun appel Claude,
 * aucun brouillon créé, aucun lancement. Allumé (dans la base de test seulement) : le chemin normal. Base en mémoire.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const auth = await import("@/services/auth");
const service = await import("@/services/cas-concret");
const porteB = await import("@/services/cas-concret-porte-b");

import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";

const MDP = "cas-concret-porte-b-reglage";
const CABINET = "Un cabinet comptable qui reçoit 200 factures par mois et les saisit à la main, une par une.";

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("Aucun appel réseau dans ces tests.");
  });
});
afterEach(() => vi.restoreAllMocks());

const executer = vi.fn(async (_videoId: string, role: DefinitionRole, entree: EntreeRole) => ({ ok: true as const, simule: true, donnees: role.simuler(entree) }));
const dep = () => ({ executer, claudeActif: async () => true, verifierBudget: vi.fn(async () => undefined) });
const videosCas = () => depots().videos.lister((v) => v.formatId === "cas-concret");

describe("P4 · porte B éteinte (défaut)", () => {
  beforeEach(() => {
    executer.mockClear();
  });

  it("demarrerPorteB refuse sans aucun appel et ne crée aucun brouillon", async () => {
    const etat = await porteB.demarrerPorteB(CABINET, dep());
    expect(etat.statut).toBe("refusee");
    expect(executer).not.toHaveBeenCalled();
    expect(await videosCas()).toEqual([]);
  });

  it("suivrePorteB et confirmerFaitPorteB refusent aussi, sans lire ni écrire", async () => {
    await ecrireParametre("casConcret.porteB", true);
    const d = dep();
    const etat = await porteB.demarrerPorteB(CABINET, { ...d, appels: { lancer: () => undefined, lire: async () => null } });
    if (etat.statut !== "en-cours") throw new Error(etat.statut);
    await ecrireParametre("casConcret.porteB", false);
    executer.mockClear();
    expect((await porteB.suivrePorteB(etat.videoId, d)).statut).toBe("refusee");
    await expect(porteB.confirmerFaitPorteB(etat.videoId, "f1", "confirmer")).rejects.toThrow();
    expect(executer).not.toHaveBeenCalled();
  });

  it("preparerEtLancer d'un brouillon de la porte B refuse tant que le réglage est éteint", async () => {
    await ecrireParametre("casConcret.porteB", true);
    const d = dep();
    const etat = await porteB.demarrerPorteB(CABINET, { ...d, appels: { lancer: () => undefined, lire: async () => null } });
    if (etat.statut !== "en-cours") throw new Error(etat.statut);
    await ecrireParametre("casConcret.porteB", false);
    const lancer = vi.fn(async () => ({ travailId: "t" }));
    const r = await service.preparerEtLancer({ casId: "x", reseaux: ["instagram"], mot: "MOT", avecMot: false, accordCentimes: 10_000, porteB: etat.videoId }, { lancer });
    expect(r.statut).toBe("refusee");
    expect(lancer).not.toHaveBeenCalled();
  });

  it("estimerCas d'un brouillon de la porte B ne le lit pas non plus", async () => {
    await expect(service.estimerCas("x", ["instagram"], false, { porteB: "v-inconnu" })).rejects.toThrow();
  });
});

describe("P4 · porte B allumée dans la base de test", () => {
  it("demarrerPorteB accepte un texte valable (l'appel part détaché, pas attendu)", async () => {
    await ecrireParametre("casConcret.porteB", true);
    executer.mockClear();
    const etat = await porteB.demarrerPorteB(CABINET, { ...dep(), appels: { lancer: () => undefined, lire: async () => null } });
    expect(etat.statut).toBe("en-cours");
    expect(await videosCas()).toHaveLength(1);
  });
});

describe("P4 · la case de texte libre suit le réglage", () => {
  it("« Faire la vidéo de ce cas » n'est proposé que réglage allumé ET deux mots utiles", async () => {
    const { boutonPorteBVisible } = await import("@/components/formats/cas-concret/entree/vue");
    const phrase = "montre comment on relance les devis";
    expect(boutonPorteBVisible(false, phrase)).toBe(false);
    expect(boutonPorteBVisible(undefined, phrase)).toBe(false);
    expect(boutonPorteBVisible(true, phrase)).toBe(true);
    expect(boutonPorteBVisible(true, "devis")).toBe(false);
  });

  it("la page lit le réglage et le passe à l'écran (éteint par défaut)", async () => {
    const { readFileSync } = await import("node:fs");
    const page = readFileSync("src/app/(studio)/cas-concret/page.tsx", "utf8");
    expect(page).toMatch(/reglageAllume\(REGLAGES_CAS_CONCRET\.porteB\)/);
    expect(page).toMatch(/porteB=\{porteB\}/);
  });
});
