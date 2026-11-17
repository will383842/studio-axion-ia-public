/**
 * G3-06a-a : action serveur « créer le brouillon » de la démo facecam, derrière le réglage `demoFacecam.envoi` (éteint).
 * Rien n'est lancé, aucun prix n'est lu, aucune dépense. Données en mémoire.
 */
import { readFileSync } from "node:fs";
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre } = await import("@/services/_commun");
const { fabriquerEntreesDemoFacecam } = await import("@/services/entrees-demo-facecam");
const { creerDemoFacecam } = await import("@/app/(studio)/demo-facecam/actions");

const MDP = "essai-creation-demo-facecam";
const FICHIER = "src/app/(studio)/demo-facecam/actions.ts";
const demo = { titre: "Démo", videoFacecamId: "vf", videoEcranId: "ve" };

beforeAll(async () => {
  process.env.SESSION_SECRET = "e".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

const lister = async (d: "videos" | "travaux") => (await depots()[d].lister()) as unknown[];

describe("creerDemoFacecam : réglage éteint", () => {
  it.each([
    ["absent", undefined],
    ["false", false],
    ['"true" (texte)', "true"],
    ["1", 1],
  ])("réglage %s : DEMO_FERMEE, aucune écriture", async (_n, valeur) => {
    if (valeur !== undefined) await ecrireParametre("demoFacecam.envoi", valeur);
    const videosAvant = (await lister("videos")).length;
    const travauxAvant = (await lister("travaux")).length;
    const r = await creerDemoFacecam({ titre: "Démo", demoFacecam: demo });
    expect(r).toEqual({ ok: false, message: "La démo facecam n'est pas encore ouverte.", code: "DEMO_FERMEE" });
    expect(await lister("videos")).toHaveLength(videosAvant);
    expect(await lister("travaux")).toHaveLength(travauxAvant);
  });
});

describe("creerDemoFacecam : réglage allumé (true exact)", () => {
  it("crée un brouillon demo-facecam, rien de lancé", async () => {
    await ecrireParametre("demoFacecam.envoi", true);
    const videosAvant = (await lister("videos")).length;
    const travauxAvant = (await lister("travaux")).length;
    const r = await creerDemoFacecam({ titre: "Démo", demoFacecam: demo });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const v = await depots().videos.obtenir(r.donnees.videoId);
    expect(v?.formatId).toBe("demo-facecam");
    expect(v?.statut).toBe("brouillon");
    expect(v?.entrees).toEqual(await fabriquerEntreesDemoFacecam(demo));
    expect(v?.entrees && "facecamAligneurReel" in v.entrees).toBe(false);
    expect(await lister("videos")).toHaveLength(videosAvant + 1);
    expect(await lister("travaux")).toHaveLength(travauxAvant);
  });

  it("avec demoFacecam.reel allumé : facecamAligneurReel présent", async () => {
    await ecrireParametre("demoFacecam.envoi", true);
    await ecrireParametre("demoFacecam.reel", true);
    const r = await creerDemoFacecam({ titre: "Démo", demoFacecam: demo });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const v = await depots().videos.obtenir(r.donnees.videoId);
    expect((v?.entrees as Record<string, unknown>).facecamAligneurReel).toBe(true);
  });
});

describe("garde statique du fichier d'actions", () => {
  const texte = readFileSync(FICHIER, "utf8");
  it('première ligne "use server";', () => expect(texte.split("\n")[0]).toBe('"use server";'));
  it("n'exporte que des fonctions async", () => {
    const exports = texte.split("\n").filter((l) => /^export\b/.test(l));
    expect(exports.length).toBeGreaterThan(0);
    for (const l of exports) expect(l).toMatch(/^export async function /);
  });
  it.each(["fabrication", "lancerAvecAccord", "apercuFabrication", "mode-budget", "credits", "couts"])("ne contient pas « %s »", (mot) => {
    expect(texte).not.toContain(mot);
  });
});
