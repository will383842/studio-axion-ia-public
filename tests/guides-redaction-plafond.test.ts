/**
 * 0a phase 2 · « Rédiger avec l'IA » (guides PDF) branché sur la limite Claude du mois et le suivi des dépenses.
 * Vraies dépendances (base en mémoire, brique Crédits, chemin gardé `appelerAvecRotation`) ; Claude DOUBLÉ par un faux
 * `fetch` (fausse clé, aucun réseau). Vérifie :
 *  (a) limite du mois atteinte → refus propre, AUCUN appel au client Claude, rien d'écrit, aucune réservation qui reste ;
 *  (b) appel réussi → une dépense enregistrée (modèle, jetons → coût), réservation « consommee » ; coupure après envoi →
 *      pire cas compté en dépense estimée ; refus net de Claude → rien compté, réservation rendue ; écriture de la
 *      dépense en panne après un appel payé → réservation laissée ACTIVE (toujours comptée dans la limite du mois) ;
 *  (c) interrupteurs éteints (`GUIDES_REDACTION_ENABLED`, `GUIDES_FABRIQUE_ECRAN`) → rien : ni appel, ni dépense, ni réservation.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseErreur, reponseFlux } from "./helpers/g0";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { redigerBrouillonGuide, PREFIXE_PARAM_REDACTION, identifiantMot } = await import("@/services/guides-redaction");
const { redigerGuide } = await import("@/services/guides-fabrique");
const { ETAPE_DEPENSE_REDACTION_GUIDE, PREFIXE_APPEL_REDACTION_GUIDE } = await import("@/fournisseurs/claude/appel-redaction");

const contenuBon = { titre: "Réussir son premier essai", sections: [{ titre: "Préparer", paragraphes: ["Vous commencez par relire le sujet."], puces: ["Un point"] }] };
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

let appels: { url: string; corps: Record<string, unknown> }[] = [];
function brancherClaude(reponse: () => Response | Promise<Response> = () => reponseFlux(fluxReussi({ texte: JSON.stringify(contenuBon), modele: "claude-sonnet-5-5", entree: 900, cacheEcrit: 0, sortie: 1200 }))) {
  appels = [];
  const f = (async (u: string | URL | Request, init?: RequestInit) => {
    appels.push({ url: String(u), corps: JSON.parse(String(init?.body ?? "{}")) });
    return reponse();
  }) as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
}

const depensesGuide = () => depots().depenses.lister((d) => d.lignes.some((l) => l.etape === ETAPE_DEPENSE_REDACTION_GUIDE));
const reservationsGuide = () => depots().reservations.lister((r) => !!r.travailId?.startsWith(`${PREFIXE_APPEL_REDACTION_GUIDE}-`));
const brouillon = async (mot: string) => (await depots().parametres.obtenir(PREFIXE_PARAM_REDACTION + identifiantMot(mot)))?.valeur ?? null;

const MDP = "essai-0a-guides-plafond";
beforeAll(async () => preparerMotDePasse(MDP));

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await credits.declarerRecharge("anthropic", 500);
  await ecrireParametre("fournisseur.script", "claude");
  vi.stubEnv("GUIDES_REDACTION_ENABLED", "true");
  vi.stubEnv("GUIDES_FABRIQUE_ECRAN", "true");
  brancherClaude();
});
afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
  vi.unstubAllEnvs();
});

describe("0a · (a) limite Claude du mois atteinte : refus propre, aucun appel", () => {
  it("redigerBrouillonGuide : « plafond_atteint », aucun appel au client Claude, rien d'écrit, aucune réservation", async () => {
    await ecrireParametre("claude.plafondMensuelUsd", 0.01);
    const r = await redigerBrouillonGuide("essai", "studio");
    expect(r).toEqual({ ok: false, raison: "plafond_atteint" });
    expect(appels).toEqual([]);
    expect(await depensesGuide()).toEqual([]);
    expect(await reservationsGuide()).toEqual([]);
    expect(await brouillon("essai")).toBeNull();
  });

  it("limite déjà consommée par d'autres dépenses du mois : refus aussi (le pire cas de l'appel ne tient plus)", async () => {
    await ecrireParametre("claude.plafondMensuelUsd", 1);
    const l = [gc.ligne("Écriture · autre", 0.99, await gc.taux(), "reel")];
    await depots().depenses.enregistrer({ id: "dep-autre", travailId: "appel-autre", lignes: l, total: l[0]!.total, date: new Date().toISOString(), creeLe: new Date().toISOString(), modifieLe: new Date().toISOString() });
    expect(await redigerBrouillonGuide("essai", "studio")).toEqual({ ok: false, raison: "plafond_atteint" });
    expect(appels).toEqual([]);
  });

  it("le geste « Rédiger avec l'IA » montre une phrase claire, sans montant", async () => {
    await ecrireParametre("claude.plafondMensuelUsd", 0.01);
    const r = await redigerGuide("essai", "studio");
    expect(r).toMatchObject({ ok: false, raison: "redaction", phrase: expect.stringMatching(/limite Claude du mois est atteinte.*rien n'a été rédigé ni payé/) });
    expect(r.phrase).not.toMatch(/\d\s*(€|\$)|(€|\$)\s*\d/);
    expect(appels).toEqual([]);
  });

  it("Claude non choisi : « claude_indisponible », aucun appel, aucune réservation", async () => {
    await ecrireParametre("fournisseur.script", "simulation");
    expect(await redigerBrouillonGuide("essai", "studio")).toEqual({ ok: false, raison: "claude_indisponible" });
    expect(appels).toEqual([]);
    expect(await reservationsGuide()).toEqual([]);
  });
});

describe("0a · (b) chaque appel compte dans le suivi des dépenses", () => {
  it("appel réussi : brouillon enregistré, UNE dépense réelle (anthropic, coût des jetons), réservation consommée", async () => {
    const r = await redigerBrouillonGuide("essai", "studio");
    expect(r).toMatchObject({ ok: true, version: 1 });
    expect(appels).toHaveLength(1);
    expect(appels[0]!.corps).toMatchObject({ model: "claude-sonnet-5-5", max_tokens: 8000 });
    const deps = await depensesGuide();
    expect(deps).toHaveLength(1);
    expect(deps[0]!.travailId).toMatch(new RegExp(`^${PREFIXE_APPEL_REDACTION_GUIDE}-`));
    expect(deps[0]!.lignes).toHaveLength(1);
    expect(deps[0]!.lignes[0]).toMatchObject({ fournisseur: "anthropic", nature: "reel", etape: ETAPE_DEPENSE_REDACTION_GUIDE });
    expect(deps[0]!.total.centimes).toBeGreaterThan(0);
    const res = await reservationsGuide();
    expect(res).toHaveLength(1);
    expect(res[0]!.travailId).toBe(deps[0]!.travailId);
    expect(res[0]!.statut).toBe("consommee");
    // La dépense compte ensuite dans la limite du mois, comme toutes les dépenses Claude.
    expect((await gc.engageClaudeDuMoisCentimes()).depense).toBeGreaterThan(0);
  });

  it("coupure APRÈS l'envoi (réseau) : le pire cas est compté en dépense estimée, réservation consommée, rien d'écrit", async () => {
    brancherClaude(() => {
      throw new TypeError("fetch failed");
    });
    expect(await redigerBrouillonGuide("essai", "studio")).toMatchObject({ ok: false, raison: "panne_claude" });
    const deps = await depensesGuide();
    expect(deps).toHaveLength(1);
    expect(deps[0]!.lignes[0]!.nature).toBe("estime");
    expect((await reservationsGuide()).map((x) => x.statut)).toEqual(["consommee"]);
    expect(await brouillon("essai")).toBeNull();
  });

  it("appel payé mais écriture de la dépense en panne : la réservation reste ACTIVE (toujours comptée), l'erreur remonte", async () => {
    const espion = vi.spyOn(depots().depenses, "enregistrer").mockRejectedValue(new Error("base en panne"));
    const r = await redigerBrouillonGuide("essai", "studio");
    expect(r).toMatchObject({ ok: false });
    expect(appels).toHaveLength(1);
    expect(espion).toHaveBeenCalledTimes(1);
    espion.mockRestore();
    expect(await depensesGuide()).toEqual([]);
    expect((await reservationsGuide()).map((x) => x.statut)).toEqual(["active"]);
    expect((await gc.engageClaudeDuMoisCentimes()).reserve).toBeGreaterThan(0);
    expect(await brouillon("essai")).toBeNull();
  });

  it("refus net de Claude (400) : rien n'est compté, la réservation est rendue", async () => {
    brancherClaude(() => reponseErreur(400, "invalid_request_error", "mauvaise demande"));
    expect(await redigerBrouillonGuide("essai", "studio")).toMatchObject({ ok: false, raison: "panne_claude" });
    expect(await depensesGuide()).toEqual([]);
    expect((await reservationsGuide()).map((x) => x.statut)).toEqual(["liberee"]);
  });
});

describe("0a · (c) interrupteurs éteints : rien", () => {
  it("GUIDES_REDACTION_ENABLED éteint : aucun appel, aucune dépense, aucune réservation", async () => {
    vi.stubEnv("GUIDES_REDACTION_ENABLED", "");
    expect(await redigerBrouillonGuide("essai", "studio")).toEqual({ ok: false, raison: "interrupteur_eteint" });
    expect(appels).toEqual([]);
    expect(await depensesGuide()).toEqual([]);
    expect(await reservationsGuide()).toEqual([]);
  });

  it("GUIDES_FABRIQUE_ECRAN éteint : le geste refuse, aucun appel, aucune dépense, aucune réservation", async () => {
    vi.stubEnv("GUIDES_FABRIQUE_ECRAN", "");
    expect(await redigerGuide("essai", "studio")).toMatchObject({ ok: false, raison: "ecran_eteint" });
    expect(appels).toEqual([]);
    expect(await depensesGuide()).toEqual([]);
    expect(await reservationsGuide()).toEqual([]);
  });
});

describe("0a · la rédaction d'un guide n'envoie pas les phrases fixes des rôles (ancrage, preuve)", () => {
  it("le champ system de la requête envoyée ne contient ni ANCRAGE_MANQUANT ni PREUVE_MANQUANTE", async () => {
    const r = await redigerBrouillonGuide("essai", "studio");
    expect(r).toMatchObject({ ok: true });
    expect(appels).toHaveLength(1);
    const systeme = JSON.stringify(appels[0]!.corps.system);
    expect(systeme).not.toContain("ANCRAGE_MANQUANT");
    expect(systeme).not.toContain("PREUVE_MANQUANTE");
  });

  it("réponse « ANCRAGE_MANQUANT : … » : reponse_illisible, événement qui nomme le marqueur, jamais le texte", async () => {
    brancherClaude(() => reponseFlux(fluxReussi({ texte: "ANCRAGE_MANQUANT : texte secret du modèle", modele: "claude-sonnet-5-5", entree: 900, cacheEcrit: 0, sortie: 50 })));
    expect(await redigerBrouillonGuide("essai", "studio")).toEqual({ ok: false, raison: "reponse_illisible" });
    const evts = await depots().evenements.lister((e) => e.type === "guide_redaction_illisible");
    expect(evts).toHaveLength(1);
    expect(evts[0]!.message).toContain("marqueur=ANCRAGE_MANQUANT");
    expect(evts[0]!.message).not.toContain("texte secret");
    expect(await brouillon("essai")).toBeNull();
  });
});
