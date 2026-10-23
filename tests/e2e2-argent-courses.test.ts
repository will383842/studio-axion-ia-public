/**
 * E2E-2 (03/10) — correcteur « argent et fabrication » : un seul geste payant à la fois par vidéo, et un budget qui
 * déduit ce qui est engagé.
 *  - argent n° 3 : deux lancements simultanés de la même vidéo (ou deux retouches, deux formats) = un seul travail, une
 *    seule réservation ; deux Accueils qui lancent les brouillons « dès que possible » = un seul travail ;
 *  - argent n° 4 : « Fabriquer » pendant la maquette attend sa fin et reprend sa voix ; deux maquettes = une lecture ;
 *  - argent n° 5 : budget restant = budget − dépensé − engagé ; deux lancements successifs ne le dépassent plus.
 * Faux lecteurs de solde, aucune clé, aucun réseau.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { LecteurCredit } from "@/fournisseurs/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const credits = await import("@/services/credits");
const couts = await import("@/services/couts");
const boucle = await import("@/services/boucle");
const { ecrireParametre } = await import("@/services/_commun");
const { moteurDeCommande } = await import("@/moteurs");
const { fournisseurVoixSimulation } = await import("@/fournisseurs/simulation/autres");

const MDP = "e2e2-argent-courses";

beforeAll(async () => {
  process.env.SESSION_SECRET = "k".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  vi.restoreAllMocks();
  credits.injecterLecteursPourEssai(null);
  await auth.seConnecter(MDP, false);
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  vi.useRealTimers();
});

function heygen(solde: number): LecteurCredit {
  return {
    fournisseur: "heygen",
    nom: "HeyGen",
    mode: "reel",
    urlRecharge: "https://app.heygen.com/settings/api",
    variableCle: "HEYGEN_API_KEY",
    async lireSolde() {
      await new Promise((r) => setTimeout(r, 20));
      return { fournisseur: "heygen", centimes: solde, devise: "USD", luLe: new Date().toISOString() };
    },
    async testerConnexion() {
      return { ok: true, finCle: "…essai", message: "ok", testeLe: new Date().toISOString() };
    },
  };
}

const actifs = (videoId: string, type?: string) => depots().travaux.compter((t) => t.cibleId === videoId && (!type || t.type === type) && (t.statut === "en_cours" || t.statut === "en_file"));

describe("argent n° 3 · deux lancements simultanés de la MÊME vidéo", () => {
  it("« Fabriquer » deux fois en même temps : un seul travail, une seule réservation, le même identifiant", async () => {
    credits.injecterLecteursPourEssai([heygen(1_000_000)], ["heygen"]);
    for (const v of await depots().voix.lister()) await depots().voix.modifier(v.id, { fournisseur: "heygen" });
    const avant = await actifs("v-03");
    const [a, b] = await Promise.all([fabrication.lancerFabrication("v-03", { confirme: true }), fabrication.lancerFabrication("v-03", { confirme: true })]);
    expect(a.travailId).toBe(b.travailId);
    expect((await actifs("v-03")) - avant).toBe(1);
    expect(await depots().reservations.compter((x) => x.statut === "active" && x.videoId === "v-03")).toBe(1);
  });

  it("deux formats identiques ajoutés en même temps : un seul travail", async () => {
    await Promise.allSettled([fabrication.reexporter("v-03", "1:1", { confirme: true }), fabrication.reexporter("v-03", "1:1", { confirme: true })]);
    expect(await actifs("v-03", "reexport")).toBe(1);
  });

  it("deux retouches identiques en même temps : un seul travail, la même retouche", async () => {
    const v = (await depots().videos.obtenir("v-03"))!;
    const plan = (await depots().plans.lister((p) => p.versionId === v.versionChoisieId))[0];
    const [a, b] = await Promise.all([fabrication.lancerRetouche("v-03", [plan.id], "plus net", { confirme: true }), fabrication.lancerRetouche("v-03", [plan.id], "plus net", { confirme: true })]);
    expect(a).toEqual(b);
    expect(await actifs("v-03", "retouche")).toBe(1);
  });

  it("brouillon « dès que possible » lancé depuis deux Accueils à la fois : un seul travail", async () => {
    // Brique 6 : le repère « script relu » que l'assistant joint à l'attente d'une vidéo dite par la voix de synthèse.
    const { empreinteDesBlocs } = await import("@/domaine/relecture-assistant");
    const scriptRelu = empreinteDesBlocs((await depots().scripts.obtenir((await depots().videos.obtenir("v-07"))!.scriptId!))!.blocs);
    await depots().videos.modifier("v-07", { statut: "brouillon", lancementEnAttente: { depuis: new Date().toISOString(), fournisseur: "heygen", confirme: true, scriptRelu } });
    await Promise.allSettled([credits.lancerVideosEnAttente(), credits.lancerVideosEnAttente()]);
    expect(await actifs("v-07")).toBe(1);
  });
});

describe("argent n° 4 · maquette rapide et « Fabriquer »", () => {
  function voixLente() {
    const original = fournisseurVoixSimulation.lire.bind(fournisseurVoixSimulation);
    return vi.spyOn(fournisseurVoixSimulation, "lire").mockImplementation(async (d) => (await new Promise((r) => setTimeout(r, 80)), original(d)));
  }

  it("deux maquettes en même temps : la voix n'est lue qu'une fois", async () => {
    await ecrireParametre("moteur.avocat", "montage-avocat");
    const lire = voixLente();
    await depots().videos.modifier("v-07", { statut: "brouillon" });
    await Promise.allSettled([fabrication.maquetteRapide("v-07"), fabrication.maquetteRapide("v-07")]);
    expect(lire.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("« Fabriquer » pendant la maquette : attend sa fin et reprend sa voix (jamais payée deux fois)", async () => {
    await ecrireParametre("moteur.avocat", "montage-avocat");
    const lire = voixLente();
    await depots().videos.modifier("v-07", { statut: "brouillon" });
    // La maquette prend la main d'abord (ordre fixé : la session est vérifiée de façon asynchrone avant le verrou).
    const pMq = fabrication.maquetteRapide("v-07");
    await vi.waitFor(() => expect(fabrication.gesteEnCours("v-07")).toBe(true));
    const [mq, lance] = await Promise.all([pMq, fabrication.lancerFabrication("v-07", { confirme: true })]);
    expect(mq.versionId).toBeTruthy();
    const t = (await depots().travaux.obtenir(lance.travailId))!;
    const v = (await depots().versions.obtenir(t.versionId!))!;
    expect(lire.mock.calls.length).toBe(1);
    expect(v.commande.audioMaitre).toBeTruthy();
  });
});

describe("argent n° 4 bis · maquette demandée APRÈS le lancement", () => {
  it("refusée tant que la vidéo fabrique : la voix n'est lue qu'une fois, par la fabrication", async () => {
    await ecrireParametre("moteur.avocat", "montage-avocat");
    const lire = vi.spyOn(fournisseurVoixSimulation, "lire");
    await depots().videos.modifier("v-07", { statut: "brouillon" });
    await fabrication.lancerFabrication("v-07", { confirme: true });
    await expect(fabrication.maquetteRapide("v-07")).rejects.toMatchObject({ code: "EN_FABRICATION" });
    expect(lire.mock.calls.length).toBe(0);
  });
});

describe("argent n° 5 · le budget du mois déduit ce qui est engagé", () => {
  it("restant = 1,5 vidéo : la seconde vidéo est refusée ; l'engagement se libère à la fin de la fabrication", async () => {
    for (const x of await depots().travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
    const c3 = await fabrication.construireCommande("v-03");
    const e3 = await moteurDeCommande(c3).estimer(c3);
    const c4 = await fabrication.construireCommande("v-04");
    const e4 = await moteurDeCommande(c4).estimer(c4);
    const deja = (await couts.resumeBudget()).depense.centimes;
    const budget = deja + Math.round(Math.max(e3.total.centimes, e4.total.centimes) * 1.5);
    await ecrireParametre("budget.mensuel", { centimes: budget, devise: "EUR" });
    await ecrireParametre("budget.seuilConfirmation", { centimes: 1_000_000, devise: "EUR" });
    const { travailId } = await fabrication.lancerFabrication("v-03", { confirme: true });
    const vue = await couts.resumeBudget();
    expect(vue.engage.centimes).toBe(e3.total.centimes);
    expect(vue.restant.centimes).toBe(budget - vue.depense.centimes - e3.total.centimes);
    await expect(fabrication.lancerFabrication("v-04", { confirme: true })).rejects.toMatchObject({ code: "BUDGET_DEPASSE" });
    // Fin de la fabrication : l'engagement est remplacé par la dépense réelle.
    vi.useFakeTimers({ toFake: ["Date"] });
    for (let i = 0; i < 200; i++) {
      const t = await depots().travaux.obtenir(travailId);
      if (t && (t.statut === "termine" || t.statut === "echec")) break;
      vi.setSystemTime(Date.now() + 5_000);
      await boucle.tourDeBoucle();
    }
    expect((await depots().travaux.obtenir(travailId))?.statut).toBe("termine");
    expect((await couts.resumeBudget()).engage.centimes).toBe(0);
  });

  it("un lancement refusé (crédit insuffisant) n'engage rien", async () => {
    credits.injecterLecteursPourEssai([heygen(1)], ["heygen"]);
    for (const v of await depots().voix.lister()) await depots().voix.modifier(v.id, { fournisseur: "heygen" });
    await expect(fabrication.lancerFabrication("v-03", { confirme: true })).rejects.toMatchObject({ code: "CREDIT_INSUFFISANT" });
    expect((await couts.resumeBudget()).engage.centimes).toBe(0);
  });
});
