/**
 * BR-DEMO-SCRIPT : le brouillon de la démo facecam reçoit un script d'un bloc « corps » vide (que le moteur ne lit pas),
 * sinon « Lancer la démo » échoue toujours en SCRIPT_MANQUANT. Derrière `demoFacecam.envoi` (éteint par défaut).
 * Chemin réel : vraies actions, vrai `deposerFichierSimule`, vrai `apercuFabrication` (moteur démo, estimation).
 * Seul `lancerFabrication` est doublé (espion) : aucun rendu, aucun euro.
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
const { apercuFabrication } = await import("@/services/fabrication");
const { creerDemoDepuisEnvoi } = await import("@/app/(studio)/demo-facecam/actions-envoi");
const { lancerDemoFacecam } = await import("@/app/(studio)/demo-facecam/actions-lancement");

const MDP = "essai-script-demo-facecam";

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
  const f = await deposer("demo-script", "facecam.mp4");
  const e = await deposer("demo-script", "ecran.mp4");
  const r = await creerDemoDepuisEnvoi({ titre: "Démo", entiteId: "demo-script", facecamFichierId: f.id, ecranFichierId: e.id });
  if (!r.ok) throw new Error(r.message);
  return r.donnees.videoId;
}

/** HORS PERIMETRE (journal) : le brouillon démo n'a pas de distribution (« Choisissez qui parle », DISTRIBUTION_INCOMPLETE) ; posée ici par le test. */
async function avecDistribution(videoId: string): Promise<void> {
  await depots().videos.modifier(videoId, { distribution: [{ role: "Face caméra", source: "rush" }] });
}

describe("a) le brouillon porte un script, « Lancer la démo » n'échoue plus en SCRIPT_MANQUANT", () => {
  it("creerDemoDepuisEnvoi puis lancerDemoFacecam : plus de SCRIPT_MANQUANT (le refus suivant est la distribution, hors fiche)", async () => {
    const videoId = await brouillonDepuisEnvoi();
    const r = await lancerDemoFacecam(videoId, 100000);
    expect(r).not.toMatchObject({ code: "SCRIPT_MANQUANT" });
  });

  it("creerDemoDepuisEnvoi puis lancerDemoFacecam (distribution posée) : lancée une fois", async () => {
    const videoId = await brouillonDepuisEnvoi();
    await avecDistribution(videoId);
    const r = await lancerDemoFacecam(videoId, 100000);
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.donnees.statut).toBe("lancee");
    expect(lancerFabrication).toHaveBeenCalledTimes(1);
  });

  it("le script rattaché est un seul bloc « corps » d'un segment vide", async () => {
    const videoId = await brouillonDepuisEnvoi();
    const v = await depots().videos.obtenir(videoId);
    expect(v?.scriptId).toBeTruthy();
    const s = await depots().scripts.obtenir(v!.scriptId!);
    expect(s?.blocs).toHaveLength(1);
    expect(s?.blocs[0]).toMatchObject({ id: `${videoId}-b1`, blocRecette: "corps", segments: [{ id: `${videoId}-s1`, texte: "" }] });
  });
});

describe("b) estimation du moteur démo", () => {
  it("vaut 0 € pour ce brouillon", async () => {
    const videoId = await brouillonDepuisEnvoi();
    await avecDistribution(videoId);
    const a = await apercuFabrication(videoId);
    expect(a.estimation.total.centimes).toBe(0);
  });
});

describe("c) réglage éteint", () => {
  it.each([
    ["absent", undefined],
    ["false", false],
  ])("réglage %s : DEMO_FERMEE, aucun brouillon, aucun script", async (_n, valeur) => {
    if (valeur !== undefined) await ecrireParametre("demoFacecam.envoi", valeur);
    const videos = (await depots().videos.lister()).length;
    const scripts = (await depots().scripts.lister()).length;
    const r = await creerDemoDepuisEnvoi({ titre: "Démo", entiteId: "demo-script", facecamFichierId: "x" });
    expect(r).toMatchObject({ ok: false, code: "DEMO_FERMEE" });
    expect(await depots().videos.lister()).toHaveLength(videos);
    expect(await depots().scripts.lister()).toHaveLength(scripts);
  });
});
