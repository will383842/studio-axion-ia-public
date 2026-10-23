/**
 * Socle multi-sources Claude — la rotation entre comptes d'abonnement (`appelerAvecRotation`), JAMAIS vers l'API payante.
 * Faux `fetch` espion (note la clé `x-api-key` de chaque appel), fausses clés d'essai, aucun réseau.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseErreur, reponseFlux } from "../helpers/g0";
import type { GenerationScript } from "@/domaine/types";
import { roleSonde } from "@/generateur/roles/sonde";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const sc = await import("@/services/source-claude");
const comite = await import("@/services/comite-editorial");
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { masquerSecretsClaude } = await import("@/fournisseurs/claude/secret");
const { classerErreur } = await import("@/fournisseurs/claude/client");
const { PARAM_SOURCES_CLAUDE, paramEpuise } = await import("@/domaine/source-claude");

const MDP = "source-claude-rotation";
const CLES = { "abonnement-1": "A1", "abonnement-2": "A2", "abonnement-3": "A3", api: "P" } as const;
const CREDIT = () => reponseErreur(400, "invalid_request_error", "Your credit balance is too low to access the Anthropic API.");
const OK = () => reponseFlux(fluxReussi({ texte: '{"phrase":"ok"}', entree: 2500, cacheEcrit: 1000, sortie: 500 }));

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

/** Faux `fetch` : une file de réponses par clé ; garde la clé de chaque appel. */
function espion(parCle: Record<string, (() => Response)[]>) {
  const cles: string[] = [];
  const f = (async (_url: string | URL | Request, init?: RequestInit) => {
    const cle = new Headers(init?.headers).get("x-api-key") ?? "?";
    cles.push(cle);
    const file = parCle[cle];
    const r = file?.length ? (file.length > 1 ? file.shift()! : file[0]!) : undefined;
    if (!r) throw new Error(`clé inattendue : ${cle}`);
    return r();
  }) as typeof fetch;
  return { fetch: f, cles };
}

function injecter(f: typeof fetch) {
  gc.injecterClaudePourEssai({ cle: "A1", cles: { ...CLES }, fetch: f, attenteMs: () => 0 });
}

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await ecrireParametre("fournisseur.script", "claude");
  await credits.declarerRecharge("anthropic", 5000);
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
});

let n = 0;
async function nouvelleGeneration(): Promise<GenerationScript> {
  const le = new Date().toISOString();
  const g: GenerationScript = { id: `gen-sc-${++n}`, scriptMaitreId: `suj-sc-${n}`, hachageContexte: "h", plafondUsd: 1.5, portee: "sujet", etapes: [], statut: "en-cours", creeLe: le, modifieLe: le };
  await depots().generations.enregistrer(g);
  return g;
}
const entree = { contexte: { contexteAxion: "Axion-IA : formations IA pour dirigeants." }, variable: "<brief>Les PV de stationnement</brief>" };
const reservations = () => depots().reservations.lister((r) => (r.travailId ?? "").startsWith("appel"));
const depensesClaude = () => depots().depenses.lister((d) => d.lignes.some((l) => l.fournisseur === "anthropic"));
const journal = async () => (await depots().evenements.lister(() => true)).map((e) => e.message);

describe("rotation entre comptes d'abonnement", () => {
  it("défaut : le compte 1 répond, un seul appel", async () => {
    const e = espion({ A1: [OK] });
    injecter(e.fetch);
    const g = await nouvelleGeneration();
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(r.ok).toBe(true);
    expect(e.cles).toEqual(["A1"]);
    const deps = await depensesClaude();
    expect(deps).toHaveLength(1);
    expect(deps[0]!.sourceClaude).toBe("abonnement-1");
  });

  it("compte 1 sans crédit (400 HTTP) → compte 2, même appel : 2 appels, 1 dépense, 1 réservation consommée, journal sans clé", async () => {
    const e = espion({ A1: [CREDIT], A2: [OK] });
    injecter(e.fetch);
    const g = await nouvelleGeneration();
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(r.ok).toBe(true);
    expect(e.cles).toEqual(["A1", "A2"]);
    const deps = await depensesClaude();
    expect(deps).toHaveLength(1);
    expect(deps[0]!.sourceClaude).toBe("abonnement-2");
    const res = await reservations();
    expect(res).toHaveLength(1);
    expect(res[0]!.statut).toBe("consommee");
    const j = (await journal()).join("\n");
    expect(j).toContain("passage au compte 2");
    for (const c of ["A1", "A2", "A3", "P"]) expect(j.split(/\W+/)).not.toContain(c);
    // le compte 1 est marqué épuisé : l'appel suivant part directement sur le compte 2
    expect((await sc.etatsEpuisement())["abonnement-1"]).toBe(true);
  });

  it("ANTI-REPLI VERS L'API : 3 comptes sans crédit, clé payante posée → 3 appels, AUCUN avec la clé payante ; attente de crédit, réservation libérée", async () => {
    const e = espion({ A1: [CREDIT], A2: [CREDIT], A3: [CREDIT], P: [OK] });
    injecter(e.fetch);
    const g = await nouvelleGeneration();
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(r).toMatchObject({ ok: false, arret: "en-attente-credit" });
    expect(e.cles).toEqual(["A1", "A2", "A3"]);
    expect(e.cles).not.toContain("P");
    expect((await reservations())[0]!.statut).toBe("liberee");
    expect((await depensesClaude())).toHaveLength(0);
    expect((await depots().generations.obtenir(g.id))!.statut).toBe("en-attente-credit");
  });

  it("tout épuisé au départ (3 marques récentes) → 0 appel, 0 réservation, l'écriture attend", async () => {
    for (const s of ["abonnement-1", "abonnement-2", "abonnement-3"]) await ecrireParametre(paramEpuise(s as never), { depuis: new Date().toISOString() });
    const e = espion({ A1: [OK], A2: [OK], A3: [OK], P: [OK] });
    injecter(e.fetch);
    const g = await nouvelleGeneration();
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(r).toMatchObject({ ok: false, arret: "en-attente-credit" });
    expect(e.cles).toEqual([]);
    expect(await reservations()).toHaveLength(0);
    expect(await depensesClaude()).toHaveLength(0);
    expect((await depots().generations.obtenir(g.id))!.statut).toBe("en-attente-credit");
  });

  it("mode api (choix manuel) : la clé payante seule, une seule tentative, aucun abonnement", async () => {
    await ecrireParametre(PARAM_SOURCES_CLAUDE, { mode: "api", ordre: ["abonnement-1", "abonnement-2", "abonnement-3"], desactives: [], changeLe: null });
    const e = espion({ A1: [OK], A2: [OK], A3: [OK], P: [CREDIT] });
    injecter(e.fetch);
    const g = await nouvelleGeneration();
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(r).toMatchObject({ ok: false, arret: "en-attente-credit" });
    expect(e.cles).toEqual(["P"]);
  });

  it("529 trois fois sur le compte 1 → 3 appels, tous sur le compte 1, pas de rotation", async () => {
    const e = espion({ A1: [() => reponseErreur(529, "overloaded_error", "Overloaded")], A2: [OK] });
    injecter(e.fetch);
    const g = await nouvelleGeneration();
    await gc.executerRoleFacture(g.id, roleSonde, entree).catch(() => undefined);
    expect(e.cles).toEqual(["A1", "A1", "A1"]);
    expect((await sc.etatsEpuisement())["abonnement-1"]).toBe(false);
  });

  it("billing_error DANS le flux → 1 appel, pas de rotation (l'appel a pu être facturé)", async () => {
    const dansLeFlux = () => reponseFlux([["message_start", { type: "message_start", message: { id: "m", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], usage: { input_tokens: 10, output_tokens: 1 } } }], ["error", { type: "error", error: { type: "billing_error", message: "Billing issue" } }]]);
    const e = espion({ A1: [dansLeFlux], A2: [OK] });
    injecter(e.fetch);
    const g = await nouvelleGeneration();
    await gc.executerRoleFacture(g.id, roleSonde, entree).catch(() => undefined);
    expect(e.cles).toEqual(["A1"]);
    expect((await sc.etatsEpuisement())["abonnement-1"]).toBe(false);
  });

  it("coupure réseau → 1 appel, pas de rotation", async () => {
    const cles: string[] = [];
    const coupe = (async (_u: unknown, init?: RequestInit) => {
      cles.push(new Headers(init?.headers).get("x-api-key") ?? "?");
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    injecter(coupe);
    const g = await nouvelleGeneration();
    await gc.executerRoleFacture(g.id, roleSonde, entree).catch(() => undefined);
    expect(cles).toEqual(["A1"]);
  });

  it("2 appels parallèles avec le compte 1 épuisé : une seule marque, les deux finissent sur le compte 2", async () => {
    const e = espion({ A1: [CREDIT], A2: [OK] });
    injecter(e.fetch);
    const g1 = await nouvelleGeneration();
    const g2 = await nouvelleGeneration();
    const [r1, r2] = await Promise.all([gc.executerRoleFacture(g1.id, roleSonde, entree), gc.executerRoleFacture(g2.id, roleSonde, entree)]);
    expect(r1.ok && r2.ok).toBe(true);
    expect(e.cles.filter((c) => c === "A2")).toHaveLength(2);
    expect(e.cles.filter((c) => c === "A3" || c === "P")).toHaveLength(0);
    const marques = await depots().parametres.lister((p) => p.id.startsWith("claude.epuise."));
    expect(marques.filter((p) => p.valeur)).toHaveLength(1);
    const deps = await depensesClaude();
    expect(deps.map((d) => d.sourceClaude)).toEqual(["abonnement-2", "abonnement-2"]);
  });

  it("marquerEpuisee est idempotent : la marque d'une période en cours n'est pas réécrite", async () => {
    await sc.marquerEpuisee("abonnement-1");
    const premiere = await depots().parametres.obtenir(paramEpuise("abonnement-1"));
    await sc.marquerEpuisee("abonnement-1");
    expect((await depots().parametres.obtenir(paramEpuise("abonnement-1")))!.valeur).toEqual(premiere!.valeur);
    await sc.remettreEnService("abonnement-1");
    expect((await sc.etatsEpuisement())["abonnement-1"]).toBe(false);
  });

  it("clé en doublon (compte 2 = compte 1) ignorée : pas de second essai avec la même clé", async () => {
    const e = espion({ A1: [CREDIT], A3: [OK] });
    gc.injecterClaudePourEssai({ cle: "A1", cles: { "abonnement-2": "A1", "abonnement-3": "A3", api: "P" }, fetch: e.fetch, attenteMs: () => 0 });
    const g = await nouvelleGeneration();
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(r.ok).toBe(true);
    expect(e.cles).toEqual(["A1", "A3"]);
  });

  it("vueSourcesClaude ne contient jamais une clé", async () => {
    const vue = JSON.stringify(await sc.vueSourcesClaude({ ANTHROPIC_API_KEY: "cle-compte1-ESSAI-0123456789", ANTHROPIC_API_KEY_PAYANTE: "cle-payante-ESSAI-0123456789" }));
    expect(vue).not.toContain("ESSAI");
    expect(vue).toContain('"clePosee":true');
  });
});

describe("textes de publication (vidéo) : même rotation", () => {
  it("compte 1 sans crédit → compte 2, dépense portant le compte 2 ; tout épuisé → aucun appel", async () => {
    const { executerRolePourVideo } = await import("@/services/depense-claude-video");
    await ecrireParametre("fournisseur.texte-reseaux", "claude");
    const le = new Date().toISOString();
    await depots().videos.enregistrer({ id: "vid-sc-1", creeLe: le, modifieLe: le } as never);
    const e = espion({ A1: [CREDIT], A2: [OK] });
    injecter(e.fetch);
    const r = await executerRolePourVideo("vid-sc-1", roleSonde, entree, { etape: "Texte de publication · Essai" });
    expect(r.ok).toBe(true);
    expect(e.cles).toEqual(["A1", "A2"]);
    expect((await depensesClaude())[0]!.sourceClaude).toBe("abonnement-2");

    for (const s of ["abonnement-1", "abonnement-2", "abonnement-3"]) await ecrireParametre(paramEpuise(s as never), { depuis: new Date().toISOString() });
    const avant = e.cles.length;
    const r2 = await executerRolePourVideo("vid-sc-1", roleSonde, entree, { etape: "Texte de publication · Essai" });
    expect(r2).toMatchObject({ ok: false, arret: "en-attente-credit" });
    expect(e.cles.length).toBe(avant);
  });
});

describe("lots du comité éditorial", () => {
  it("lot envoyé sur le compte 1 puis mode api : le suivi relit le lot avec la clé du compte 1", async () => {
    await ecrireParametre(PARAM_SOURCES_CLAUDE, { mode: "api", ordre: ["abonnement-1", "abonnement-2", "abonnement-3"], desactives: ["abonnement-1"], changeLe: null });
    await ecrireParametre(comite.PARAM_LOT_EN_COURS, { lotId: "msgbatch_x", appelId: "appel-x", envoyeLe: new Date().toISOString(), pireUsd: 0.1, requetes: [], source: "abonnement-1" });
    const cles: string[] = [];
    const f = (async (_u: unknown, init?: RequestInit) => {
      cles.push(new Headers(init?.headers).get("x-api-key") ?? "?");
      return new Response(JSON.stringify({ id: "msgbatch_x", type: "message_batch", processing_status: "in_progress", request_counts: { processing: 1, succeeded: 0, errored: 0, canceled: 0, expired: 0 }, created_at: "2026-10-17T09:00:00Z", results_url: null }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    injecter(f);
    const issue = await comite.travaillerComite({ instant: Date.now() + 86_400_000 });
    expect(issue.etat).toBe("attente");
    expect(cles).toEqual(["A1"]);
  });
});

describe("masquage", () => {
  const CLE = "cle-compte3-ESSAI-0123456789";
  it("une clé de compte quelconque est masquée par masquerSecretsClaude, sans être passée en argument", () => {
    const env = { ANTHROPIC_API_KEY_3: CLE };
    expect(masquerSecretsClaude(`échec avec ${CLE} ici`, [], env)).not.toContain(CLE);
  });
  it("…et par textePropre (crédits)", () => {
    const avant = process.env.ANTHROPIC_API_KEY_3;
    process.env.ANTHROPIC_API_KEY_3 = CLE;
    try {
      expect(credits.textePropre(`échec avec ${CLE} ici`)).not.toContain(CLE);
    } finally {
      if (avant === undefined) delete process.env.ANTHROPIC_API_KEY_3;
      else process.env.ANTHROPIC_API_KEY_3 = avant;
    }
  });
});

describe("classement des erreurs : horsFlux", () => {
  it("400 « credit balance is too low » rendu en HTTP → facturation horsFlux", async () => {
    const { envoyerMessage } = await import("@/fournisseurs/claude/client");
    const { construireRequete } = await import("@/generateur/roles/types");
    const err = await envoyerMessage(construireRequete(roleSonde, entree), { cle: "A1", fetch: (async () => CREDIT()) as typeof fetch }).catch((e) => e);
    expect(err).toMatchObject({ code: "facturation", horsFlux: true });
  });
  it("billing_error dans le flux → facturation, horsFlux faux", async () => {
    const { envoyerMessage } = await import("@/fournisseurs/claude/client");
    const { construireRequete } = await import("@/generateur/roles/types");
    const flux = () => reponseFlux([["message_start", { type: "message_start", message: { id: "m", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], usage: { input_tokens: 10, output_tokens: 1 } } }], ["error", { type: "error", error: { type: "billing_error", message: "Billing issue" } }]]);
    const err = await envoyerMessage(construireRequete(roleSonde, entree), { cle: "A1", fetch: (async () => flux()) as typeof fetch }).catch((e) => e);
    expect(err).toMatchObject({ code: "facturation", horsFlux: false });
  });
  it("classerErreur : horsFlux faux par défaut", () => {
    expect(classerErreur(402, "billing_error", "x").horsFlux).toBe(false);
    expect(classerErreur(402, "billing_error", "x", [], undefined, true).horsFlux).toBe(true);
  });
});
