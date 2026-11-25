/**
 * FIX-RETOUCHE-COUPEE-v21s : une retouche coupée par le réseau AVANT toute réponse HTTP de Claude ne prend plus une des
 * 5 places ; l'argent garde son pire cas (étape sans `termineLe`, réservation active). Faux `fetch`, aucun réseau, 0 €.
 * Modèle : tests/e2e2-gen-argent.test.ts (sujet écrit en simulation, puis retouche chez Claude).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseErreur, reponseFlux } from "./helpers/g0";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.setConfig({ testTimeout: 60_000 });
vi.mock("@/generateur/pire-cas", async (orig) => (await import("./helpers/pire-cas-essai")).pireCasInjectable(await orig()));
import { injecterPireCasChainePourEssai } from "./helpers/pire-cas-essai";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const bg = await import("@/services/boucle-generation");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
type ErreurStudio = import("@/services/_commun").ErreurStudio;
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");
const { envoyerMessage } = await import("@/fournisseurs/claude/client");
const { construireRequete } = await import("@/generateur/roles/types");
import { roleSonde } from "@/generateur/roles/sonde";
import type { GenerationScript } from "@/domaine/types";

type Etape = GenerationScript["etapes"][number];
const MDP = "essai-retouche-coupee-v21s";
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;
const PHRASE_PLAFOND = "5 retouches déjà faites sur cette version : corrigez une phrase à la main (gratuit) ou gardez-la.";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  injecterPireCasChainePourEssai(0);
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
});
afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  injecterPireCasChainePourEssai(null);
  gc.injecterClaudePourEssai(null);
  bg.arreterBoucleGeneration();
});

/** Un sujet écrit en simulation ; rend sa première version. */
async function versionEcrite() {
  const r = await bg.lancerGeneration({ idee: SUJETS_BANC[0].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" as const });
  if (!r.ok) throw new Error("lancement");
  await bg.tourBoucleGeneration();
  return (await depots().variantes.lister((x) => x.scriptMaitreId === r.scriptMaitreId))[0];
}

/** Claude branché pour la retouche, avec un `fetch` compté. */
async function brancher(f: (n: number) => Promise<Response>) {
  await credits.declarerRecharge("anthropic", 100_000);
  await ecrireParametre("fournisseur.script", "claude");
  const appels = { n: 0 };
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: (async () => f(++appels.n)) as typeof fetch, attenteMs: () => 0 });
  return appels;
}

/** Réponse 200 dont le flux envoie un premier bloc SSE puis se coupe (Claude a commencé à produire). */
function fluxCoupe(): Response {
  let envoye = false;
  const corps = new ReadableStream<Uint8Array>({
    pull(c) {
      if (!envoye) {
        envoye = true;
        c.enqueue(new TextEncoder().encode('event: ping\ndata: {"type":"ping"}\n\n'));
      } else c.error(new Error("connexion coupée"));
    },
  });
  return new Response(corps, { status: 200, headers: { "content-type": "text/event-stream" } });
}

const retoucher = (id: string) => bg.regenererVariante(id, "ameliorer").then(() => null, (x: ErreurStudio) => x);
const retouches = () => depots().generations.lister((g) => g.portee === "retouche");
const etapesAppel = async () => (await retouches()).flatMap((g) => g.etapes).filter((e) => e.appelId);
const compteur = (code: string) => lireParametre<number>(bg.cleRetouches(code), 0);

describe("FIX-RETOUCHE-COUPEE-v21s · coupée avant toute réponse : la place est rendue, l'argent ne bouge pas", () => {
  it("(a) coupée avant toute réponse : la place est rendue, l'argent garde son pire cas", async () => {
    const v = await versionEcrite();
    const appels = await brancher(async () => {
      throw new Error("réseau interdit");
    });
    const e = await retoucher(v.id);
    expect(e?.code).toBe("RETOUCHE_INTERROMPUE");
    expect(appels.n).toBe(1);
    expect((await retouches()).map((g) => g.statut)).toEqual(["echec"]);
    expect(await compteur(v.code)).toBe(0);
    const etapes = await etapesAppel();
    expect(etapes).toHaveLength(1);
    expect(etapes[0].sansReponseHttp).toBe(true);
    expect(etapes[0].termineLe).toBeUndefined();
    expect(etapes[0].jetons).toBeUndefined();
    const g = (await retouches())[0];
    expect(etapes[0].estimationPireCasUsd).toBeGreaterThan(0);
    expect(gc.depenseGenerationUsd(g)).toBe(etapes[0].estimationPireCasUsd);
    const res = await depots().reservations.lister((r) => r.travailId === etapes[0].appelId);
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((r) => r.statut === "active")).toBe(true);
  });

  it("(b) même chose avec TypeError(\"fetch failed\") : la place est rendue", async () => {
    const v = await versionEcrite();
    await brancher(async () => {
      throw new TypeError("fetch failed");
    });
    expect((await retoucher(v.id))?.code).toBe("RETOUCHE_INTERROMPUE");
    expect(await compteur(v.code)).toBe(0);
    expect((await etapesAppel()).every((x) => x.sansReponseHttp === true)).toBe(true);
  });

  it("(c) limite du mois à 0 + réseau coupé : au plus 1 appel, la place est rendue, close « echec », jamais reprise seule", async () => {
    // Sur master, la limite du mois à 0 arrête encore la retouche avant l'appel (RETOUCHE_EN_ATTENTE) ; avec la mère
    // (FIX-ROUGES-BUDGET-0811-v21r) elle part et le réseau la coupe (RETOUCHE_INTERROMPUE). Dans les deux cas : 0 place prise.
    const v = await versionEcrite();
    const appels = await brancher(async () => {
      throw new Error("réseau interdit");
    });
    await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, 0);
    const e = await retoucher(v.id);
    expect(["RETOUCHE_INTERROMPUE", "RETOUCHE_EN_ATTENTE"]).toContain(e?.code);
    expect(appels.n).toBeLessThanOrEqual(1);
    expect(await compteur(v.code)).toBe(0);
    expect((await retouches()).map((g) => g.statut)).toEqual(["echec"]);
    await gc.definirPlafondMensuelClaude(100);
    expect((await retouches()).map((g) => g.statut)).toEqual(["echec"]);
  });

  it("(d) flux commencé puis coupé : compte dans les 5, étape SANS la marque", async () => {
    const v = await versionEcrite();
    await brancher(async () => fluxCoupe());
    expect((await retoucher(v.id))?.code).toBe("RETOUCHE_INTERROMPUE");
    expect(await compteur(v.code)).toBe(1);
    const etapes = await etapesAppel();
    expect(etapes.length).toBeGreaterThan(0);
    expect(etapes.some((x) => x.sansReponseHttp)).toBe(false);
  });

  it("(e) délai avant réponse : ErreurClaude « delai » non marquée, et la règle pure dit « compte »", async () => {
    const pendu = (async (_u: unknown, init?: RequestInit) =>
      new Promise<Response>((_ok, ko) => init?.signal?.addEventListener("abort", () => ko(new Error("abandon"))))) as typeof fetch;
    await expect(envoyerMessage(construireRequete(roleSonde, { contexte: {}, variable: "x" }), { cle: CLE_ESSAI_CLAUDE, fetch: pendu, delaiInactiviteMs: 50 })).rejects.toMatchObject({ code: "delai", sansReponseHttp: false });
    const lance = new Date().toISOString();
    expect(bg.retoucheSansRienRecu([{ role: "x", versionConsigne: 1, modeleDemande: "m", effort: "e", appelId: "a", lanceLe: lance, estimationPireCasUsd: 0.07 } as unknown as Etape])).toBe(false);
  });

  it("(f) réponse reçue et payée mais sans version : compte dans les 5", async () => {
    const v = await versionEcrite();
    await brancher(async () => reponseFlux(fluxReussi({ texte: "pas du json, aucune version", modele: "claude-opus-5-5", entree: 1000, sortie: 50 })));
    const e = await retoucher(v.id);
    expect(e).not.toBeNull();
    const etapes = await etapesAppel();
    expect(etapes.some((x) => !!x.jetons)).toBe(true);
    expect(await compteur(v.code)).toBe(1);
  });

  it("(g) règle pure, bornes", () => {
    const lance = new Date().toISOString();
    const base = { role: "x", versionConsigne: 1, modeleDemande: "m", effort: "e", appelId: "a", lanceLe: lance, estimationPireCasUsd: 0.07 } as unknown as Etape;
    const refus: Etape = { ...base, termineLe: lance, resultat: "rejete" };
    const coupee: Etape = { ...base, sansReponseHttp: true };
    const recue: Etape = { ...base, termineLe: lance, jetons: { entree: 10, cacheLu: 0, cacheEcrit: 0, sortie: 5 } };
    expect(bg.retoucheSansRienRecu([])).toBe(false);
    expect(bg.retoucheSansRienRecu([refus])).toBe(true);
    expect(bg.retoucheSansRienRecu([coupee])).toBe(true);
    expect(bg.retoucheSansRienRecu([refus, coupee])).toBe(true);
    expect(bg.retoucheSansRienRecu([recue, coupee])).toBe(false);
    expect(bg.retoucheSansRienRecu([base])).toBe(false);
    expect(bg.retoucheSansRienRecu([{ ...coupee, jetons: recue.jetons }])).toBe(false);
  });

  it("(h) client : seule la coupure avant réponse est marquée", async () => {
    const req = construireRequete(roleSonde, { contexte: {}, variable: "x" });
    await expect(envoyerMessage(req, { cle: CLE_ESSAI_CLAUDE, fetch: fetchInterdit })).rejects.toMatchObject({ code: "reseau", sansReponseHttp: true });
    await expect(envoyerMessage(req, { cle: CLE_ESSAI_CLAUDE, fetch: (async () => fluxCoupe()) as typeof fetch })).rejects.toMatchObject({ code: "reseau", sansReponseHttp: false });
    await expect(envoyerMessage(req, { cle: CLE_ESSAI_CLAUDE, fetch: (async () => reponseErreur(529, "overloaded_error", "Overloaded")) as typeof fetch })).rejects.toMatchObject({ code: "surcharge", sansReponseHttp: false });
  });

  it("(i) la 5e place : coupée avant réponse à 4/5 → 4, la suivante passe (5/5) ; flux coupé à 4/5 → 5/5, la suivante est refusée", async () => {
    const v = await versionEcrite();
    await ecrireParametre(bg.cleRetouches(v.code), 4);
    await brancher(async () => {
      throw new Error("réseau interdit");
    });
    expect((await retoucher(v.id))?.code).toBe("RETOUCHE_INTERROMPUE");
    expect(await compteur(v.code)).toBe(4);
    await ecrireParametre("fournisseur.script", "simulation");
    gc.injecterClaudePourEssai(null);
    expect(await retoucher(v.id)).toBeNull();
    expect(await compteur(v.code)).toBe(5);

    const w = (await depots().variantes.lister((x) => x.code !== v.code && x.scriptMaitreId === v.scriptMaitreId))[0] ?? v;
    const code = w.code === v.code ? null : w.code;
    if (code) {
      await ecrireParametre(bg.cleRetouches(code), 4);
      await brancher(async () => fluxCoupe());
      expect((await retoucher(w.id))?.code).toBe("RETOUCHE_INTERROMPUE");
      expect(await compteur(code)).toBe(5);
      const refus = await retoucher(w.id);
      expect(refus?.code).toBe("PLAFOND_RETOUCHES");
      expect(refus?.message).toBe(PHRASE_PLAFOND);
    } else throw new Error("une seconde version est nécessaire au cas « flux coupé à 4/5 »");
  });

  it("(j) refus net (400) inchangé : la place est rendue, la réservation est rendue", async () => {
    const v = await versionEcrite();
    await brancher(async () => reponseErreur(400, "invalid_request_error", "max_tokens: too large"));
    const e = await retoucher(v.id);
    expect(e).not.toBeNull();
    expect(await compteur(v.code)).toBe(0);
    const etapes = await etapesAppel();
    expect(etapes.length).toBeGreaterThan(0);
    expect(etapes.every((x) => !!x.termineLe && !x.sansReponseHttp)).toBe(true);
    for (const x of etapes) expect((await depots().reservations.lister((r) => r.travailId === x.appelId)).every((r) => r.statut === "liberee")).toBe(true);
  });
});
