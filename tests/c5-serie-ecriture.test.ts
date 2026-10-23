/**
 * CORRECTEUR 5 — écriture en SÉRIE (B7 de l'audit B, validée par Will) : « Écrire ces N idées ».
 *  - prix total maximum = N × prix d'UN sujet CALCULÉ (jamais en dur) ;
 *  - budget du mois et limite Claude du mois respectés : on dit combien partiront, jamais au-delà ;
 *  - un lancement par idée, la boucle les écrit une par une ; suivi « 1 sur 3 écrits » ;
 *  - chaque idée reliée à son sujet ; une idée qui ne part pas reste une idée (rien n'est perdu).
 * Aucune clé, aucun réseau : Claude « branché » répond par un faux `fetch` qui INTERDIT tout appel.
 * ROUGE prouvé sur d186500 (aucune écriture en série : `services/serie-ecriture` n'existait pas).
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
const couts = await import("@/services/couts");
const { ecrireParametre } = await import("@/services/_commun");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");
const serie = await import("@/services/serie-ecriture");

const MDP = "c5-serie-ecriture";
const appelsClaude: string[] = [];
const fetchInterdit = (async (url: string | URL | Request) => {
  appelsClaude.push(String(url));
  throw new Error("réseau interdit");
}) as typeof fetch;

const REGLAGES = { reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", adresse: "vous" as const, mode: "avatar" as const, objectif: "notoriete" as const };
const IDEES = [...SUJETS_BANC.map((s) => s.idee), "Les réunions qui auraient pu être un e-mail", "Le devis refait trois fois"];

beforeAll(async () => preparerMotDePasse(MDP));
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  appelsClaude.length = 0;
  await auth.seConnecter(MDP, false);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
});
afterEach(() => {
  gc.injecterClaudePourEssai(null);
  bg.arreterBoucleGeneration();
});

async function brancherClaude() {
  await ecrireParametre("fournisseur.script", "claude");
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fetchInterdit, attenteMs: () => 0 });
}

/** Règle le budget du mois pour qu'il reste exactement `restant` centimes. */
async function resteDuBudget(restant: number) {
  const b = await couts.resumeBudget();
  await ecrireParametre("budget.mensuel", { centimes: b.depense.centimes + b.engage.centimes + restant, devise: "EUR" });
}

async function noterIdees(textes: string[]) {
  const ids: string[] = [];
  for (const t of textes) ids.push((await depots().idees.enregistrer({ id: `idee-c5-${ids.length}`, texte: t, etat: "nouvelle", creeLe: "2026-10-03T08:00:00.000Z", modifieLe: "2026-10-03T08:00:00.000Z" })).id);
  return ids;
}

describe("Série · le plan (pur)", () => {
  it("le budget couvre 4 sujets sur 10 : 4 partent, et c'est le budget qui limite", () => {
    expect(serie.calculerPlanSerie({ demandees: 10, prixUnitaireCentimes: 140, restantBudgetCentimes: 599, plafondSujetUsdCentimes: 150, restantClaudeUsdCentimes: 10_000, essai: false })).toEqual({ partiront: 4, limite: "budget" });
  });
  it("la limite Claude du mois couvre 2 sujets : 2 partent, et c'est Claude qui limite", () => {
    expect(serie.calculerPlanSerie({ demandees: 10, prixUnitaireCentimes: 140, restantBudgetCentimes: 100_000, plafondSujetUsdCentimes: 150, restantClaudeUsdCentimes: 449, essai: false })).toEqual({ partiront: 2, limite: "claude" });
  });
  it("budget épuisé (ou négatif) : aucune ne part ; en essai, rien n'est payé : toutes partent", () => {
    expect(serie.calculerPlanSerie({ demandees: 3, prixUnitaireCentimes: 140, restantBudgetCentimes: -50, plafondSujetUsdCentimes: 150, restantClaudeUsdCentimes: 10_000, essai: false })).toEqual({ partiront: 0, limite: "budget" });
    expect(serie.calculerPlanSerie({ demandees: 3, prixUnitaireCentimes: 140, restantBudgetCentimes: 0, plafondSujetUsdCentimes: 150, restantClaudeUsdCentimes: 0, essai: true })).toEqual({ partiront: 3 });
  });
});

describe("Série · prix total maximum calculé, budget et limite Claude respectés", () => {
  it("prix d'un sujet = celui du lancement (taux du réglage), total = N × ce prix", async () => {
    await ecrireParametre("taux.usdEur", 0.9);
    const p1 = await serie.planSerie(7);
    expect(p1.prixUnitaire).toEqual(await bg.prixLancement());
    expect(p1.totalMax.centimes).toBe(7 * p1.prixUnitaire.centimes);
    await ecrireParametre("taux.usdEur", 1.2);
    const p2 = await serie.planSerie(7);
    expect(p2.prixUnitaire.centimes).toBeGreaterThan(p1.prixUnitaire.centimes);
    expect(p2.totalMax.centimes).toBe(7 * p2.prixUnitaire.centimes);
  });

  it("Claude branché, budget pour 3 sujets sur 5 : 3 partent, 2 restent en idée, aucun appel dans la requête", async () => {
    await brancherClaude();
    await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, 10_000);
    const prix = (await bg.prixLancement()).centimes;
    await resteDuBudget(3 * prix + prix - 1);
    const ids = await noterIdees(IDEES);
    const plan = await serie.planSerie(5);
    expect(plan).toMatchObject({ demandees: 5, partiront: 3, essai: false, limite: "budget" });

    const { serie: s } = await serie.lancerSerie(IDEES.map((texte, i) => ({ texte, ideeId: ids[i] })), REGLAGES, "serie-essai-budget");
    expect(s.elements.map((e) => e.sort)).toEqual(["parti", "parti", "parti", "reste", "reste"]);
    // Chaque idée partie est reliée à SON sujet ; les autres restent des idées libres.
    for (const [i, e] of s.elements.entries()) {
      const idee = (await depots().idees.obtenir(ids[i]))!;
      if (e.sort === "parti") {
        expect(idee.scriptMaitreId).toBe(e.scriptMaitreId);
        const m = (await depots().scriptsMaitres.obtenir(e.scriptMaitreId!))!;
        expect([m.brief.idee, m.brief.ideeId, m.brief.formatId, m.brief.adresseParDefaut]).toEqual([IDEES[i], ids[i], "avocat", "vous"]);
      } else {
        expect([idee.etat, idee.scriptMaitreId]).toEqual(["nouvelle", undefined]);
      }
    }
    expect(await depots().generations.lister((g) => g.statut === "en-cours" && !g.estDemo)).toHaveLength(3);
    expect(appelsClaude).toHaveLength(0);
    // Le reste du mois est maintenant promis aux 3 écritures : une nouvelle série ne part plus.
    expect((await serie.planSerie(2)).partiront).toBe(0);
  });

  it("limite Claude du mois : seules les écritures couvertes partent", async () => {
    await brancherClaude();
    await resteDuBudget(1_000_000);
    const engage = await gc.engageClaudeDuMoisCentimes();
    await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, (engage.depense + engage.reserve + 2 * 150 + 10) / 100);
    const plan = await serie.planSerie(4);
    expect(plan).toMatchObject({ partiront: 2, limite: "claude" });
    const { serie: s } = await serie.lancerSerie(IDEES.slice(0, 4).map((texte) => ({ texte })), REGLAGES, "serie-essai-claude");
    expect(s.elements.filter((e) => e.sort === "parti")).toHaveLength(2);
    // Les idées tapées dans l'atelier qui ne partent pas sont notées dans « Idées » : rien n'est perdu.
    const restees = s.elements.filter((e) => e.sort === "reste");
    expect(restees).toHaveLength(2);
    for (const e of restees) expect((await depots().idees.obtenir(e.ideeId!))!.texte).toBe(e.texte);
  });

  it("le même geste envoyé deux fois ne lance rien de plus", async () => {
    const a = await serie.lancerSerie(IDEES.slice(0, 2).map((texte) => ({ texte })), REGLAGES, "serie-double-1");
    const b = await serie.lancerSerie(IDEES.slice(0, 2).map((texte) => ({ texte })), REGLAGES, "serie-double-1");
    expect(b.serie).toEqual(a.serie);
    expect(await depots().scriptsMaitres.lister((m) => !m.estDemo && IDEES.includes(m.brief.idee))).toHaveLength(2);
  });
});

describe("Série · la boucle écrit une par une, le suivi le montre", () => {
  it("essai (Claude pas branché) : 3 parties ; « 1 sur 3 écrits » après un tour, puis « 3 sur 3 »", { timeout: 60_000 }, async () => {
    const plan = await serie.planSerie(3);
    expect(plan.essai).toBe(true);
    expect(plan.partiront).toBe(3);
    await serie.lancerSerie(IDEES.slice(0, 3).map((texte) => ({ texte })), REGLAGES, "serie-essai-suivi");
    let suivi = (await serie.suiviSerie())!;
    expect([suivi.total, suivi.ecrits, suivi.termine]).toEqual([3, 0, false]);

    await bg.tourBoucleGeneration();
    suivi = (await serie.suiviSerie("serie-essai-suivi"))!;
    expect([suivi.total, suivi.ecrits]).toEqual([3, 1]);
    expect(suivi.elements.map((e) => e.etat)).toEqual(["ecrit", "en-cours", "en-cours"]);

    await bg.tourBoucleGeneration();
    await bg.tourBoucleGeneration();
    suivi = (await serie.suiviSerie())!;
    expect([suivi.total, suivi.ecrits, suivi.aCompleter, suivi.termine]).toEqual([3, 3, 0, true]);
  });
});

describe("Série · « plusieurs idées, une par ligne » (atelier)", () => {
  it("puces et numéros retirés, lignes vides et doublons ignorés, 20 au plus", async () => {
    const { ideesParLigne } = await import("@/domaine/serie-idees");
    expect(ideesParLigne("- Les PV\n\n2) Les factures\n• les pv\n  Le devis  \r\n")).toEqual(["Les PV", "Les factures", "Le devis"]);
    expect(ideesParLigne(Array.from({ length: 30 }, (_, i) => `Idée ${i}`).join("\n"))).toHaveLength(20);
  });
});
