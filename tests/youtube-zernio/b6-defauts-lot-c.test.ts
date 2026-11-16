import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const publications = await import("@/services/publications");
const formatsVoulus = await import("@/services/formats-voulus");
const reglages = await import("@/services/reglages");
const defauts = await import("@/domaine/reseaux-par-defaut");

const ATTENDU = ["linkedin", "instagram", "tiktok"];
const SIX_EMPLACEMENTS = ["src/services/publications.ts", "src/services/formats-voulus.ts", "src/services/reglages.ts", "src/services/telechargements.ts", "src/donnees/memoire/demo.ts"];

beforeAll(async () => {
  await preparerMotDePasse("essai-youtube-b6");
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter("essai-youtube-b6", false);
  // Base vide : le semis de démonstration est retiré (mémoire de test seulement).
  await depots().parametres.supprimer("reseaux.parDefaut");
});

describe("b6 · réseaux par défaut (lot C)", () => {
  it("base vide : les trois lecteurs rendent LinkedIn, Instagram, TikTok", async () => {
    expect(await publications.reseauxParDefaut()).toEqual(ATTENDU);
    expect(await formatsVoulus.reseauxParDefaut()).toEqual(ATTENDU);
    expect((await reglages.lireReglages()).reseauxParDefaut).toEqual(ATTENDU);
  });

  it("la constante est figée, YouTube Shorts est le réseau retiré, deux appels rendent deux tableaux distincts", async () => {
    expect(defauts.RESEAUX_PAR_DEFAUT).toEqual(ATTENDU);
    expect(Object.isFrozen(defauts.RESEAUX_PAR_DEFAUT)).toBe(true);
    expect(defauts.RESEAU_RETIRE_DES_DEFAUTS).toBe("youtube-shorts");
    const a = defauts.reseauxParDefautNeufs();
    const b = defauts.reseauxParDefautNeufs();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a).not.toBe(defauts.RESEAUX_PAR_DEFAUT);
    a.push("facebook");
    expect(defauts.RESEAUX_PAR_DEFAUT).toEqual(ATTENDU);
    const x = await publications.reseauxParDefaut();
    const y = await publications.reseauxParDefaut();
    expect(x).not.toBe(y);
  });

  it("lecture de texte : plus aucun littéral « tiktok », « youtube-shorts » comme défaut aux emplacements du lot", () => {
    for (const f of SIX_EMPLACEMENTS) {
      const t = readFileSync(f, "utf8");
      expect(t, f).not.toMatch(/"tiktok", "youtube-shorts"\]/);
    }
    expect(readFileSync("src/services/publications.ts", "utf8")).toMatch(/reseauxParDefautNeufs\(\)/);
  });

  it("le semis de démonstration ne coche plus YouTube Shorts", async () => {
    reinitialiserDepots();
    const p = await depots().parametres.obtenir("reseaux.parDefaut");
    expect(p?.valeur).toEqual(ATTENDU);
  });

  it("RESEAUX_ENVOI du plan éditorial contient toujours youtube-shorts (liste des réseaux possibles)", () => {
    const t = readFileSync("src/services/plan-editorial.ts", "utf8");
    expect(t).toMatch(/RESEAUX_ENVOI[^\n]*youtube-shorts/);
  });
});
