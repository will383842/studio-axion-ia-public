/**
 * CORRECTEUR 1 (argent) — B6 : la confirmation au-delà du seuil (20 € par défaut) n'est plus jamais écrite en dur sur
 * un chemin payant. Elle vient de l'écran : « Fabriquer les N » envoie le TOTAL que Will a vu (lot compris) ; le
 * serveur refuse `CONFIRMATION_REQUISE` tant que ce total n'a pas été confirmé. Tout simulé, aucune clé, aucun réseau.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
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

const MDP = "c1-argent-b6";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  credits.injecterLecteursPourEssai(null);
  await auth.seConnecter(MDP, false);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
});

afterEach(() => {
  bg.arreterBoucleGeneration();
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

/** Seuil de confirmation très bas : tout lancement payant le dépasse. */
const seuilBas = () => ecrireParametre("budget.seuilConfirmation", { centimes: 1, devise: "EUR" });

/** Budget du mois de l'Usine posé (large) : sans lui, l'Usine est refusée pour une autre raison que la confirmation. */
async function budgetUsineLarge(): Promise<void> {
  const { reglerBudgetUsine } = await import("@/services/budget-mensuel");
  const { moisParis } = await import("@/services/couts");
  await ecrireParametre("budget.mensuel", { centimes: 100_000, devise: "EUR" });
  await reglerBudgetUsine({ budget_mensuel_cents: 100_000, mois: moisParis() });
}

describe("B6 · « Fabriquer les N » : studio = le prix du jour vaut accord ; Usine = total confirmé exigé", () => {
  it("studio sans total confirmé : la fabrication part (décision du 08/11), journalisée « accepté sans confirmation »", async () => {
    const id = await sujetValide();
    await seuilBas();
    const videosAvant = await depots().videos.compter();
    const r = await fr.fabriquerLesN(id, { operationId: "op-b6-a", lancer: true });
    expect(r.mereVideoId).toBeTruthy();
    expect(await depots().videos.compter()).toBeGreaterThan(videosAvant);
    expect(JSON.stringify(await depots().evenements.lister())).toMatch(/accepté sans confirmation/);
  }, 60_000);

  it("Usine sans total confirmé : CONFIRMATION_REQUISE toujours exigée", async () => {
    const id = await sujetValide();
    await seuilBas();
    await budgetUsineLarge();
    await expect(fr.verifierAvantDeFabriquerLesN(id, { origine: "usine" })).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
  }, 60_000);

  it("Usine : total confirmé plus bas que le vrai total (prix changé) : CONFIRMATION_REQUISE ; total juste : elle passe", async () => {
    const id = await sujetValide();
    await seuilBas();
    await budgetUsineLarge();
    const plan = (await fr.planFabricationSujet(id))!;
    await expect(fr.verifierAvantDeFabriquerLesN(id, { origine: "usine", totalConfirme: plan.total.centimes - 1 })).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    await expect(fr.verifierAvantDeFabriquerLesN(id, { origine: "usine", totalConfirme: plan.total.centimes })).resolves.toBeDefined();
  }, 60_000);

  it("total confirmé = total affiché : la mère part", async () => {
    const id = await sujetValide();
    await seuilBas();
    const plan = (await fr.planFabricationSujet(id))!;
    const r = await fr.fabriquerLesN(id, { operationId: "op-b6-c", lancer: true, totalConfirme: plan.total.centimes });
    expect(r.travailId).toBeTruthy();
  }, 60_000);
});

describe("B6 · « Fabriquer cette version » : studio = prix du jour vaut accord ; Usine = montant exigé", () => {
  it("studio au-delà du seuil sans confirmation : elle part ; Usine : CONFIRMATION_REQUISE, le montant vu confirme", async () => {
    const id = await sujetValide();
    await seuilBas();
    const v = (await depots().variantes.lister((x) => x.scriptMaitreId === id && x.etat === "validee"))[0];
    await budgetUsineLarge();
    // Usine : refus avec le montant ; `true` ne suffit pas (paquet 4, R2) ; le montant vu passe.
    const refus = await fr.verifierAvantDeCreer([v.id], { origine: "usine" }).catch((e: { code?: string; montant?: number }) => e);
    expect(refus).toMatchObject({ code: "CONFIRMATION_REQUISE" });
    await expect(fr.verifierAvantDeCreer([v.id], { origine: "usine", confirme: true })).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    await expect(fr.verifierAvantDeCreer([v.id], { origine: "usine", confirme: (refus as { montant: number }).montant })).resolves.toBeDefined();
    // Studio : le prix du jour vaut accord, la fabrication part sans confirmation.
    const r = await bg.fabriquerVariante(v.id, { operationId: "op-b6-v1", lancer: true });
    expect(r.travailId ?? r.enAttente).toBeTruthy();
  }, 60_000);
});

/** Fichiers de code (hors tests) sous un dossier. */
function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((n) => {
    const p = join(dossier, n);
    if (statSync(p).isDirectory()) return fichiers(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

describe("B6 · garde : aucune confirmation de dépense écrite en dur", () => {
  it("ni `confirme: true` ni `verifierBudgetEtCredits(…, true, …)` dans le code du studio", () => {
    const fautes: string[] = [];
    for (const f of fichiers(join(process.cwd(), "src"))) {
      const lignes = readFileSync(f, "utf8").split("\n");
      const code = lignes.filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join("\n");
      if (/confirme:\s*true\b/.test(code)) fautes.push(`${f} : confirme: true`);
      if (/verifierBudgetEtCredits\([^;]*?,\s*true\s*,/.test(code.replace(/\n/g, " "))) fautes.push(`${f} : verifierBudgetEtCredits(…, true, …)`);
    }
    expect(fautes).toEqual([]);
  });
});
