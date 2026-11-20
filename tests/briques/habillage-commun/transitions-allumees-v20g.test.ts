/**
 * ALLUMER-TRANSITIONS-CC-v20g · Williams 20/11 : `habillage.transitionsPlanScenes` ALLUMÉ par défaut ; seul `false` exact
 * en base l'éteint ; une lecture en échec = éteint ; les 2 autres réglages restent éteints. Doubles seulement, zéro euro.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { RELU_RECRUTEMENT } from "../../helpers/script-relu";
import { CLES_REGLAGE_HABILLAGE, habillageActif, reglagesHabillage } from "@/briques/motion/habillage-commun/reglage";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const service = await import("@/services/cas-concret");
const { ecrireParametre } = await import("@/services/_commun");

describe("lecteur injecté", () => {
  it("a) lecteur qui rend undefined : transitionsPlanScenes allumé, les 2 autres éteints", async () => {
    const lire = async () => undefined;
    expect(await habillageActif("transitionsPlanScenes", lire)).toBe(true);
    expect(await habillageActif("transitionsStyleMontage", lire)).toBe(false);
    expect(await habillageActif("lutsSupplementaires", lire)).toBe(false);
  });
  it("b) base false : éteint ; \"true\", 1, null : allumé (seul false éteint)", async () => {
    expect(await habillageActif("transitionsPlanScenes", async () => false)).toBe(false);
    for (const v of ["true", 1, null]) expect(await habillageActif("transitionsPlanScenes", async () => v)).toBe(true);
  });
  it("c) lecture qui lève ou rejette : éteint pour les 3", async () => {
    for (const nom of Object.keys(CLES_REGLAGE_HABILLAGE) as (keyof typeof CLES_REGLAGE_HABILLAGE)[]) {
      expect(await habillageActif(nom, () => Promise.reject(new Error("x")))).toBe(false);
      expect(await habillageActif(nom, () => { throw new Error("sync"); })).toBe(false);
    }
  });
  it("d) reglagesHabillage rend l'objet figé attendu", async () => {
    const r = await reglagesHabillage(async (_id, defaut) => defaut);
    expect(r).toEqual({ transitionsPlanScenes: true, transitionsStyleMontage: false, lutsSupplementaires: false });
    expect(Object.isFrozen(r)).toBe(true);
  });
});

describe("e) cas concret : réglage absent", () => {
  const MDP = "cas-concret-transitions-allumees";
  const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"];
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
  const lancer = vi.fn(async () => ({ travailId: "t-transitions-allumees" }));
  const entrees = async () => {
    const r = await service.preparerEtLancer({ casId: "recrutement-apporteurs", reseaux: RESEAUX, mot: "IA", avecMot: true, accordCentimes: 10_000, empreinteScriptRelu: RELU_RECRUTEMENT }, { lancer });
    expect(r.statut).toBe("lancee");
    const [v] = await depots().videos.lister((x) => x.formatId === "cas-concret");
    return (v!.entrees as { casConcret: Record<string, unknown> }).casConcret;
  };
  it("réglage absent : `habillageTransitions` part à true avec la vidéo ; prix identique à réglage éteint", { timeout: 60_000 }, async () => {
    expect((await entrees()).habillageTransitions).toBe(true);
    const prixAbsent = JSON.stringify(await service.estimerCas("recrutement-apporteurs", RESEAUX, true));
    await ecrireParametre("habillage.transitionsPlanScenes", false);
    expect(JSON.stringify(await service.estimerCas("recrutement-apporteurs", RESEAUX, true))).toBe(prixAbsent);
  });
  it("réglage false : aucune clé, comme avant", { timeout: 60_000 }, async () => {
    await ecrireParametre("habillage.transitionsPlanScenes", false);
    expect(Object.keys(await entrees())).not.toContain("habillageTransitions");
  });
});
