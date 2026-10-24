/**
 * Cas retiré par Will : refus net avant le prix et avant toute création de vidéo (estimerCas, preparerEtLancer, confirmerCas) ;
 * remis, tout repart comme avant. Même harnais que lancement.test.ts : base en mémoire, aucun appel réseau, rien de payé.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const service = await import("@/services/cas-concret");
const retires = await import("@/services/cas-concret-retires");
const { PHRASE_CAS_RETIRE } = await import("@/domaine/cas-retires");

const MDP = "cas-concret-retire";
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"];
const CAS = "rappels-rendez-vous";

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  const d = depots();
  const base = (await d.voix.obtenir("voix-will"))!;
  await d.voix.enregistrer({ ...base, id: "voix-avocat-test", nom: "Voix avocat", statut: "pret" });
  await d.personnages.modifier("p-will", { voixParDefautId: "voix-will", voixParFormat: { avocat: "voix-avocat-test" } });
});

const lancer = vi.fn(async () => ({ travailId: "t-retire" }));
const videosCas = async () => depots().videos.lister((v) => v.formatId === "cas-concret");
const demande = () => ({ casId: CAS, reseaux: RESEAUX, mot: "IA", avecMot: true, accordCentimes: 10_000, essai: true }) as Parameters<typeof service.preparerEtLancer>[0];

describe("un cas retiré", () => {
  it("estimerCas rend le refus « cas retiré », sans créer de vidéo", async () => {
    await retires.retirerCas(CAS);
    const e = await service.estimerCas(CAS, RESEAUX, true, { essai: true });
    expect(e.refus).toBe(PHRASE_CAS_RETIRE);
    expect(await videosCas()).toHaveLength(0);
  }, 30_000);

  it("preparerEtLancer est refusé avant toute création ; confirmerCas aussi", async () => {
    await retires.retirerCas(CAS);
    const r = await service.preparerEtLancer(demande(), { lancer });
    expect(r).toEqual({ statut: "refusee", phrase: PHRASE_CAS_RETIRE });
    expect(lancer).not.toHaveBeenCalled();
    expect(await videosCas()).toHaveLength(0);
    await expect(service.confirmerCas(CAS)).rejects.toThrow(PHRASE_CAS_RETIRE);
  });

  it("remis, le lancement repart comme avant ; un autre cas n'est jamais touché", async () => {
    await retires.retirerCas(CAS);
    expect((await service.preparerEtLancer(demande(), { lancer })).statut).toBe("refusee");
    await retires.remettreCas(CAS);
    const r = await service.preparerEtLancer(demande(), { lancer });
    expect(r.statut).toBe("lancee");
    await retires.retirerCas("recrutement-apporteurs");
    const encore = await service.estimerCas(CAS, RESEAUX, true, { essai: true });
    expect(encore.refus).not.toBe(PHRASE_CAS_RETIRE);
  });
});
