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
afterEach(() => bg.arreterBoucleGeneration());

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
