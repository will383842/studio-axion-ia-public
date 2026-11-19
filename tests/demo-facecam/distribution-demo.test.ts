/**
 * FIX-DEMO-DISTRIBUTION-v19b : le brouillon créé depuis l'envoi dit « qui parle » (la personne filmée),
 * donc « Lancer la démo » n'échoue plus en DISTRIBUTION_INCOMPLETE. Derrière `demoFacecam.envoi` (éteint par défaut).
 * Chemin réel ; seul `lancerFabrication` est doublé (espion) : aucun rendu, rien de payant.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const lancerFabrication = vi.fn<(videoId: string, o: { confirme?: number }) => Promise<{ travailId: string }>>(async () => ({ travailId: "t-demo" }));
vi.mock("@/services/fabrication", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/services/fabrication")>();
  return { ...reel, lancerFabrication: (id: string, o: { confirme?: number }) => lancerFabrication(id, o) };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre } = await import("@/services/_commun");
const { deposerFichierSimule } = await import("@/services/fichiers");
const { creerDemoDepuisEnvoi } = await import("@/app/(studio)/demo-facecam/actions-envoi");
const { lancerDemoFacecam } = await import("@/app/(studio)/demo-facecam/actions-lancement");

const MDP = "essai-distribution-demo-facecam";

beforeAll(async () => {
  process.env.SESSION_SECRET = "d".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  vi.clearAllMocks();
});

const deposer = (entiteId: string, nom: string) => deposerFichierSimule({ nom, mime: "video/mp4", taille: 1000, typeEntite: "entree", entiteId });

async function brouillonDepuisEnvoi(): Promise<string> {
  await ecrireParametre("demoFacecam.envoi", true);
  const f = await deposer("demo-distrib", "facecam.mp4");
  const e = await deposer("demo-distrib", "ecran.mp4");
  const r = await creerDemoDepuisEnvoi({ titre: "Démo", entiteId: "demo-distrib", facecamFichierId: f.id, ecranFichierId: e.id });
  if (!r.ok) throw new Error(r.message);
  return r.donnees.videoId;
}

describe("a) le brouillon note que la personne filmée parle", () => {
  it("distribution = [{ role: « Face caméra », source: « rush » }]", async () => {
    const videoId = await brouillonDepuisEnvoi();
    const v = await depots().videos.obtenir(videoId);
    expect(v?.distribution).toEqual([{ role: "Face caméra", source: "rush" }]);
  });
});

describe("b) « Lancer la démo » sans distribution posée à la main", () => {
  it("n'échoue plus en DISTRIBUTION_INCOMPLETE", async () => {
    const videoId = await brouillonDepuisEnvoi();
    const r = await lancerDemoFacecam(videoId, 100000);
    expect(r).not.toMatchObject({ code: "DISTRIBUTION_INCOMPLETE" });
  });
});

describe("c) éteint = identique", () => {
  it.each([
    ["absent", undefined],
    ["false", false],
  ])("réglage %s : DEMO_FERMEE, aucun brouillon, aucun dépôt écrit", async (_n, valeur) => {
    if (valeur !== undefined) await ecrireParametre("demoFacecam.envoi", valeur);
    const videos = (await depots().videos.lister()).length;
    const scripts = (await depots().scripts.lister()).length;
    const r = await creerDemoDepuisEnvoi({ titre: "Démo", entiteId: "demo-distrib", facecamFichierId: "x" });
    expect(r).toMatchObject({ ok: false, code: "DEMO_FERMEE" });
    expect(await depots().videos.lister()).toHaveLength(videos);
    expect(await depots().scripts.lister()).toHaveLength(scripts);
    expect(lancerFabrication).not.toHaveBeenCalled();
  });
});

describe("d) aucune donnée de personne inventée", () => {
  it("ni personnageId, ni voixId, ni visageId dans la distribution", async () => {
    const videoId = await brouillonDepuisEnvoi();
    const v = await depots().videos.obtenir(videoId);
    for (const d of v?.distribution ?? []) {
      expect(d).not.toHaveProperty("personnageId");
      expect(d).not.toHaveProperty("voixId");
      expect(d).not.toHaveProperty("visageId");
    }
  });
});
