/**
 * ANNULER UNE VIDÉO NON TERMINÉE + NETTOYER (demande de Will du 18/10 : « un bouton ANNULER, et que ça DISPARAISSE »).
 * Règle de Will : rien de définitif sans corbeille → « Annuler » = METTRE À LA CORBEILLE (restaurable 30 jours), jamais
 * un effacement. Dépôts en mémoire, stockage simulé, horloge simulée : aucun appel réel, rien de payé, rien d'effacé.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const videos = await import("@/services/videos");
const corbeille = await import("@/services/corbeille");
const annulation = await import("@/services/annulation-video");
const { viderObjetsSimules } = await import("@/fournisseurs/simulation/autres");

const MDP_TEST = "essai-annuler-123";
const JOUR = 86_400_000;
const HEURE = 3_600_000;
let t0 = 0;

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  viderObjetsSimules();
  vi.restoreAllMocks();
  vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch interdit dans les tests")));
  await auth.seConnecter(MDP_TEST, false);
  // La graine a des publications programmées sur plusieurs vidéos : seuls les tests de refus en posent une.
  for (const p of await depots().publications.lister((x) => x.statut === "programmee")) await depots().publications.supprimer(p.id);
  t0 = Date.now();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(t0);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Une vidéo de la graine passée dans le statut voulu, modifiée il y a `ilYAHeures` heures. */
async function mettre(id: string, statut: "brouillon" | "echec" | "annulee" | "prete" | "en_fabrication" | "en_file", ilYAHeures = 48) {
  // `modifier` réécrit `modifieLe` : on enregistre la vidéo entière pour fixer son ancienneté.
  const v = (await depots().videos.obtenir(id))!;
  // Une vidéo jamais terminée n'a pas de version choisie ; `prete` garde celle de la graine.
  await depots().videos.enregistrer({ ...v, statut, versionChoisieId: statut === "prete" ? v.versionChoisieId : undefined, modifieLe: new Date(t0 - ilYAHeures * HEURE).toISOString() });
}
const ids = (l: { id: string }[]) => l.map((v) => v.id).sort();

describe("annuler = mettre à la corbeille", () => {
  for (const statut of ["brouillon", "echec", "annulee"] as const) {
    it(`une vidéo « ${statut} » va à la corbeille (archivée avec corbeilleLe), n'est PAS supprimée, disparaît des listes et se restaure`, async () => {
      await mettre("v-03", statut);
      const r = await annulation.annulerVideo("v-03");
      expect(r).toMatchObject({ mises: 1 });
      const v = (await depots().videos.obtenir("v-03"))!;
      expect(v).toBeDefined();
      expect(v.statut).toBe("archivee");
      expect(v.corbeilleLe).toBe(new Date(t0).toISOString());
      expect(v.statutAvantArchive).toBe(statut);
      expect((await videos.listerVideos()).some((c) => c.id === "v-03")).toBe(false);
      expect((await corbeille.listerCorbeille()).map((c) => c.id)).toContain("v-03");
      await corbeille.restaurerDeLaCorbeille(["v-03"]);
      expect((await depots().videos.obtenir("v-03"))!.statut).toBe(statut);
      expect((await depots().videos.obtenir("v-03"))!.corbeilleLe).toBeUndefined();
    });
  }

  it("une vidéo prête n'est JAMAIS annulée ici : refus clair, rien ne change", async () => {
    await mettre("v-01", "prete");
    await expect(annulation.annulerVideo("v-01")).rejects.toMatchObject({ code: "VIDEO_TERMINEE" });
    expect((await depots().videos.obtenir("v-01"))!.statut).toBe("prete");
    expect((await depots().videos.obtenir("v-01"))!.corbeilleLe).toBeUndefined();
  });

  it("refus conservés : publication programmée → message clair, vidéo gardée", async () => {
    await mettre("v-03", "echec");
    await depots().publications.enregistrer({ id: "pub-a", videoId: "v-03", reseau: "tiktok", statut: "programmee", date: new Date(t0 + 3 * JOUR).toISOString(), creeLe: new Date(t0).toISOString(), modifieLe: new Date(t0).toISOString() } as never);
    await expect(annulation.annulerVideo("v-03")).rejects.toMatchObject({ code: "PUBLICATION_PROGRAMMEE" });
    expect((await depots().videos.obtenir("v-03"))!.statut).toBe("echec");
  });

  it("fabrication en cours : arrête le travail PUIS met à la corbeille ; sans travailId elle est refusée", async () => {
    const [t] = await depots().travaux.lister((x) => x.statut === "en_cours" || x.statut === "en_file");
    expect(t, "la graine doit avoir un travail en cours").toBeDefined();
    const videoId = t.cibleId!;
    await depots().videos.modifier(videoId, { versionChoisieId: undefined }); // fabrication en cours = pas encore de version finie (la graine en met une)
    await expect(annulation.annulerVideo(videoId)).rejects.toMatchObject({ code: "EN_FABRICATION" });
    const r = await annulation.annulerVideo(videoId, { travailId: t.id });
    expect(r.mises).toBe(1);
    expect((await depots().travaux.obtenir(t.id))!.statut).toBe("annule");
    const v = (await depots().videos.obtenir(videoId))!;
    expect(v.statut).toBe("archivee");
    expect(v.corbeilleLe).toBeDefined();
  });

  it("exige une session", async () => {
    await auth.seDeconnecter();
    reinitialiserRequete();
    await expect(annulation.annulerVideo("v-03")).rejects.toBeTruthy();
    await expect(annulation.listerANettoyer()).rejects.toBeTruthy();
    await expect(annulation.nettoyerVideos(["v-03"])).rejects.toBeTruthy();
  });
});

describe("nettoyer les vidéos non terminées", () => {
  it("liste brouillons, échecs et annulées de plus de 24 h ; jamais une prête, une en fabrication, ni du récent", async () => {
    await mettre("v-01", "prete");
    await mettre("v-02", "brouillon", 48);
    await mettre("v-03", "echec", 30);
    await mettre("v-04", "annulee", 25);
    await mettre("v-07", "brouillon", 2); // trop récent
    await mettre("v-05", "en_fabrication");
    await mettre("v-08", "en_file");
    const liste = await annulation.listerANettoyer();
    const moi = ids(liste).filter((id) => ["v-01", "v-02", "v-03", "v-04", "v-05", "v-07", "v-08"].includes(id));
    expect(moi).toEqual(["v-02", "v-03", "v-04"]);
    for (const l of liste) expect(l).toMatchObject({ id: expect.any(String), titre: expect.any(String) });
  });

  it("ne propose pas ce qui est déjà à la corbeille ni archivé", async () => {
    await mettre("v-02", "brouillon");
    await mettre("v-03", "echec");
    await annulation.annulerVideo("v-02");
    expect(ids(await annulation.listerANettoyer())).not.toContain("v-02");
  });

  it("n'exécute rien tout seul : lister ne change aucune vidéo", async () => {
    await mettre("v-02", "brouillon");
    const avant = JSON.stringify(await depots().videos.lister());
    await annulation.listerANettoyer();
    expect(JSON.stringify(await depots().videos.lister())).toBe(avant);
  });

  it("met TOUTES les vidéos cochées à la corbeille en une fois (rien d'effacé)", async () => {
    await mettre("v-02", "brouillon");
    await mettre("v-03", "echec");
    await mettre("v-04", "annulee");
    const total = (await depots().videos.lister()).length;
    const r = await annulation.nettoyerVideos(["v-02", "v-03", "v-04"]);
    expect(r.mises).toBe(3);
    expect((await depots().videos.lister()).length).toBe(total);
    expect(ids(await corbeille.listerCorbeille())).toEqual(["v-02", "v-03", "v-04"]);
    expect(ids(await annulation.listerANettoyer())).not.toEqual(expect.arrayContaining(["v-02"]));
    expect(ids(await annulation.listerANettoyer()).filter((id) => ["v-02", "v-03", "v-04"].includes(id))).toEqual([]);
  });

  it("une vidéo prête passée dans la liste cochée est IGNORÉE (jamais mise à la corbeille par ce chemin)", async () => {
    await mettre("v-01", "prete");
    await mettre("v-02", "brouillon");
    const r = await annulation.nettoyerVideos(["v-01", "v-02"]);
    expect(r.mises).toBe(1);
    expect((await depots().videos.obtenir("v-01"))!.statut).toBe("prete");
    expect((await depots().videos.obtenir("v-01"))!.corbeilleLe).toBeUndefined();
    expect((await depots().videos.obtenir("v-02"))!.statut).toBe("archivee");
  });

  it("une vidéo refusée (publication programmée) reste ; les autres partent, et le refus est compté", async () => {
    await mettre("v-02", "brouillon");
    await mettre("v-03", "echec");
    await depots().publications.enregistrer({ id: "pub-b", videoId: "v-03", reseau: "tiktok", statut: "programmee", date: new Date(t0 + 3 * JOUR).toISOString(), creeLe: new Date(t0).toISOString(), modifieLe: new Date(t0).toISOString() } as never);
    const r = await annulation.nettoyerVideos(["v-02", "v-03"]);
    expect(r).toMatchObject({ mises: 1, refusees: 1 });
    expect((await depots().videos.obtenir("v-02"))!.statut).toBe("archivee");
    expect((await depots().videos.obtenir("v-03"))!.statut).toBe("echec");
  });
});

/** Une vidéo TERMINÉE (version finie) dont la retouche a échoué ou a été arrêtée passe en `echec` / `annulee` (relecture Opus, bloquant 1). */
async function terminee(id: string, statut: "echec" | "annulee" | "archivee", ilYAHeures = 48) {
  const v = (await depots().videos.obtenir(id))!;
  expect(v.versionChoisieId, "la graine doit donner une version finie à " + id).toBeDefined();
  await depots().videos.enregistrer({ ...v, statut, corbeilleLe: undefined, modifieLe: new Date(t0 - ilYAHeures * HEURE).toISOString() });
}

describe("une vidéo terminée n'est jamais annulée ni nettoyée (relecture Opus)", () => {
  for (const statut of ["echec", "annulee"] as const) {
    it(`retouche ${statut === "echec" ? "échouée" : "arrêtée"} sur une vidéo finie : ni listée, ni annulable, rien ne change`, async () => {
      await terminee("v-01", statut);
      expect(ids(await annulation.listerANettoyer())).not.toContain("v-01");
      await expect(annulation.annulerVideo("v-01")).rejects.toMatchObject({ code: "VIDEO_TERMINEE" });
      const r = await annulation.nettoyerVideos(["v-01"]);
      expect(r.mises).toBe(0);
      const v = (await depots().videos.obtenir("v-01"))!;
      expect(v.statut).toBe(statut);
      expect(v.corbeilleLe).toBeUndefined();
    });
  }

  it("une archivée finie sans corbeilleLe est refusée (statutAnnulable)", async () => {
    await terminee("v-01", "archivee");
    await expect(annulation.annulerVideo("v-01")).rejects.toMatchObject({ code: "VIDEO_TERMINEE" });
    expect((await depots().videos.obtenir("v-01"))!.corbeilleLe).toBeUndefined();
  });

  it("la garde est rejouée SOUS LE VERROU de la corbeille : une vidéo devenue prête entre-temps n'est pas mise de côté", async () => {
    await mettre("v-03", "echec");
    const v1 = (await depots().videos.obtenir("v-01"))!;
    const site = await import("@/services/site-videos");
    const retrait = vi.spyOn(site, "retirerAvantSuppression");
    const garde = (v: { versionChoisieId?: string }) => !v.versionChoisieId;
    await depots().videos.modifier("v-03", { versionChoisieId: v1.versionChoisieId });
    await expect(corbeille.mettreALaCorbeille(["v-03"], garde)).rejects.toMatchObject({ code: "VIDEO_TERMINEE" });
    expect(retrait).not.toHaveBeenCalled(); // la page du site n'est même pas retirée
    expect((await depots().videos.obtenir("v-03"))!.corbeilleLe).toBeUndefined();
  });
});

describe("fabrication en cours : refus avant l'arrêt, et refus après l'arrêt", () => {
  async function enCours() {
    const [t] = await depots().travaux.lister((x) => x.statut === "en_cours" || x.statut === "en_file");
    // En vrai, `versionChoisieId` n'est posé qu'à la fin d'une fabrication ; la graine en met une à la vidéo en cours.
    await depots().videos.modifier(t.cibleId!, { versionChoisieId: undefined });
    return { t, videoId: t.cibleId! };
  }

  it("une publication programmée refuse AVANT d'arrêter : le travail continue, rien n'est payé", async () => {
    const { t, videoId } = await enCours();
    await depots().publications.enregistrer({ id: "pub-c", videoId, reseau: "tiktok", statut: "programmee", date: new Date(t0 + 3 * JOUR).toISOString(), creeLe: new Date(t0).toISOString(), modifieLe: new Date(t0).toISOString() } as never);
    await expect(annulation.annulerVideo(videoId, { travailId: t.id })).rejects.toMatchObject({ code: "PUBLICATION_PROGRAMMEE" });
    expect(["en_cours", "en_file"]).toContain((await depots().travaux.obtenir(t.id))!.statut);
  });

  it("arrêt réussi puis corbeille refusée (la fabrication se termine pendant l'arrêt) : mises 0, refus dit, montant rendu, vidéo gardée", async () => {
    const { t, videoId } = await enCours();
    const v1 = (await depots().videos.obtenir("v-01"))!;
    const travaux = await import("@/services/travaux");
    vi.spyOn(travaux, "annulerTravail").mockImplementation(async () => {
      await depots().videos.modifier(videoId, { statut: "prete", versionChoisieId: v1.versionChoisieId });
      return { depense: { centimes: 250, devise: "EUR" } };
    });
    const r = await annulation.annulerVideo(videoId, { travailId: t.id });
    expect(r).toMatchObject({ mises: 0, centimes: 250 });
    expect(r.refus).toMatch(/terminée/);
    const v = (await depots().videos.obtenir(videoId))!;
    expect(v.statut).toBe("prete");
    expect(v.corbeilleLe).toBeUndefined();
  });
});

describe("Nettoyer : plafond et messages de refus", () => {
  it("jamais plus de 50 vidéos à la fois (liste et exécution)", async () => {
    const modele = (await depots().videos.obtenir("v-02"))!;
    for (let i = 0; i < 60; i++) await depots().videos.enregistrer({ ...modele, id: `v-x${i}`, titre: `Brouillon ${i}`, statut: "brouillon", versionChoisieId: undefined, corbeilleLe: undefined, modifieLe: new Date(t0 - 48 * HEURE).toISOString() });
    const liste = await annulation.listerANettoyer();
    expect(liste).toHaveLength(50);
    const r = await annulation.nettoyerVideos((await depots().videos.lister()).map((v) => v.id));
    expect(r.mises).toBe(50);
  });

  it("un refus remonte SON message (pas une phrase en dur)", async () => {
    await mettre("v-03", "echec");
    await depots().publications.enregistrer({ id: "pub-d", videoId: "v-03", reseau: "tiktok", statut: "programmee", date: new Date(t0 + 3 * JOUR).toISOString(), creeLe: new Date(t0).toISOString(), modifieLe: new Date(t0).toISOString() } as never);
    const r = await annulation.nettoyerVideos(["v-03"]);
    expect(r.refusees).toBe(1);
    expect(r.messages[0]).toMatch(/publication programmée/);
  });
});
