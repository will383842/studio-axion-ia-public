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
const fabrication = await import("@/services/fabrication");
const travaux = await import("@/services/travaux");
const boucle = await import("@/services/boucle");
const { ecrireParametre } = await import("@/services/_commun");
const { PHRASE_CAS_RETIRE } = await import("@/domaine/cas-retires");

const lancer = vi.fn(async () => ({ travailId: "t-retire" }));
const MDP = "cas-concret-retire";
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"];
const CAS = "rappels-rendez-vous";

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  lancer.mockClear();
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  const d = depots();
  const base = (await d.voix.obtenir("voix-will"))!;
  await d.voix.enregistrer({ ...base, id: "voix-avocat-test", nom: "Voix avocat", statut: "pret" });
  await d.personnages.modifier("p-will", { voixParDefautId: "voix-will", voixParFormat: { avocat: "voix-avocat-test" } });
});

/** Ce qui touche à l'argent et aux travaux : relevé avant et après chaque refus, il ne doit pas bouger. */
const argent = async () => ({ reservations: await depots().reservations.compter(() => true), travaux: await depots().travaux.compter(() => true), videos: await depots().videos.compter(() => true) });
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

describe("un cas retiré : refus sans aucun effet sur l'argent ni sur un brouillon existant", () => {
  it("estimerCas, confirmerCas et le lancement ne créent ni réservation ni travail ni vidéo", async () => {
    await retires.retirerCas(CAS);
    const avant = await argent();
    await service.estimerCas(CAS, RESEAUX, true, { essai: true });
    await service.preparerEtLancer(demande(), { lancer });
    await service.confirmerCas(CAS).catch(() => undefined);
    expect(await argent()).toEqual(avant);
    expect(lancer).not.toHaveBeenCalled();
  }, 30_000);

  it("un brouillon existant du cas (chemin « reprise ») n'est ni relancé ni modifié par le refus", async () => {
    // Le brouillon du cas naît d'un lancement normal (le double de lancement ne démarre rien).
    expect((await service.preparerEtLancer(demande(), { lancer })).statut).toBe("lancee");
    const [brouillon] = await videosCas();
    const instantane = JSON.stringify(brouillon.entrees);
    lancer.mockClear();
    await retires.retirerCas(CAS);
    const avant = await argent();
    expect(await service.preparerEtLancer(demande(), { lancer })).toEqual({ statut: "refusee", phrase: PHRASE_CAS_RETIRE });
    expect(lancer).not.toHaveBeenCalled();
    expect(await argent()).toEqual(avant);
    expect(JSON.stringify((await depots().videos.obtenir(brouillon.id))!.entrees)).toBe(instantane);
  }, 30_000);
});

describe("gardes de secours d'un cas retiré (vrais services, moteur simulé, rien de payé)", () => {
  const entreesCas = { casId: CAS, porte: "A" };

  it("lancerFabrication d'un brouillon de ce cas : CAS_RETIRE, aucun travail créé, réservations inchangées", async () => {
    await ecrireParametre("budget.seuilConfirmation", { centimes: 1_000_000, devise: "EUR" });
    await depots().videos.modifier("v-03", { formatId: "cas-concret", estDemo: false, entrees: { casConcret: entreesCas } });
    await retires.retirerCas(CAS);
    const avant = await argent();
    await expect(fabrication.lancerFabrication("v-03", { confirme: true })).rejects.toMatchObject({ code: "CAS_RETIRE", message: expect.stringContaining("Ce cas est retiré") });
    expect(await argent()).toEqual(avant);
    expect(await depots().reservations.compter((r) => r.videoId === "v-03" && r.statut === "active")).toBe(0);
  }, 30_000);

  it("reessayerTravail d'un travail en échec de ce cas : CAS_RETIRE, le travail reste en échec, aucune réservation réactivée", async () => {
    await ecrireParametre("budget.seuilConfirmation", { centimes: 1_000_000, devise: "EUR" });
    for (const x of await depots().travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
    // Une panne simulée sur v-03 (moteur simulé), puis la vidéo passe pour un cas concret.
    const { travailId } = await fabrication.lancerFabrication("v-03", { confirme: true, simulerEchecEtape: "montage" });
    vi.useFakeTimers({ toFake: ["Date"] });
    for (let i = 0; i < 200; i++) {
      if ((await depots().travaux.obtenir(travailId))?.statut === "echec") break;
      vi.setSystemTime(Date.now() + 5_000);
      await boucle.tourDeBoucle();
    }
    vi.useRealTimers();
    const t = (await depots().travaux.obtenir(travailId))!;
    expect(t.statut).toBe("echec");
    const version = (await depots().versions.obtenir(t.versionId!))!;
    await depots().versions.modifier(version.id, { commande: { ...version.commande, moteurId: "simulation", formatId: "cas-concret", entrees: { ...version.commande.entrees, casConcret: entreesCas } } });
    await depots().videos.modifier(t.cibleId, { formatId: "cas-concret", estDemo: false, entrees: { casConcret: entreesCas } });
    await retires.retirerCas(CAS);
    const avant = await argent();
    const actives = await depots().reservations.compter((r) => r.statut === "active");
    await expect(travaux.reessayerTravail(travailId)).rejects.toMatchObject({ code: "CAS_RETIRE" });
    expect((await depots().travaux.obtenir(travailId))?.statut).toBe("echec");
    expect(await argent()).toEqual(avant);
    expect(await depots().reservations.compter((r) => r.statut === "active")).toBe(actives);
  }, 60_000);
});
