/**
 * G3-06a-b : action serveur « lancer la démo facecam avec accord », derrière `demoFacecam.envoi` (éteint).
 * Chemin réel : vraie session, dépôts mémoire, vrais `creerDemoFacecam`, `lancerAvecAccord`, `accordAutomatique`.
 * Seuls `apercuFabrication` et `lancerFabrication` sont doublés (espions) : aucun rendu, aucun euro.
 */
import { readFileSync } from "node:fs";
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p), revalidateTag: vi.fn() }));

const prix = { centimes: 120 };
let apercuLeve: Error | null = null;
const apercuFabrication = vi.fn<(videoId: string) => Promise<{ estimation: { total: { centimes: number; devise: string } } }>>(async () => {
  if (apercuLeve) throw apercuLeve;
  return { estimation: { total: { centimes: prix.centimes, devise: "EUR" } } };
});
const lancerFabrication = vi.fn<(videoId: string, o: { confirme?: number }) => Promise<{ travailId: string }>>(async () => ({ travailId: "t-demo" }));
vi.mock("@/services/fabrication", () => ({
  apercuFabrication: (id: string) => apercuFabrication(id),
  lancerFabrication: (id: string, o: { confirme?: number }) => lancerFabrication(id, o),
}));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre, ErreurStudio } = await import("@/services/_commun");
const { nouveauBrouillonFormat } = await import("@/services/creation-format");
const { fabriquerEntreesDemoFacecam } = await import("@/services/entrees-demo-facecam");
const { creerDemoFacecam, demoFacecamOuverte } = await import("@/app/(studio)/demo-facecam/actions");
const { lancerDemoFacecam } = await import("@/app/(studio)/demo-facecam/actions-lancement");

const MDP = "essai-lancement-demo-facecam";
const FICHIER = "src/app/(studio)/demo-facecam/actions-lancement.ts";
const demo = { titre: "Démo", videoFacecamId: "vf", videoEcranId: "ve" };

beforeAll(async () => {
  process.env.SESSION_SECRET = "f".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  apercuLeve = null;
  prix.centimes = 120;
  vi.clearAllMocks();
});

async function brouillonDemo(): Promise<string> {
  await ecrireParametre("demoFacecam.envoi", true);
  const r = await creerDemoFacecam({ titre: "Démo", demoFacecam: demo });
  if (!r.ok) throw new Error(r.message);
  return r.donnees.videoId;
}

/** Version « commandée par l'Usine » : le mode indicatif ne s'applique pas, l'accord redevient bloquant. */
async function commandeeParUsine(videoId: string): Promise<void> {
  const m = new Date().toISOString();
  await depots().versions.enregistrer({
    id: `ver-${videoId}`, videoId, numero: 1, commande: { origine: "usine" }, creeLe: m, modifieLe: m,
  } as never);
}

describe("lancerDemoFacecam : réglage éteint", () => {
  it.each([
    ["absent", undefined],
    ["false", false],
    ['"true" (texte)', "true"],
    ["1", 1],
  ])("réglage %s : DEMO_FERMEE, aucun prix lu, rien de lancé", async (_n, valeur) => {
    // Brouillon posé par le vrai service de création (le réglage reste tel quel : absent ou éteint).
    const v = await nouveauBrouillonFormat({ formatId: "demo-facecam", titre: "Démo", sujet: "Démo", distribution: [], entrees: await fabriquerEntreesDemoFacecam(demo) });
    const videoId = v.id;
    if (valeur !== undefined) await ecrireParametre("demoFacecam.envoi", valeur);
    expect(await demoFacecamOuverte()).toBe(false);
    const r = await lancerDemoFacecam(videoId, 1000);
    expect(r).toEqual({ ok: false, message: "La démo facecam n'est pas encore ouverte.", code: "DEMO_FERMEE" });
    expect(apercuFabrication).not.toHaveBeenCalled();
    expect(lancerFabrication).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("lancerDemoFacecam : réglage allumé (true exact)", () => {
  it("accord égal au prix (120 c) : lancée une fois, avec { confirme: 120 }", async () => {
    const videoId = await brouillonDemo();
    expect(await demoFacecamOuverte()).toBe(true);
    const r = await lancerDemoFacecam(videoId, 120);
    expect(r).toEqual({ ok: true, donnees: { statut: "lancee", travailId: "t-demo" } });
    expect(apercuFabrication).toHaveBeenCalledExactlyOnceWith(videoId);
    expect(lancerFabrication).toHaveBeenCalledExactlyOnceWith(videoId, { confirme: 120 });
    expect(revalidatePath).toHaveBeenCalledWith("/videos");
  });

  it("mode budget de master (« indicatif », vidéo du Studio) : accord 100 < 120 → le prix du jour vaut accord, lancée avec { confirme: 120 }", async () => {
    const videoId = await brouillonDemo();
    const r = await lancerDemoFacecam(videoId, 100);
    expect(r).toEqual({ ok: true, donnees: { statut: "lancee", travailId: "t-demo" } });
    expect(lancerFabrication).toHaveBeenCalledExactlyOnceWith(videoId, { confirme: 120 });
  });

  it("accord bloquant (commande de l'Usine) : accord 100 < 120 → accord-requis (120), rien de lancé ; 120 → lancée", async () => {
    const videoId = await brouillonDemo();
    await commandeeParUsine(videoId);
    const r = await lancerDemoFacecam(videoId, 100);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.donnees).toMatchObject({ statut: "accord-requis", centimes: 120 });
    expect(lancerFabrication).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
    for (const accord of [true, "120", null, undefined, Number.NaN]) {
      const refus = await lancerDemoFacecam(videoId, accord);
      expect(refus.ok && refus.donnees.statut).toBe("accord-requis");
    }
    expect(lancerFabrication).not.toHaveBeenCalled();
    const ok = await lancerDemoFacecam(videoId, 120);
    expect(ok).toEqual({ ok: true, donnees: { statut: "lancee", travailId: "t-demo" } });
    expect(lancerFabrication).toHaveBeenCalledExactlyOnceWith(videoId, { confirme: 120 });
  });

  it("apercuFabrication qui lève SCRIPT_MANQUANT → { ok: false, code: SCRIPT_MANQUANT }, rien de lancé", async () => {
    const videoId = await brouillonDemo();
    apercuLeve = new ErreurStudio("SCRIPT_MANQUANT", "Le script de cette vidéo n'est pas encore écrit.");
    const r = await lancerDemoFacecam(videoId, 1000);
    expect(r).toMatchObject({ ok: false, code: "SCRIPT_MANQUANT" });
    expect(lancerFabrication).not.toHaveBeenCalled();
  });

  it("vidéo d'un autre format (tableau-anime) ou absente → PAS_UNE_DEMO, aucun prix lu, rien de lancé", async () => {
    await ecrireParametre("demoFacecam.envoi", true);
    const autre = await nouveauBrouillonFormat({ formatId: "tableau-anime", titre: "Tableau", sujet: "Tableau", distribution: [], entrees: {} });
    for (const id of [autre.id, "inconnue"]) {
      const r = await lancerDemoFacecam(id, 1000);
      expect(r).toEqual({ ok: false, code: "PAS_UNE_DEMO", message: "Cette vidéo n'est pas une démo facecam." });
    }
    expect(apercuFabrication).not.toHaveBeenCalled();
    expect(lancerFabrication).not.toHaveBeenCalled();
  });

  it("sans session : refusé, rien de lancé", async () => {
    const videoId = await brouillonDemo();
    reinitialiserRequete();
    const r = await lancerDemoFacecam(videoId, 1000).catch((e: unknown) => ({ ok: false as const, leve: e }));
    expect(r.ok).toBe(false);
    expect(apercuFabrication).not.toHaveBeenCalled();
    expect(lancerFabrication).not.toHaveBeenCalled();
  });
});

describe("garde statique du fichier de lancement", () => {
  const texte = readFileSync(FICHIER, "utf8");
  it('première ligne "use server";', () => expect(texte.split("\n")[0]).toBe('"use server";'));
  it("n'exporte que des fonctions async (une seule : lancerDemoFacecam)", () => {
    const exports = texte.split("\n").filter((l) => /^export\b/.test(l));
    expect(exports).toHaveLength(1);
    expect(exports[0]).toMatch(/^export async function lancerDemoFacecam\(/);
  });
  it("aucune lecture de réglage (passe par demoFacecamOuverte)", () => {
    expect(texte).not.toContain("lireParametre");
    expect(texte).toContain("demoFacecamOuverte");
  });
});
