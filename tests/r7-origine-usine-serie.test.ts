/**
 * ARG-ORIGINE-USINE, trou n° 1 (série d'écritures) : `lancerSerie` n'avait pas d'origine, donc une série lancée pour l'Usine était
 * traitée comme le Studio (le prix du jour vaut accord). Désormais : origine « usine » → CONFIRMATION_REQUISE sans le total vu
 * (et rien n'est créé) ; sans origine (Studio) → elle part, et c'est journalisé. Tout simulé : le faux `fetch` interdit tout appel.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE } from "./helpers/g0";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const gc = await import("@/services/generation-claude");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");
const serie = await import("@/services/serie-ecriture");

const MDP = "r7-origine-usine-serie";
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as unknown as typeof fetch;
const REGLAGES = { reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", adresse: "vous" as const, mode: "avatar" as const, objectif: "notoriete" as const };
const idees = (n: number) => SUJETS_BANC.slice(0, n).map((s) => ({ texte: s.idee }));

beforeAll(async () => preparerMotDePasse(MDP));
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
  // Claude branché (sinon c'est un essai, sans prix) et seuil de confirmation très bas : la série le dépasse.
  await ecrireParametre("fournisseur.script", "claude");
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fetchInterdit, attenteMs: () => 0 });
  await ecrireParametre("budget.mensuel", { centimes: 10_000_000, devise: "EUR" });
  await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, 100_000);
  await ecrireParametre("budget.seuilConfirmation", { centimes: 1, devise: "EUR" });
});
afterEach(() => {
  gc.injecterClaudePourEssai(null);
  bg.arreterBoucleGeneration();
});

describe("série : l'origine « usine » exige la confirmation, le Studio non", () => {
  it("Usine sans total vu : CONFIRMATION_REQUISE, rien n'est créé ; total et taille vus : elle part", async () => {
    const plan = await serie.planSerie(2);
    expect(plan.essai).toBe(false);
    expect(plan.partiront).toBe(2);
    await expect(serie.lancerSerie(idees(2), REGLAGES, "serie-usine-1", undefined, undefined, "usine")).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE", montant: plan.totalPartant.centimes });
    // Un total plus bas que le prix du jour ne vaut pas confirmation.
    await expect(serie.lancerSerie(idees(2), REGLAGES, "serie-usine-1", plan.totalPartant.centimes - 1, plan.partiront, "usine")).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    expect(await depots().scriptsMaitres.compter()).toBe(0);
    const { serie: s } = await serie.lancerSerie(idees(2), REGLAGES, "serie-usine-1", plan.totalPartant.centimes, plan.partiront, "usine");
    expect(s.elements.map((e) => e.sort)).toEqual(["parti", "parti"]);
    // A1 : l'origine est FIGÉE sur chaque génération créée (c'est elle que relisent la garde et la réserve de la chaîne).
    const generations = await depots().generations.lister();
    expect(generations.length).toBe(2);
    for (const g of generations) expect((await lireParametre<{ origine?: string } | null>(`generateur.chaine-options.${g.id}`, null))?.origine).toBe("usine");
  });

  it("Studio (sans origine) : la série part sans confirmation, et c'est journalisé", async () => {
    const { serie: s } = await serie.lancerSerie(idees(2), REGLAGES, "serie-studio-1");
    expect(s.elements.map((e) => e.sort)).toEqual(["parti", "parti"]);
    expect(JSON.stringify(await depots().evenements.lister())).toMatch(/sans confirmation/);
    // A1 : sans origine, rien n'est écrit côté Studio.
    const generations = await depots().generations.lister();
    expect(generations.length).toBe(2);
    for (const g of generations) expect((await lireParametre<{ origine?: string } | null>(`generateur.chaine-options.${g.id}`, null))?.origine).toBeUndefined();
  });

  it("B1 : lancerGeneration ignore toute origine autre que « usine » (rien n'est écrit dans les options)", async () => {
    const ids: string[] = [];
    for (const [i, origine] of ["x", { a: 1 }].entries()) {
      const r = await bg.lancerGeneration({ idee: SUJETS_BANC[i]!.idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", origine } as never);
      ids.push(r.scriptMaitreId);
    }
    const gens = await depots().generations.lister();
    expect(gens.length).toBe(2);
    for (const g of gens) expect((await lireParametre<{ origine?: unknown } | null>(`generateur.chaine-options.${g.id}`, null))?.origine).toBeUndefined();
  });
});
