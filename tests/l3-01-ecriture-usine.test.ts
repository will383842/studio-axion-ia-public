/**
 * L3-01 — l'écriture d'un script COMMANDÉ par l'Usine (`origine: "usine"`, figée dans les options de l'écriture) et sans
 * budget du mois reçu de l'Usine est refusée AVANT tout appel au fournisseur, de bout en bout : tour de la boucle
 * d'écriture → exécutant facturé → `executerRoleFacture` → `reserverPourUsine`. Faux `fetch` Claude, aucune clé réelle,
 * aucun réseau, 0 €.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "./helpers/g0";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const bg = await import("@/services/boucle-generation");
const budget = await import("@/services/budget-mensuel");
const couts = await import("@/services/couts");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { ROLES_ECRITURE } = await import("@/generateur/roles");
import type { DefinitionRole } from "@/generateur/roles/types";

const MDP = "l3-01-ecriture-usine";
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

/** Faux Claude : reconnaît le rôle par sa consigne et répond par sa simulation ; chaque appel est compté. */
function fauxClaude(roles: DefinitionRole[]) {
  const appels: string[] = [];
  const f = (async (_url: string | URL | Request, init?: RequestInit) => {
    const corps = JSON.parse(String(init?.body ?? "{}")) as { system: { text: string }[]; messages: { content: string }[] };
    const consigne = corps.system.at(-1)!.text;
    const role = roles.find((r) => consigne.startsWith(r.consigne.trim()))!;
    appels.push(role.id);
    const sortie = role.simuler({ contexte: {}, variable: corps.messages[0].content });
    return reponseFlux(fluxReussi({ texte: typeof sortie === "string" ? sortie : JSON.stringify(sortie), modele: role.modele }));
  }) as typeof fetch;
  return { fetch: f, appels };
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  // Lot A5 : réglage absent = chaîne courte ; ce test éprouve la GRANDE chaîne, il la demande donc expressément.
  (await import("@/services/generation-claude")).forcerChainePourEssai("grande");
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
  await credits.declarerRecharge("anthropic", 100_000);
  await ecrireParametre("fournisseur.script", "claude");
  await ecrireParametre("budget.seuilConfirmation", { centimes: 1_000_000, devise: "EUR" });
  // Plafond du sujet assez haut : seul le budget de l'Usine peut arrêter l'écriture.
  await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, 50);
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
  bg.arreterBoucleGeneration();
});

/** Lance une écriture (geste de Will), puis la marque commandée par l'Usine, comme le fera la porte (L3-04). */
async function ecritureDeLUsine(): Promise<string> {
  const s = SUJETS_BANC[0];
  const r = await bg.lancerGeneration({ idee: s.idee, reseaux: [...s.reseaux], formatId: "avocat", pilier: s.pilier.id, mode: "avatar" as const });
  if (!r.ok) throw new Error("lancement");
  const cle = `generateur.chaine-options.${r.generationId}`;
  await ecrireParametre(cle, { ...(await lireParametre<Record<string, unknown>>(cle, {})), origine: "usine" });
  return r.generationId;
}

const depensesClaude = async () => (await depots().depenses.lister()).filter((d) => d.lignes.some((l) => l.fournisseur === "anthropic"));

describe("écriture commandée par l'Usine, de bout en bout (tour de la boucle)", () => {
  it("sans budget du mois reçu de l'Usine : AUCUN appel à Claude, aucune dépense, aucune réservation ni engagement", async () => {
    const claude = fauxClaude(Object.values(ROLES_ECRITURE) as DefinitionRole[]);
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: claude.fetch, attenteMs: () => 0 });
    const id = await ecritureDeLUsine();
    await bg.tourBoucleGeneration();
    expect(claude.appels).toEqual([]);
    expect(await depensesClaude()).toEqual([]);
    expect(await depots().reservations.lister((r) => r.statut === "active")).toEqual([]);
    expect((await couts.resumeBudget()).engage.centimes).toBe(0);
    expect((await depots().generations.obtenir(id))!.statut).not.toBe("terminee");
  });

  it("budget de l'Usine à 0 € pour ce mois : même refus avant tout appel", async () => {
    const claude = fauxClaude(Object.values(ROLES_ECRITURE) as DefinitionRole[]);
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: claude.fetch, attenteMs: () => 0 });
    await budget.reglerBudgetUsine({ budget_mensuel_cents: 0, mois: couts.moisParis() });
    await ecritureDeLUsine();
    await bg.tourBoucleGeneration();
    expect(claude.appels).toEqual([]);
    expect(await depensesClaude()).toEqual([]);
  });

  it("témoin : avec le budget du mois reçu de l'Usine, la même écriture part chez Claude", async () => {
    const claude = fauxClaude(Object.values(ROLES_ECRITURE) as DefinitionRole[]);
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: claude.fetch, attenteMs: () => 0 });
    await budget.reglerBudgetUsine({ budget_mensuel_cents: 10_000, mois: couts.moisParis() });
    await ecritureDeLUsine();
    await bg.tourBoucleGeneration();
    expect(claude.appels.length).toBeGreaterThan(0);
  }, 60_000);
});
