/**
 * ARG-ORIGINE-USINE, trou n° 1 (suite) : `fabriquerLesN` et `fabriquerVariante` n'avaient pas d'origine, donc passaient par la
 * garde commune comme le Studio. Désormais l'origine « usine » descend jusqu'à la garde : sans le total vu, CONFIRMATION_REQUISE
 * et RIEN n'est créé ; sans origine (Studio) le prix du jour vaut accord et c'est journalisé. Tout simulé, aucune clé.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const fr = await import("@/services/fabrication-reseaux");
const credits = await import("@/services/credits");
const { ecrireParametre } = await import("@/services/_commun");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");
const { reglerBudgetUsine } = await import("@/services/budget-mensuel");
const { moisParis } = await import("@/services/couts");
const boucle = await import("@/services/boucle");

const MDP = "r7-origine-usine-fabrication";

beforeAll(async () => preparerMotDePasse(MDP));
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  credits.injecterLecteursPourEssai(null);
  await auth.seConnecter(MDP, false);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
  // Seuil très bas (tout lancement le dépasse) ; budget du mois et budget de l'Usine larges : le seul refus possible est la confirmation.
  await ecrireParametre("budget.seuilConfirmation", { centimes: 1, devise: "EUR" });
  await ecrireParametre("budget.mensuel", { centimes: 100_000, devise: "EUR" });
  await reglerBudgetUsine({ budget_mensuel_cents: 100_000, mois: moisParis() });
});
afterEach(() => {
  bg.arreterBoucleGeneration();
  vi.useRealTimers();
});

async function sujetValide(): Promise<string> {
  const r = await bg.lancerGeneration({ idee: SUJETS_BANC[0].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" as const });
  if (!r.ok) throw new Error("lancement de l'écriture");
  await bg.tourBoucleGeneration();
  const m = await depots().scriptsMaitres.obtenir(r.scriptMaitreId);
  if (m?.exception?.source === "proposition-machine") await bg.validerException(r.scriptMaitreId, "c-est-juste");
  const vs = await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId);
  await bg.validerVariantes(vs.map((v) => v.id));
  return r.scriptMaitreId;
}

describe("fabriquerLesN : l'origine descend jusqu'à la garde", () => {
  it("Usine sans total vu : CONFIRMATION_REQUISE, aucune vidéo créée ; Studio : elle part, journalisée", async () => {
    const id = await sujetValide();
    const videosAvant = await depots().videos.compter();
    await expect(fr.fabriquerLesN(id, { operationId: "op-usine-n", lancer: true, origine: "usine" })).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    expect(await depots().videos.compter()).toBe(videosAvant);
    const r = await fr.fabriquerLesN(id, { operationId: "op-studio-n", lancer: true });
    expect(r.mereVideoId).toBeTruthy();
    expect(JSON.stringify(await depots().evenements.lister())).toMatch(/accepté sans confirmation/);
  }, 60_000);
});

describe("fabriquerVariante : l'origine descend jusqu'à la garde", () => {
  it("Usine sans montant vu : CONFIRMATION_REQUISE, aucune vidéo créée ; Studio : elle part, journalisée", async () => {
    const id = await sujetValide();
    const v = (await depots().variantes.lister((x) => x.scriptMaitreId === id && x.etat === "validee"))[0];
    const videosAvant = await depots().videos.compter();
    await expect(bg.fabriquerVariante(v.id, { operationId: "op-usine-v", lancer: true, origine: "usine" })).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    expect(await depots().videos.compter()).toBe(videosAvant);
    const r = await bg.fabriquerVariante(v.id, { operationId: "op-studio-v", lancer: true });
    expect(r.travailId ?? r.enAttente).toBeTruthy();
    expect(JSON.stringify(await depots().evenements.lister())).toMatch(/accepté sans confirmation/);
  }, 60_000);
});

/* ---- Correcteur ARG-ORIGINE-USINE (relecture 520) : l'origine ne se perd pas APRÈS le geste ---- */

const grand = { centimes: 100_000_000, devise: "EUR" as const };
async function derniereCommande(videoId: string) {
  const vs = await depots().versions.lister((x) => x.videoId === videoId);
  return vs.sort((a, b) => b.numero - a.numero)[0]?.commande;
}

describe("M1 : l'Usine confirmée garde son origine jusque dans la commande créée", () => {
  it("fabriquerVariante (usine, prix confirmé) : la version créée a commande.origine === « usine » ; sans origine, rien n'est écrit", async () => {
    const id = await sujetValide();
    const [a, b] = await depots().variantes.lister((x) => x.scriptMaitreId === id && x.etat === "validee");
    const ru = await bg.fabriquerVariante(a.id, { operationId: "op-m1-usine", lancer: true, origine: "usine", prixConfirme: 100_000_000 });
    expect((await derniereCommande(ru.videoId))?.origine).toBe("usine");
    const rs = await bg.fabriquerVariante(b.id, { operationId: "op-m1-studio", lancer: true });
    expect((await derniereCommande(rs.videoId))?.origine).toBeUndefined();
  }, 60_000);
});

describe("A2 : les versions qui attendent leur mère gardent l'origine", () => {
  it("fabriquerLesN (usine) : la mère et chaque version en attente portent « usine » ; une version qui part ensuite la garde", async () => {
    const id = await sujetValide();
    const r = await fr.fabriquerLesN(id, { operationId: "op-a2-usine", lancer: true, origine: "usine", totalConfirme: 100_000_000 });
    expect((await derniereCommande(r.mereVideoId))?.origine).toBe("usine");
    const suivantes = r.videoIds.slice(1);
    expect(suivantes.length).toBeGreaterThan(0);
    for (const vid of suivantes) {
      const v = await depots().videos.obtenir(vid);
      if (fr.declinaisonDe(v)?.attendMere) expect(fr.declinaisonDe(v)?.origine).toBe("usine");
    }
  }, 120_000);

  it("moteur à reprise de la mère : les N−1 versions attendent leur mère, la mémorisent, puis partent avec « usine » dans leur commande", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await ecrireParametre("moteur.avocat", "montage-avocat");
    const id = await sujetValide();
    const total = (await fr.planFabricationSujet(id))!.total.centimes;
    const r = await fr.fabriquerLesN(id, { operationId: "op-a2-mere", lancer: true, origine: "usine", totalConfirme: total });
    const versions = r.videoIds.slice(1);
    expect(versions.length).toBeGreaterThan(0);
    for (const vid of versions) expect(fr.declinaisonDe(await depots().videos.obtenir(vid))).toMatchObject({ attendMere: true, origine: "usine" });
    for (let i = 0; i < 120 && (await depots().videos.obtenir(r.mereVideoId))?.statut !== "prete"; i++) {
      vi.setSystemTime(Date.now() + 5_000);
      await boucle.tourDeBoucle();
    }
    for (let i = 0; i < 3; i++) {
      vi.setSystemTime(Date.now() + 5_000);
      await boucle.tourDeBoucle();
    }
    let parties = 0;
    for (const vid of versions) {
      const v = (await depots().videos.obtenir(vid))!;
      if (fr.declinaisonDe(v)?.attendMere === false && v.statut !== "brouillon") {
        parties++;
        expect((await derniereCommande(vid))?.origine).toBe("usine");
      }
    }
    expect(parties).toBeGreaterThan(0);
    vi.useRealTimers();
  }, 120_000);

  it("fabriquerLesN sans origine (Studio) : rien n'est écrit sur les versions", async () => {
    const id = await sujetValide();
    const r = await fr.fabriquerLesN(id, { operationId: "op-a2-studio", lancer: true });
    for (const vid of r.videoIds.slice(1)) expect(fr.declinaisonDe(await depots().videos.obtenir(vid))?.origine).toBeUndefined();
  }, 120_000);
});

describe("A3 : la relance après une attente de crédit garde l'origine", () => {
  it("lancerVideoDeVersion (usine) refusé faute de budget : l'attente garde « usine » et la relance la retransmet à la commande", async () => {
    const id = await sujetValide();
    const v = (await depots().variantes.lister((x) => x.scriptMaitreId === id && x.etat === "validee"))[0];
    const prep = await bg.fabriquerVariante(v.id, { operationId: "op-a3-prep", lancer: false });
    // Budget du mois (et de l'Usine) à presque rien : le lancement est refusé, la vidéo attend.
    await ecrireParametre("budget.mensuel", { centimes: 1, devise: "EUR" });
    await reglerBudgetUsine({ budget_mensuel_cents: 1, mois: moisParis() });
    const r = await fr.lancerVideoDeVersion(prep.videoId, 100_000_000, "usine");
    expect(r.enAttente).toBeTruthy();
    expect((await depots().videos.obtenir(prep.videoId))?.lancementEnAttente?.origine).toBe("usine");
    // Le crédit revient : la relance repart, et la commande créée garde l'origine.
    await ecrireParametre("budget.mensuel", grand);
    await reglerBudgetUsine({ budget_mensuel_cents: 100_000_000, mois: moisParis() });
    const { lancees } = await credits.lancerVideosEnAttente();
    expect(lancees.length).toBe(1);
    expect((await derniereCommande(prep.videoId))?.origine).toBe("usine");
  }, 60_000);
});
