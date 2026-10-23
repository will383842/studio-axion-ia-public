/**
 * G0 — CLAUDE ET CRÉDITS (plan v5 B.10 ligne G0, hors appel réel ; addendum du 02/10 : 100 $ par mois depuis le 03/10).
 * Coût dans `DepenseEnregistree`, pré-vol bloquant, plafond mensuel, plafond du sujet, en attente de crédit puis reprise,
 * modèle retiré, surcharge, anciennes méthodes sans dépense, ANCRAGE_MANQUANT à 0 $. Sans clé ni réseau : Claude répond
 * par un faux `fetch` (réponses enregistrées, `tests/helpers/g0.ts`).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fauxFetch, fluxReussi, reponseErreur, reponseFlux } from "./helpers/g0";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const gen = await import("@/services/generateur");
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { creerFournisseurScriptClaude, scriptClaude } = await import("@/fournisseurs/claude/inscription");
const { fournisseurScriptSimulation } = await import("@/fournisseurs/simulation/script");
import { roleSonde } from "@/generateur/roles/sonde";
import type { DefinitionRole } from "@/generateur/roles/types";
import type { GenerationScript } from "@/domaine/types";
import { centimes } from "@/lib/montants";

const MDP = "essai-g0-claude";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

/** Le lecteur Claude « suivi » ne doit JAMAIS appeler le réseau pendant un pré-vol. */
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await ecrireParametre("fournisseur.script", "claude");
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
});

/** Dépenses chez Claude (les données de démonstration portent des dépenses « simulation »). */
async function depensesClaude() {
  return (await depots().depenses.lister()).filter((d) => d.lignes.some((l) => l.fournisseur === "anthropic"));
}

let n = 0;
async function nouvelleGeneration(plafondUsd = 1.5): Promise<GenerationScript> {
  const le = new Date().toISOString();
  const g: GenerationScript = { id: `gen-g0-${++n}`, scriptMaitreId: `suj-g0-${n}`, hachageContexte: "h", plafondUsd, portee: "sujet", etapes: [], statut: "en-cours", creeLe: le, modifieLe: le };
  await depots().generations.enregistrer(g);
  return g;
}

function brancher(reponses: (() => Response)[]) {
  const f = fauxFetch(reponses);
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f.fetch, attenteMs: () => 0 });
  return f;
}

const entree = { contexte: { contexteAxion: "Axion-IA : formations IA pour dirigeants." }, variable: "<brief>Les PV de stationnement</brief>" };
const ok = () => reponseFlux(fluxReussi({ texte: '{"phrase":"Vous recevez un PV."}' }));

/** Rôle lourd : pire cas ≈ 1,0 $ (50 000 jetons de sortie Opus) — passe avec 1,50 $ de crédit. */
const roleLourd: DefinitionRole = { ...roleSonde, id: "lourd", maxTokens: 50_000 } as DefinitionRole;

describe("G0 · coût réel dans DepenseEnregistree", () => {
  it("un appel : dépense « anthropic » réelle rattachée au sujet, jetons et modèle sur l'étape, réservation consommée", async () => {
    await credits.declarerRecharge("anthropic", 500);
    const { appels } = brancher([ok]);
    const g = await nouvelleGeneration();
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(r).toMatchObject({ ok: true, simule: false, donnees: { phrase: "Vous recevez un PV." }, modele: "claude-opus-5-5" });
    expect(appels).toHaveLength(1);
    const deps = await depensesClaude();
    expect(deps).toHaveLength(1);
    expect(deps[0]).toMatchObject({ scriptMaitreId: g.scriptMaitreId, lignes: [{ fournisseur: "anthropic", nature: "reel", etape: "Écriture · sonde" }] });
    // 1200 × 4 + 800 × 5 + 150 × 20 = 11 800 millionièmes de dollar → 2 centimes de dollar → 2 centimes d'euro (taux 0,9).
    expect(r.ok && r.coutUsd).toBeCloseTo(0.0118, 6);
    expect(deps[0].total).toEqual(centimes(2));
    const gg = (await depots().generations.obtenir(g.id))!;
    expect(gg.etapes[0]).toMatchObject({ role: "sonde", modeleDemande: "claude-opus-5-5", modeleEffectif: "claude-opus-5-5", effort: "low", resultat: "ok", jetons: { entree: 1200, cacheLu: 0, cacheEcrit: 800, sortie: 150 } });
    expect(gg.etapes[0].termineLe).toBeTruthy();
    const res = await depots().reservations.lister();
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ fournisseur: "anthropic", statut: "consommee", travailId: gg.etapes[0].appelId });
    // Anthropic n'a pas d'API de solde : le studio n'en devine plus (solde inconnu, pas de chiffre).
    expect((await credits.soldeFournisseur("anthropic")).solde).toBeNull();
  });

  it("repli serveur : compté au tarif le plus cher des deux (jamais sous le modèle demandé)", async () => {
    await credits.declarerRecharge("anthropic", 500);
    brancher([() => reponseFlux(fluxReussi({ texte: '{"phrase":"x"}', modele: "claude-haiku-4-5", repliDe: "claude-opus-5-5" }))]);
    const g = await nouvelleGeneration();
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(r.ok && r.coutUsd).toBeCloseTo(0.0118, 6);
    expect(r.ok && r.modele).toBe("claude-haiku-4-5");
  });
});

describe("G0 · pas de pré-vol sur un solde deviné : l'appel part, c'est le refus d'Anthropic qui met en attente", () => {
  it("un solde Claude déclaré bas ne bloque plus : l'appel part, la dépense est enregistrée", async () => {
    await credits.declarerRecharge("anthropic", 1);
    const { appels } = brancher([ok]);
    const g = await nouvelleGeneration();
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(r.ok).toBe(true);
    expect(appels).toHaveLength(1);
    expect(await depensesClaude()).toHaveLength(1);
    expect((await depots().generations.obtenir(g.id))!.statut).toBe("en-cours");
  });

  it("Anthropic refuse (erreur « facturation », crédit épuisé) : « en-attente-credit », aucune dépense, réservation libérée, rien ne repart seul", async () => {
    const { appels } = brancher([() => reponseErreur(402, "billing_error", "Your credit balance is too low to access the Anthropic API."), ok]);
    const g = await nouvelleGeneration();
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(r).toMatchObject({ ok: false, arret: "en-attente-credit" });
    expect(appels).toHaveLength(1);
    expect(await depensesClaude()).toHaveLength(0);
    expect((await depots().reservations.lister()).map((x) => x.statut)).toEqual(["liberee"]);
    expect((await depots().generations.obtenir(g.id))!.statut).toBe("en-attente-credit");
    // Une génération en attente ne part plus, même rappelée.
    await expect(gc.executerRoleFacture(g.id, roleSonde, entree)).rejects.toMatchObject({ code: "GENERATION_ARRETEE" });
    expect(appels).toHaveLength(1);
  });

  it("solde déclaré 1 $ : un rôle au pire cas ≈ 1 $ part aussi (plus de seuil contre un solde deviné)", async () => {
    await credits.declarerRecharge("anthropic", 1);
    const { appels } = brancher([ok]);
    const g = await nouvelleGeneration();
    const r = await gc.executerRoleFacture(g.id, roleLourd, entree);
    expect(r.ok).toBe(true);
    expect(appels).toHaveLength(1);
  });

  it("refus Anthropic sur un rôle lourd : en attente ; la recharge déclarée rend l'écriture « prête », « Reprendre » la relance", async () => {
    const { appels } = brancher([() => reponseErreur(402, "billing_error", "Your credit balance is too low to access the Anthropic API."), ok]);
    const g = await nouvelleGeneration();
    expect((await gc.executerRoleFacture(g.id, roleLourd, entree)).ok).toBe(false);
    await new Promise((x) => setTimeout(x, 5)); // la recharge doit être postérieure au refus
    expect(await gc.declarerRechargeClaude(149)).toEqual([]);
    expect(await gc.ecriturePreteAReprendre(g.id)).toBe(true);
    expect(await gc.relancerEcrituresEnAttente(g.scriptMaitreId)).toEqual([g.id]);
    expect((await depots().generations.obtenir(g.id))!.statut).toBe("en-cours");
    const r = await gc.executerRoleFacture(g.id, roleLourd, entree);
    expect(r.ok).toBe(true);
    expect(appels).toHaveLength(2);
  });
});

describe("G0 · erreurs de facturation, modèle retiré, surcharge", () => {
  it("402 billing_error : « en-attente-credit » SANS nouvel essai, réservation rendue, notification ; reprise seulement après une recharge", async () => {
    await credits.declarerRecharge("anthropic", 500);
    const { appels } = brancher([() => reponseErreur(402, "billing_error", "Your credit balance is too low to access the Anthropic API."), ok]);
    const g = await nouvelleGeneration();
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(r).toMatchObject({ ok: false, arret: "en-attente-credit" });
    expect(appels).toHaveLength(1);
    expect(await depensesClaude()).toHaveLength(0);
    expect((await depots().reservations.lister()).map((x) => x.statut)).toEqual(["liberee"]);
    expect((await depots().notifications.lister()).some((x) => x.type === "credit" && /Claude/.test(x.titre))).toBe(true);
    // Le solde suivi dit encore 5 $, mais Claude a refusé : pas de reprise sans recharge déclarée APRÈS le refus.
    expect(await gc.reprendreGenerationsEnAttenteCredit()).toEqual([]);
    await new Promise((x) => setTimeout(x, 5));
    expect(await gc.declarerRechargeClaude(1000)).toEqual([]);
    expect(await gc.relancerEcrituresEnAttente(g.scriptMaitreId)).toEqual([g.id]);
    expect((await gc.executerRoleFacture(g.id, roleSonde, entree)).ok).toBe(true);
    expect(appels).toHaveLength(2);
  });

  it("400 « credit balance is too low » (forme historique) : même traitement", async () => {
    await credits.declarerRecharge("anthropic", 500);
    const { appels } = brancher([() => reponseErreur(400, "invalid_request_error", "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.")]);
    const g = await nouvelleGeneration();
    expect(await gc.executerRoleFacture(g.id, roleSonde, entree)).toMatchObject({ ok: false, arret: "en-attente-credit" });
    expect(appels).toHaveLength(1);
  });

  it("404 modèle introuvable : « bloquee-modele », message pour Réglages > Qualité, aucune reprise", async () => {
    await credits.declarerRecharge("anthropic", 500);
    const { appels } = brancher([() => reponseErreur(404, "not_found_error", "model: claude-opus-5-5")]);
    const g = await nouvelleGeneration();
    expect(await gc.executerRoleFacture(g.id, roleSonde, entree)).toMatchObject({ ok: false, arret: "bloquee-modele", message: gc.MESSAGE_MODELE_CHANGE });
    expect((await depots().generations.obtenir(g.id))!.statut).toBe("bloquee-modele");
    expect((await gc.etatClaude()).modeleBloque).toBe(gc.MESSAGE_MODELE_CHANGE);
    await gc.declarerRechargeClaude(1000);
    expect((await depots().generations.obtenir(g.id))!.statut).toBe("bloquee-modele");
    await expect(gc.executerRoleFacture(g.id, roleSonde, entree)).rejects.toMatchObject({ code: "GENERATION_ARRETEE" });
    expect(appels).toHaveLength(1);
  });

  it("529 puis 529 puis réponse : 3 essais, une seule dépense", async () => {
    await credits.declarerRecharge("anthropic", 500);
    const { appels } = brancher([() => reponseErreur(529, "overloaded_error", "Overloaded"), () => reponseErreur(529, "overloaded_error", "Overloaded"), ok]);
    const g = await nouvelleGeneration();
    expect((await gc.executerRoleFacture(g.id, roleSonde, entree)).ok).toBe(true);
    expect(appels).toHaveLength(3);
    expect(await depensesClaude()).toHaveLength(1);
  });

  it("trois 529 : arrêt après 3 essais, rien n'est payé, réservation rendue", async () => {
    await credits.declarerRecharge("anthropic", 500);
    const { appels } = brancher([() => reponseErreur(529, "overloaded_error", "Overloaded")]);
    const g = await nouvelleGeneration();
    await expect(gc.executerRoleFacture(g.id, roleSonde, entree)).rejects.toMatchObject({ code: "CLAUDE_INDISPONIBLE" });
    expect(appels).toHaveLength(3);
    expect(await depensesClaude()).toHaveLength(0);
    expect((await depots().reservations.lister()).every((x) => x.statut === "liberee")).toBe(true);
  });
});

describe("G0 · interrupteur et anciennes méthodes", () => {
  it("sans « fournisseur.script = claude » : simulation, 0 $, aucun appel", async () => {
    await ecrireParametre("fournisseur.script", null);
    const { appels } = brancher([ok]);
    const g = await nouvelleGeneration();
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(r).toMatchObject({ ok: true, simule: true, coutUsd: 0 });
    expect(appels).toHaveLength(0);
    expect(await depensesClaude()).toHaveLength(0);
  });

  it("FOURNISSEUR_SCRIPT=claude sans clé sur le serveur : simulation (« À relier »)", async () => {
    await ecrireParametre("fournisseur.script", null);
    vi.stubEnv("FOURNISSEUR_SCRIPT", "claude");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const g = await nouvelleGeneration();
    expect(await gc.executerRoleFacture(g.id, roleSonde, entree)).toMatchObject({ ok: true, simule: true });
    vi.unstubAllEnvs();
  });

  it("aucune ancienne méthode ne dépense : toutes sont celles de la simulation ; seul `executerRole` appelle Claude", async () => {
    const { fetch, appels } = fauxFetch([ok]);
    const claude = creerFournisseurScriptClaude(CLE_ESSAI_CLAUDE, fetch);
    const anciennes = Object.entries(fournisseurScriptSimulation).filter(([, v]) => typeof v === "function");
    expect(anciennes.length).toBeGreaterThan(5);
    // CORRECTEUR 1 — B7 : le résumé de la veille n'est plus hérité sous l'étiquette « réel » (règles fixes, marquées simulées).
    for (const [k, v] of anciennes) expect((claude as unknown as Record<string, unknown>)[k]).toBe(k === "resumerNouveaute" ? undefined : v);
    await claude.accroches("Les PV", 3, "vous");
    expect(appels).toHaveLength(0);
    expect(claude).toMatchObject({ id: "claude", mode: "reel" });
  });

  it("scriptClaude() n'inscrit Claude que si la clé existe", () => {
    expect(Object.keys(scriptClaude({}))).toEqual([]);
    expect(Object.keys(scriptClaude({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }))).toEqual(["claude"]);
  });
});

describe("Sources Claude · la réservation du plafond ne dépend pas du seul compte 1", () => {
  const ligneClaude = { etape: "Écriture", fournisseur: "anthropic", unite: "appel" as const, quantite: 1, prixUnitaire: centimes(50), total: centimes(50), nature: "estime" as const };

  afterEach(() => vi.unstubAllEnvs());

  it("seulement la clé du compte 2 : le besoin Claude est compté (sinon aucune réservation, plafond contourné)", async () => {
    credits.injecterLecteursPourEssai(null);
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY_2", CLE_ESSAI_CLAUDE);
    vi.stubEnv("ANTHROPIC_API_KEY_3", "");
    const besoins = await credits.besoinsDeLEstimation([ligneClaude]);
    expect(besoins.map((b) => b.fournisseur)).toEqual(["anthropic"]);
  });

  it("seulement la clé du compte 2 : une réservation anthropic est active PENDANT l'appel", async () => {
    credits.injecterLecteursPourEssai(null);
    // Les réservations lisent l'environnement du serveur ; l'exécutant lit les clés injectées (jamais celle du compte 1).
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY_2", CLE_ESSAI_CLAUDE);
    vi.stubEnv("ANTHROPIC_API_KEY_3", "");
    let pendant: string[] = [];
    const f = fauxFetch([ok]);
    gc.injecterClaudePourEssai({
      cles: { "abonnement-2": CLE_ESSAI_CLAUDE },
      attenteMs: () => 0,
      fetch: (async (...a: Parameters<typeof fetch>) => {
        pendant = (await depots().reservations.lister((r) => r.statut === "active")).map((r) => r.fournisseur);
        return f.fetch(...a);
      }) as typeof fetch,
    });
    const g = await nouvelleGeneration();
    await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(pendant).toContain("anthropic");
  });

  it("seulement la clé payante, mode api : le besoin Claude est compté et une réservation est active PENDANT l'appel", async () => {
    credits.injecterLecteursPourEssai(null);
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY_2", "");
    vi.stubEnv("ANTHROPIC_API_KEY_3", "");
    vi.stubEnv("ANTHROPIC_API_KEY_PAYANTE", CLE_ESSAI_CLAUDE);
    await ecrireParametre("claude.sources", { mode: "api", ordre: ["abonnement-1", "abonnement-2", "abonnement-3"], desactives: [], changeLe: null });
    expect((await credits.besoinsDeLEstimation([ligneClaude])).map((b) => b.fournisseur)).toEqual(["anthropic"]);
    let pendant: string[] = [];
    const f = fauxFetch([ok]);
    gc.injecterClaudePourEssai({
      cles: { api: CLE_ESSAI_CLAUDE },
      attenteMs: () => 0,
      fetch: (async (...a: Parameters<typeof fetch>) => {
        pendant = (await depots().reservations.lister((r) => r.statut === "active")).map((r) => r.fournisseur);
        return f.fetch(...a);
      }) as typeof fetch,
    });
    const g = await nouvelleGeneration();
    await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(pendant).toContain("anthropic");
  });

  it("aucune des trois clés : rien à réserver", async () => {
    credits.injecterLecteursPourEssai(null);
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY_2", "");
    vi.stubEnv("ANTHROPIC_API_KEY_3", "");
    expect(await credits.besoinsDeLEstimation([ligneClaude])).toEqual([]);
  });
});
