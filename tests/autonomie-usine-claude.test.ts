/**
 * AUT-E — coût réel des appels Claude et arrêt net au plafond (plan USINE-AUTONOMIE-SOUS-PLAFOND, § 2.3, 2.5 et lot E).
 * Un appel Claude consommé est compté au RÉEL (dépense rattachée par `appelId`), plus au réservé ; une écriture d'origine
 * Usine refusée au plafond (`USINE_PLAFOND_ATTEINT`) s'arrête net « budget-usine » : rien n'est payé, la génération n'attend pas.
 * Interrupteur éteint et Studio : comportement actuel inchangé. Faux `fetch`, dépôts en mémoire, aucun réseau, 0 €.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "./helpers/g0";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const A = await import("@/services/autonomie-usine");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { moisParis, montantPaye } = await import("@/services/couts");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
import { roleSonde } from "@/generateur/roles/sonde";
import type { GenerationScript } from "@/domaine/types";

const MDP = "aut-e-claude";
beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await ecrireParametre("fournisseur.script", "claude");
  await ecrireParametre("budget.mensuel", { centimes: 1_000_000, devise: "EUR" });
});
afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
});

const entree = { contexte: { contexteAxion: "Axion-IA : formations IA pour dirigeants." }, variable: "<brief>Les PV</brief>" };
const allumer = (plafondCents: number) => ecrireParametre("usine.autonomie", { actif: true, plafondCents, le: new Date().toISOString(), version: 1 });
const index = () => lireParametre<string[]>(`usine.autonomie.index.${moisParis()}`, []);

let n = 0;
async function generation(): Promise<GenerationScript> {
  const le = new Date().toISOString();
  const g: GenerationScript = { id: `gen-ae-${++n}`, scriptMaitreId: `suj-ae-${n}`, hachageContexte: "h", plafondUsd: 50, portee: "sujet", etapes: [], statut: "en-cours", essai: false, creeLe: le, modifieLe: le };
  await depots().generations.enregistrer(g);
  return g;
}

function brancherClaude() {
  void credits.declarerRecharge("anthropic", 500);
  const appels: unknown[] = [];
  const f = (async (_u: string | URL | Request, init?: RequestInit) => {
    appels.push(init?.body);
    return reponseFlux(fluxReussi({ texte: JSON.stringify({ phrase: "ok" }), modele: "claude-sonnet-5-5" }));
  }) as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
  return appels;
}

describe("coût réel d'un appel Claude consommé", () => {
  it("origine Usine, autonomie allumée : la dépense porte l'appelId et l'usage de la clé = le RÉEL payé, pas le réservé", async () => {
    await allumer(100_000);
    const appels = brancherClaude();
    const g = await generation();
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree, { origine: "usine" });
    expect(r.ok).toBe(true);
    expect(appels).toHaveLength(1);
    const cles = await index();
    expect(cles).toHaveLength(1);
    const cle = cles[0]!;
    const deps = await depots().depenses.lister((d) => d.appelId === cle);
    expect(deps).toHaveLength(1);
    const reel = montantPaye(deps[0]!).centimes;
    const accord = await lireParametre<{ centimes: number }>(`usine.autonomie.accord.${cle}`, { centimes: 0 });
    expect(accord.centimes).toBeGreaterThan(reel); // réservé = pire cas, supérieur au réel
    expect(await lireParametre(`budget.engage.${cle}`, null)).toMatchObject({ statut: "consommee" });
    expect(await A.usageDeLaCle(cle)).toBe(reel);
    expect(await A.usageDuMoisUsine(moisParis())).toBe(reel);
  });
});

describe("arrêt net au plafond de l'Usine", () => {
  it("écriture d'origine Usine au plafond : arrêt « budget-usine », aucun appel, rien n'est payé, la génération n'attend pas", async () => {
    await allumer(1); // 1 centime : le pire cas d'une écriture ne tient pas
    const appels = brancherClaude();
    const g = await generation();
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree, { origine: "usine" });
    expect(r).toMatchObject({ ok: false, arret: "budget-usine" });
    expect(appels).toHaveLength(0);
    expect(await depots().depenses.lister((d) => d.scriptMaitreId === g.scriptMaitreId)).toHaveLength(0);
    expect(await index()).toEqual([]);
    expect((await depots().generations.obtenir(g.id))?.statut).toBe("en-cours");
    expect(await depots().reservations.lister((x) => x.statut === "active")).toHaveLength(0);
  });
});

describe("inchangé", () => {
  it("interrupteur ÉTEINT, origine Usine sans budget reçu : même arrêt net qu'avant, registre vide", async () => {
    const appels = brancherClaude();
    const g = await generation();
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree, { origine: "usine" });
    expect(r).toMatchObject({ ok: false, arret: "budget-usine" });
    expect(appels).toHaveLength(0);
    expect(await index()).toEqual([]);
  });

  it("Studio, même autonomie allumée : l'écriture part, aucun accord d'Usine inscrit, le compte de l'Usine reste à 0", async () => {
    await allumer(1);
    const appels = brancherClaude();
    const g = await generation();
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(r.ok).toBe(true);
    expect(appels).toHaveLength(1);
    expect(await index()).toEqual([]);
    expect(await A.usageDuMoisUsine(moisParis())).toBe(0);
    expect(await depots().depenses.lister((d) => !!d.appelId)).toHaveLength(1); // champ neutre
  });
});
