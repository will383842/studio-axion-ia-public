/**
 * COMITÉ ÉDITORIAL DES IDÉES (lot « Idées : comité éditorial », 17/10) — tout en SIMULATION.
 *
 * Claude est DOUBLÉ par un faux `fetch` qui sert l'API Message Batches (création, lecture, résultats `.jsonl`) et
 * l'API Messages (flux), d'après la forme documentée ; tout autre `fetch` fait échouer le test. Fausse clé, aucun
 * appel réel. L'Usine est doublée par une source d'essai (signatures uniques).
 *
 *  1. Le rôle : Opus 5.5, effort medium, socle en cache 1 h, aucun `output_config.format`, JSON validé par zod.
 *  2. Le contrôle anti-invention : chaque jugement se rattache à une idée envoyée, aucun chiffre ajouté, règles de Will.
 *  3. Le client des lots : corps sans flux ni repli serveur, résultats liés par `custom_id` dans n'importe quel ordre.
 *  4. Le cycle : réglage éteint, envoi (pire cas réservé, × 50 %), attente, résultats partiels, échec, plafond, une
 *     fois par jour, réserve suffisante, repli à la demande (prix montré avant).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseErreur, reponseFlux } from "./helpers/g0";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const comite = await import("@/services/comite-editorial");
const source = await import("@/services/source-idees");
const lots = await import("@/fournisseurs/claude/lots");
const { roleComite, controlerJugements, variableComite, CONSIGNE_COMITE, schemaComite } = await import("@/generateur/roles/comite");
const { construireRequete } = await import("@/generateur/roles/types");
const { coutUsd } = await import("@/fournisseurs/claude/tarifs");
const { TAUX_USD_EUR_PAR_DEFAUT } = await import("@/lib/montants");

const MDP = "essai-comite-editorial";
const H = 3_600_000;

/* ------------------------------------------------------------------ */
/* Doubles : l'Usine et Claude                                          */
/* ------------------------------------------------------------------ */

/** Source d'essai « réelle » (pas simulée) : la simulation de l'Usine, signatures uniques. */
function sourceEssai(): import("@/services/source-idees").SourceIdees {
  const sim = source.sourceIdeesSimulee();
  return { nom: "Usine (essai)", simulee: false, tirer: (n) => sim.tirer(n) };
}

type IssueRequete = "succeeded" | "errored" | "expired" | "canceled";
interface EtatFaux {
  appels: { url: string; methode: string; corps: Record<string, unknown> }[];
  lots: Map<string, { requetes: { custom_id: string; params: Record<string, unknown> }[]; statut: "in_progress" | "ended"; creeLe?: string }>;
  issues: IssueRequete[];
  /** Remplace la sortie simulée d'une requête (sortie JSON du comité). */
  remplacer?: (sortie: { jugements: Record<string, unknown>[] }, i: number) => unknown;
  creation?: () => Response;
  /** Le lot EST créé, puis la réponse se perd (passerelle 5xx…) : cette réponse remplace la bonne. */
  apresCreation?: () => Response;
  /** `created_at` des lots créés (défaut : 2026-10-17T09:00:00Z). */
  creeLe?: string;
  /** Jetons rendus par requête (indice) : réalistes par défaut. */
  usage: (i: number) => Record<string, number>;
}
const faux: EtatFaux = { appels: [], lots: new Map(), issues: [], usage: () => ({}) };

/** Jetons réalistes : socle ≈ 8 000 jetons écrit en cache 1 h au 1er appel, lu ensuite ; 10 idées ≈ 3 000 ; sortie 2 500. */
function usageRealiste(i: number): Record<string, number> {
  return i === 0 ? { input_tokens: 3000, cache_read_input_tokens: 0, cache_creation_input_tokens: 8000, output_tokens: 2500 } : { input_tokens: 3000, cache_read_input_tokens: 8000, cache_creation_input_tokens: 0, output_tokens: 2500 };
}

function sortieSimulee(params: Record<string, unknown>): { jugements: Record<string, unknown>[] } {
  const messages = params.messages as { content: string }[];
  return roleComite.simuler({ contexte: {}, variable: messages[0]!.content }) as { jugements: Record<string, unknown>[] };
}

function objetLot(id: string, statut: "in_progress" | "ended", n: number, creeLe = "2026-10-17T09:00:00Z"): Record<string, unknown> {
  return {
    id,
    type: "message_batch",
    processing_status: statut,
    request_counts: { processing: statut === "ended" ? 0 : n, succeeded: statut === "ended" ? n : 0, errored: 0, canceled: 0, expired: 0 },
    ended_at: statut === "ended" ? "2026-10-17T10:00:00Z" : null,
    created_at: creeLe,
    expires_at: "2026-10-18T09:00:00Z",
    cancel_initiated_at: null,
    results_url: statut === "ended" ? `https://api.anthropic.com/v1/messages/batches/${id}/results` : null,
  };
}

function fauxClaude(): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (!u.startsWith("https://api.anthropic.com/")) throw new Error(`Adresse inattendue : ${u}`);
    const methode = init?.method ?? "GET";
    const corps = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    faux.appels.push({ url: u, methode, corps });
    const json = (j: unknown, statut = 200) => new Response(JSON.stringify(j), { status: statut, headers: { "content-type": "application/json" } });
    if (u === lots.URL_LOTS && methode === "POST") {
      if (faux.creation) return faux.creation();
      const id = `msgbatch_essai${faux.lots.size + 1}`;
      const requetes = corps.requests as { custom_id: string; params: Record<string, unknown> }[];
      faux.lots.set(id, { requetes, statut: "in_progress", ...(faux.creeLe ? { creeLe: faux.creeLe } : {}) });
      if (faux.apresCreation) return faux.apresCreation();
      return json(objetLot(id, "in_progress", requetes.length, faux.creeLe));
    }
    if (u.startsWith(`${lots.URL_LOTS}?`) && methode === "GET") {
      // Liste : les plus récents d'abord.
      return json({ data: [...faux.lots].reverse().map(([id, l]) => objetLot(id, l.statut, l.requetes.length, l.creeLe)), has_more: false });
    }
    const m = /\/v1\/messages\/batches\/([^/]+)(\/results)?$/.exec(u);
    if (m && methode === "GET") {
      const lot = faux.lots.get(m[1]!);
      if (!lot) return reponseErreur(404, "not_found_error", "batch not found");
      if (!m[2]) return json(objetLot(m[1]!, lot.statut, lot.requetes.length, lot.creeLe));
      // Résultats : ordre INVERSE de l'envoi (l'API ne garantit aucun ordre).
      const lignes = lot.requetes.map((r, i) => {
        const issue = faux.issues[i] ?? "succeeded";
        if (issue === "errored") return { custom_id: r.custom_id, result: { type: "errored", error: { type: "error", error: { type: "api_error", message: "Internal server error" } } } };
        if (issue !== "succeeded") return { custom_id: r.custom_id, result: { type: issue } };
        let sortie: unknown = sortieSimulee(r.params);
        if (faux.remplacer) sortie = faux.remplacer(sortie as { jugements: Record<string, unknown>[] }, i);
        const usage = { ...usageRealiste(i), ...faux.usage(i) };
        return { custom_id: r.custom_id, result: { type: "succeeded", message: { id: `msg_${i}`, type: "message", role: "assistant", model: "claude-opus-5-5", content: [{ type: "thinking", thinking: "" }, { type: "text", text: JSON.stringify(sortie) }], stop_reason: "end_turn", stop_sequence: null, usage } } };
      });
      return new Response(lignes.reverse().map((l) => JSON.stringify(l)).join("\n") + "\n", { status: 200, headers: { "content-type": "application/binary" } });
    }
    if (u === "https://api.anthropic.com/v1/messages" && methode === "POST") {
      const n = faux.appels.filter((a) => a.url === u).length - 1;
      const u2 = usageRealiste(n);
      return reponseFlux(fluxReussi({ texte: JSON.stringify(sortieSimulee(corps)), entree: u2.input_tokens, cacheLu: u2.cache_read_input_tokens, cacheEcrit: u2.cache_creation_input_tokens, sortie: u2.output_tokens }));
    }
    throw new Error(`Appel inattendu : ${methode} ${u}`);
  }) as typeof fetch;
}

const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  Object.assign(faux, { appels: [], lots: new Map(), issues: [], remplacer: undefined, creation: undefined, apresCreation: undefined, creeLe: undefined, usage: () => ({}) });
  vi.stubGlobal("fetch", () => {
    throw new Error("fetch interdit (aucun appel réel)");
  });
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await ecrireParametre("fournisseur.script", "claude");
  await credits.declarerRecharge("anthropic", 500);
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fauxClaude(), attenteMs: () => 0 });
  source.brancherSourceIdees(sourceEssai());
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
  source.brancherSourceIdees(null);
  vi.unstubAllGlobals();
});

async function allumer() {
  await ecrireParametre(comite.PARAM_COMITE, true);
}

const reservationsIdees = () => depots().reservations.lister((r) => !!r.travailId?.startsWith("idees-"));
const depensesIdees = () => depots().depenses.lister((d) => d.lignes.some((l) => l.etape.startsWith(comite.PREFIXE_ETAPE_IDEES)));

/* ------------------------------------------------------------------ */
/* 1. Le rôle                                                           */
/* ------------------------------------------------------------------ */

describe("Comité · rôle", () => {
  it("Opus 5.5, effort medium, socle en cache 1 h, JSON demandé dans la consigne sans `output_config.format`", () => {
    expect(roleComite.id).toBe("comite-editorial");
    expect(roleComite.modele).toBe("claude-opus-5-5");
    expect(roleComite.effort).toBe("medium");
    const r = construireRequete(roleComite, { contexte: { contexteAxion: "charte", styleWill: "style", preuves: "preuves" }, variable: variableComite([{ id: "i1-1", textes: { douleur: "relance les devis" } }]) });
    expect(r.systeme[2]).toMatchObject({ cache: "1h" });
    expect(r.schema).toBeUndefined();
    expect(r.json).toBe(true);
    const params = lots.paramsLot(r);
    expect(params.output_config).toEqual({ effort: "medium" });
    expect(JSON.stringify(params)).not.toContain('"format"');
  });

  it("la consigne porte les 4 axes et les règles de Will", () => {
    for (const mot of ["douleur", "cible", "angleDifferent", "potentiel", "un influenceur IA pourrait-il dire cela", "faites-le vous-même", "vient de sortir", "Une vidéo = une cible", "RIEN D'INVENTÉ"]) expect(CONSIGNE_COMITE).toContain(mot);
  });

  it("la simulation juge chaque idée, une fois, avec des notes valides (zod)", () => {
    const idees = Array.from({ length: 10 }, (_, i) => ({ id: `i1-${i + 1}`, textes: { metier: "expert-comptable", douleur: `ressaisit les factures ${i}` } }));
    const sortie = schemaComite.parse(roleComite.simuler({ contexte: {}, variable: variableComite(idees) }));
    expect(sortie.jugements.map((j) => j.id)).toEqual(idees.map((i) => i.id));
    expect(controlerJugements(idees, sortie).refuses).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Contrôle anti-invention                                           */
/* ------------------------------------------------------------------ */

describe("Comité · contrôle anti-invention", () => {
  const idees: import("@/generateur/roles/comite").IdeeAJuger[] = [
    { id: "i1-1", textes: { metier: "agent immobilier", taille: "PME de 40 salariés", douleur: "relance les devis à la main" } },
    { id: "i1-2", textes: { metier: "DRH", douleur: "trie les candidatures une par une" } },
  ];
  const j = (id: string, angle: string, raison = "Douleur concrète.") => ({ id, notes: { douleur: 8, cible: 7, angleDifferent: 6, potentiel: 9 }, verdict: "garder" as const, raison, angle });

  it("garde un angle rattaché à son idée, calcule le total", () => {
    const r = controlerJugements(idees, { jugements: [j("i1-1", "L'agent immobilier de 40 salariés qui relance ses devis : on s'en occupe.")] });
    expect(r.refuses).toEqual([]);
    expect(r.gardes[0]).toMatchObject({ id: "i1-1", total: 30 });
  });

  it("refuse un jugement sans idée envoyée, un doublon, un chiffre ajouté, et les tournures interdites par Will", () => {
    const r = controlerJugements(idees, {
      jugements: [
        j("i9-9", "Une idée inventée."),
        j("i1-1", "Relancer ses devis en 3 clics."),
        j("i1-2", "Le DRH qui trie les CV : faites-le vous-même avec ChatGPT."),
        j("i1-2", "Le DRH qui trie : cet outil vient de sortir."),
      ],
    });
    expect(r.gardes).toEqual([]);
    expect(r.refuses.join(" | ")).toMatch(/sans idée envoyée/);
    expect(r.refuses.join(" | ")).toMatch(/chiffre ajouté \(3\)/);
    expect(r.refuses.join(" | ")).toMatch(/faites-le vous-même/);
    expect(r.refuses.join(" | ")).toMatch(/jugée deux fois/);
  });

  it("un chiffre présent dans l'idée est permis ; un chiffre glissé dans la raison est refusé", () => {
    expect(controlerJugements(idees, { jugements: [j("i1-1", "La PME de 40 salariés et ses devis.")] }).gardes).toHaveLength(1);
    expect(controlerJugements(idees, { jugements: [j("i1-1", "La PME et ses devis.", "Gagne 12 heures.")] }).refuses[0]).toMatch(/chiffre ajouté \(12\)/);
  });
});

/* ------------------------------------------------------------------ */
/* 3. Client des lots                                                   */
/* ------------------------------------------------------------------ */

describe("Comité · client Message Batches", () => {
  it("corps de création : `custom_id` + `params` sans `stream` ni `fallbacks` ; identifiants vérifiés", () => {
    const requete = construireRequete(roleComite, { contexte: { contexteAxion: "c" }, variable: "v" });
    const corps = lots.corpsLot([{ idPerso: "idees-abc-r1", requete }]);
    expect(corps.requests[0]!.custom_id).toBe("idees-abc-r1");
    expect(corps.requests[0]!.params).not.toHaveProperty("stream");
    expect(corps.requests[0]!.params).not.toHaveProperty("fallbacks");
    expect(corps.requests[0]!.params).toMatchObject({ model: "claude-opus-5-5", max_tokens: roleComite.maxTokens });
    expect(() => lots.corpsLot([{ idPerso: "a b", requete }])).toThrow();
    expect(() => lots.corpsLot([{ idPerso: "x", requete }, { idPerso: "x", requete }])).toThrow();
  });

  it("résultats `.jsonl` liés par `custom_id` (ordre quelconque), erreurs classées, lignes inconnues ignorées", () => {
    const texte = [
      JSON.stringify({ custom_id: "r2", result: { type: "errored", error: { type: "error", error: { type: "invalid_request_error", message: "bad" } } } }),
      "pas du json",
      JSON.stringify({ custom_id: "inconnu", result: { type: "succeeded", message: {} } }),
      JSON.stringify({ custom_id: "r1", result: { type: "succeeded", message: { id: "m", model: "claude-opus-5-5", content: [{ type: "text", text: '```json\n{"a":1}\n```' }], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5, cache_creation: { ephemeral_1h_input_tokens: 0 } } } } }),
      JSON.stringify({ custom_id: "r3", result: { type: "expired" } }),
    ].join("\n");
    const req = new Map([["r1", { modele: "claude-opus-5-5", json: true }], ["r2", { modele: "claude-opus-5-5", json: true }], ["r3", { modele: "claude-opus-5-5", json: true }]]);
    const r = lots.lireResultatsJsonl(texte, req);
    expect(r.map((x) => `${x.idPerso}:${x.type}`)).toEqual(["r2:errored", "r1:succeeded", "r3:expired"]);
    const ok = r.find((x) => x.type === "succeeded");
    expect(ok && ok.type === "succeeded" ? ok.reponse.texte : "").toBe('{"a":1}');
    const ko = r.find((x) => x.type === "errored");
    expect(ko && ko.type === "errored" ? ko.erreur.code : "").toBe("requete");
  });

  it("objet `message_batch` lu ; un objet illisible est refusé", () => {
    expect(lots.lireEtatLot(objetLot("msgbatch_1", "ended", 3))).toMatchObject({ id: "msgbatch_1", statut: "ended", urlResultats: expect.stringContaining("/results") });
    expect(() => lots.lireEtatLot({ id: "x", processing_status: "bizarre" })).toThrow();
  });
});

/* ------------------------------------------------------------------ */
/* 4. Cycle du travail de fond                                          */
/* ------------------------------------------------------------------ */

describe("Comité · travail de fond (lot groupé simulé)", () => {
  it("LIVRÉ ÉTEINT : réglage absent, rien ne part, aucun appel", async () => {
    expect(await comite.comiteAllume()).toBe(false);
    expect(await comite.travaillerComite()).toEqual({ etat: "eteint" });
    expect(faux.appels).toEqual([]);
    expect(await comite.jugerALaDemande(10_000)).toMatchObject({ ok: false });
    expect(faux.appels).toEqual([]);
  });

  it("jamais de lot payant sur la source SIMULÉE de l'Usine", async () => {
    await allumer();
    source.brancherSourceIdees(null);
    expect(await comite.travaillerComite()).toEqual({ etat: "source-simulee" });
    expect(faux.appels).toEqual([]);
    expect(await reservationsIdees()).toEqual([]);
  });

  it("envoi → attente → fini : 30 idées en 3 requêtes, pire cas × 50 % réservé, dépense réelle ≈ 0,10-0,20 €, réservation consommée", async () => {
    await allumer();
    const t0 = Date.parse("2026-10-17T08:00:00Z");
    const envoi = await comite.travaillerComite({ instant: t0 });
    expect(envoi).toMatchObject({ etat: "envoye", idees: 30 });
    const creation = faux.appels.find((a) => a.methode === "POST")!;
    const requetes = creation.corps.requests as { custom_id: string; params: Record<string, unknown> }[];
    expect(requetes).toHaveLength(3);
    // Socle en cache 1 h dans chaque requête (préfixe identique : lu en cache d'une requête à l'autre).
    for (const r of requetes) expect(JSON.stringify(r.params.system)).toContain('"ttl":"1h"');
    expect(JSON.stringify(requetes[0]!.params.system)).toBe(JSON.stringify(requetes[2]!.params.system));
    // Pire cas réservé AVANT l'appel, au tarif des lots (moitié prix), marge des crédits comprise.
    const pire = envoi.etat === "envoye" ? envoi.pireUsd : 0;
    const res = await reservationsIdees();
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ statut: "active", fournisseur: "anthropic" });
    expect(res[0]!.centimes).toBeGreaterThanOrEqual(Math.floor(pire * 100));
    expect(pire).toBeLessThan(0.5);

    // Attente : dans les 5 min, aucune lecture ; ensuite lu « en cours ».
    const n = faux.appels.length;
    expect(await comite.travaillerComite({ instant: t0 + 60_000 })).toEqual({ etat: "attente" });
    expect(faux.appels.length).toBe(n);
    expect(await comite.travaillerComite({ instant: t0 + 6 * 60_000 })).toEqual({ etat: "attente" });
    expect(faux.appels.length).toBe(n + 1);

    // Fini.
    faux.lots.get("msgbatch_essai1")!.statut = "ended";
    const fin = await comite.travaillerComite({ instant: t0 + 12 * 60_000 });
    expect(fin).toMatchObject({ etat: "range", gardes: 30, refuses: [] });
    const jugees = await comite.listerIdeesJugees();
    expect(jugees).toHaveLength(30);
    expect(jugees[0]!.total).toBeGreaterThanOrEqual(jugees.at(-1)!.total);
    expect(jugees.every((j) => j.source === "lot" && j.lotId === "msgbatch_essai1" && j.signature && j.angle && j.date)).toBe(true);
    // Les codes de l'usine sont gardés pour `retenir` quand l'idée sera écrite.
    expect(jugees.every((j) => j.parts && typeof j.parts.metier === "string")).toBe(true);

    // Argent : coût réel = jetons × tarif × 50 % ; ≈ 0,10-0,20 € pour 30 idées.
    const attendu = [0, 1, 2].reduce((s, i) => {
      const u = usageRealiste(i);
      return s + coutUsd({ entree: u.input_tokens!, cacheLu: u.cache_read_input_tokens!, cacheEcrit: u.cache_creation_input_tokens!, sortie: u.output_tokens! }, "claude-opus-5-5") * 0.5;
    }, 0);
    expect(fin.etat === "range" ? fin.coutUsd : 0).toBeCloseTo(attendu, 6);
    const euros = attendu * TAUX_USD_EUR_PAR_DEFAUT;
    expect(euros).toBeGreaterThan(0.08);
    expect(euros).toBeLessThan(0.2);
    const deps = await depensesIdees();
    expect(deps).toHaveLength(1);
    expect(deps[0]!.lignes[0]).toMatchObject({ nature: "reel", fournisseur: "anthropic" });
    expect((await reservationsIdees())[0]!.statut).toBe("consommee");
    expect(await lireParametre(comite.PARAM_LOT_EN_COURS, null)).toBeNull();

    // Réserve pleine : aucun nouveau lot.
    expect(await comite.tailleReserve()).toBeGreaterThan(0);
  });

  it("résultats PARTIELS : la requête réussie est rangée, l'erreur et l'expirée ne coûtent rien", async () => {
    await allumer();
    faux.issues = ["succeeded", "errored", "expired"];
    const t0 = Date.parse("2026-10-17T08:00:00Z");
    await comite.travaillerComite({ instant: t0 });
    faux.lots.get("msgbatch_essai1")!.statut = "ended";
    const fin = await comite.travaillerComite({ instant: t0 + 10 * 60_000 });
    expect(fin).toMatchObject({ etat: "range", gardes: 10 });
    expect(fin.etat === "range" ? fin.refuses.join(" | ") : "").toMatch(/r2 : surcharge.*r3 : expirée|r3 : expirée.*r2 : surcharge/);
    expect(await depots().ideesJugees.compter()).toBe(10);
    const u = usageRealiste(0);
    expect(fin.etat === "range" ? fin.coutUsd : 0).toBeCloseTo(coutUsd({ entree: u.input_tokens!, cacheLu: 0, cacheEcrit: u.cache_creation_input_tokens!, sortie: u.output_tokens! }, "claude-opus-5-5") * 0.5, 6);
  });

  it("une sortie qui invente (chiffre ajouté, idée inconnue) est écartée au contrôle ; le reste est rangé", async () => {
    await allumer();
    faux.remplacer = (s, i) => (i === 0 ? { jugements: [...s.jugements.slice(1), { ...s.jugements[0], angle: "Gagnez 15 heures par semaine." }, { ...s.jugements[1], id: "i9-9" }] } : s);
    const t0 = Date.parse("2026-10-17T08:00:00Z");
    await comite.travaillerComite({ instant: t0 });
    faux.lots.get("msgbatch_essai1")!.statut = "ended";
    const fin = await comite.travaillerComite({ instant: t0 + 10 * 60_000 });
    expect(fin).toMatchObject({ etat: "range", gardes: 29 });
    expect(fin.etat === "range" ? fin.refuses.join(" | ") : "").toMatch(/chiffre ajouté \(15\).*sans idée envoyée/);
    expect((await comite.listerIdeesJugees()).some((j) => /15/.test(j.angle))).toBe(false);
  });

  it("ÉCHEC à la création (refus net) : réservation rendue, rien payé ; coupure réseau : réservation gardée, introuvable après 1 h : pire cas compté en estimation", async () => {
    await allumer();
    faux.creation = () => reponseErreur(400, "invalid_request_error", "bad");
    expect(await comite.travaillerComite({ instant: Date.parse("2026-10-17T08:00:00Z") })).toMatchObject({ etat: "arrete" });
    expect((await reservationsIdees()).map((r) => r.statut)).toEqual(["liberee"]);
    expect(await depensesIdees()).toEqual([]);

    // Le lendemain, coupure réseau pendant l'envoi : le lot a pu être créé, la réservation est gardée.
    faux.creation = () => {
      throw new Error("coupure");
    };
    const t1 = Date.parse("2026-10-18T08:00:00Z");
    expect(await comite.travaillerComite({ instant: t1 })).toMatchObject({ etat: "arrete" });
    expect((await reservationsIdees()).map((r) => r.statut).sort()).toEqual(["active", "liberee"]);
    expect(await depensesIdees()).toEqual([]);
    // Cherché dans la liste, introuvable : on attend 1 h, sans jamais renvoyer de lot.
    expect(await comite.travaillerComite({ instant: t1 + 10 * 60_000 })).toEqual({ etat: "attente" });
    expect(await comite.travaillerComite({ instant: t1 + 61 * 60_000 })).toMatchObject({ etat: "arrete", message: expect.stringMatching(/introuvable/) });
    expect(faux.appels.filter((a) => a.url === lots.URL_LOTS && a.methode === "POST")).toHaveLength(2);
    const deps = await depensesIdees();
    expect(deps).toHaveLength(1);
    expect(deps[0]!.lignes[0]!.nature).toBe("estime");
    expect((await reservationsIdees()).map((r) => r.statut).sort()).toEqual(["consommee", "liberee"]);
    // L'estimation compte dans le plafond des idées.
    expect(await comite.engageIdeesDuMoisCentimes()).toBeGreaterThan(0);
  });

  it("création en 500 (le lot EST créé, la réponse est perdue) : réservation gardée, lot retrouvé par la liste, dépense réelle, jamais repayé", async () => {
    await allumer();
    const t0 = Date.parse("2026-10-17T08:00:00Z");
    faux.creeLe = "2026-10-17T08:00:01Z";
    faux.apresCreation = () => reponseErreur(500, "api_error", "Internal server error");
    expect(await comite.travaillerComite({ instant: t0 })).toMatchObject({ etat: "arrete" });
    // Rien n'est rendu : le lot a pu être créé.
    expect((await reservationsIdees()).map((r) => r.statut)).toEqual(["active"]);
    expect(await depensesIdees()).toEqual([]);
    expect(await lireParametre<{ incertain?: boolean } | null>(comite.PARAM_LOT_EN_COURS, null)).toMatchObject({ incertain: true });
    // Un lot d'un AUTRE envoi, même taille, même moment, fini : écarté (ses `custom_id` ne sont pas les nôtres).
    const notre = faux.lots.get("msgbatch_essai1")!;
    faux.lots.set("msgbatch_autre", { requetes: notre.requetes.map((r, i) => ({ ...r, custom_id: `autre-r${i + 1}` })), statut: "ended", creeLe: "2026-10-17T08:00:02Z" });
    // Dans les 5 min : rien n'est lu. Ensuite : le nôtre est encore en cours, on attend.
    expect(await comite.travaillerComite({ instant: t0 + 60_000 })).toEqual({ etat: "attente" });
    expect(await comite.travaillerComite({ instant: t0 + 6 * 60_000 })).toEqual({ etat: "attente" });
    notre.statut = "ended";
    const fin = await comite.travaillerComite({ instant: t0 + 12 * 60_000 });
    expect(fin).toMatchObject({ etat: "range", lotId: "msgbatch_essai1", gardes: 30 });
    const deps = await depensesIdees();
    expect(deps).toHaveLength(1);
    expect(deps[0]!.lignes[0]!.nature).toBe("reel");
    expect((await reservationsIdees()).map((r) => r.statut)).toEqual(["consommee"]);
    // Jamais repayé : une seule création.
    expect(faux.appels.filter((a) => a.url === lots.URL_LOTS && a.methode === "POST")).toHaveLength(1);
  });

  it("un 504 de passerelle à la création n'est pas un refus net : la réservation est gardée", async () => {
    await allumer();
    faux.apresCreation = () => reponseErreur(504, "api_error", "Gateway timeout");
    expect(await comite.travaillerComite({ instant: Date.parse("2026-10-17T08:00:00Z") })).toMatchObject({ etat: "arrete" });
    expect((await reservationsIdees()).map((r) => r.statut)).toEqual(["active"]);
  });

  it("lot ENVOYÉ puis comité éteint et Claude retiré : suivi jusqu'à sa fin, dépense réelle enregistrée ; aucun nouvel envoi", async () => {
    await allumer();
    const t0 = Date.parse("2026-10-17T08:00:00Z");
    expect(await comite.travaillerComite({ instant: t0 })).toMatchObject({ etat: "envoye" });
    await ecrireParametre(comite.PARAM_COMITE, false);
    await ecrireParametre("fournisseur.script", "simulation");
    faux.lots.get("msgbatch_essai1")!.statut = "ended";
    const fin = await comite.travaillerComite({ instant: t0 + 10 * 60_000 });
    expect(fin).toMatchObject({ etat: "range", gardes: 30 });
    const deps = await depensesIdees();
    expect(deps).toHaveLength(1);
    expect(deps[0]!.lignes[0]!.nature).toBe("reel");
    expect((await reservationsIdees()).map((r) => r.statut)).toEqual(["consommee"]);
    // Lot fini : le comité éteint n'envoie plus rien.
    expect(await comite.travaillerComite({ instant: t0 + 30 * H })).toEqual({ etat: "eteint" });
    expect(faux.appels.filter((a) => a.methode === "POST")).toHaveLength(1);
  });

  it("lot INTROUVABLE chez Claude : abandonné, réservation rendue", async () => {
    await allumer();
    const t0 = Date.parse("2026-10-17T08:00:00Z");
    await comite.travaillerComite({ instant: t0 });
    faux.lots.clear();
    expect(await comite.travaillerComite({ instant: t0 + 10 * 60_000 })).toMatchObject({ etat: "arrete" });
    expect((await reservationsIdees()).map((r) => r.statut)).toEqual(["liberee"]);
    expect(await lireParametre(comite.PARAM_LOT_EN_COURS, null)).toBeNull();
  });

  it("PLAFOND des idées du mois (réglage `idees.plafondMoisUsd`, 5 $ par défaut) : au-delà, rien ne part", async () => {
    await allumer();
    expect(await comite.plafondIdeesMoisUsd()).toBe(5);
    await ecrireParametre(comite.PARAM_PLAFOND_IDEES, 0.05);
    const issue = await comite.travaillerComite({ instant: Date.parse("2026-10-17T08:00:00Z") });
    expect(issue).toMatchObject({ etat: "arrete" });
    expect(issue.etat === "arrete" ? issue.message : "").toMatch(/Plafond des idées du mois/);
    expect(faux.appels).toEqual([]);
    expect(await reservationsIdees()).toEqual([]);
  });

  const postsLots = () => faux.appels.filter((a) => a.url === lots.URL_LOTS && a.methode === "POST").length;

  // Un lot engage ≈ 26 cents de dollar (pire cas avec marge) : un repère de 0,15 $ est dépassé 1,7 fois, un repère de 0,02 $ plus de 5 fois.
  it("budget INDICATIF : plafond des idées dépassé (sous 5 ×) → le lot PART avec une alerte ; l'Usine reste bloquée", async () => {
    await allumer();
    await ecrireParametre("budget.mode", "indicatif");
    await ecrireParametre(comite.PARAM_PLAFOND_IDEES, 0.15);
    const usine = await comite.travaillerComite({ instant: Date.parse("2026-10-17T08:00:00Z"), origine: "usine" });
    expect(usine.etat === "arrete" ? usine.message : "").toMatch(/Plafond des idées du mois/);
    expect(postsLots()).toBe(0);
    const issue = await comite.travaillerComite({ instant: Date.parse("2026-10-18T08:00:00Z") });
    expect(issue.etat).not.toBe("arrete");
    expect(postsLots()).toBe(1);
    expect((await depots().notifications.lister()).filter((x) => x.type === "budget" && /Repère des idées/.test(x.titre))).toHaveLength(1);
  });

  it("budget INDICATIF : au-delà de 5 × le plafond des idées, arrêt de sécurité (rien n'est envoyé)", async () => {
    await allumer();
    await ecrireParametre("budget.mode", "indicatif");
    await ecrireParametre(comite.PARAM_PLAFOND_IDEES, 0.02);
    const issue = await comite.travaillerComite({ instant: Date.parse("2026-10-17T08:00:00Z") });
    expect(issue.etat === "arrete" ? issue.message : "").toMatch(/Arrêt de sécurité/);
    expect(postsLots()).toBe(0);
  });

  it("budget INDICATIF : la limite Claude du mois ne refuse plus le comité (alerte, le lot part)", async () => {
    await allumer();
    await ecrireParametre("budget.mode", "indicatif");
    await ecrireParametre("claude.plafondMensuelUsd", 0.01);
    const issue = await comite.travaillerComite({ instant: Date.parse("2026-10-17T08:00:00Z") });
    expect(issue.etat).not.toBe("arrete");
    expect(postsLots()).toBe(1);
    expect((await depots().notifications.lister()).filter((x) => x.type === "budget" && /Claude du mois/.test(x.titre))).toHaveLength(1);
  });

  it("limite Claude DU MOIS : au-delà, rien ne part", async () => {
    await allumer();
    await ecrireParametre("claude.plafondMensuelUsd", 0.01);
    expect(await comite.travaillerComite({ instant: Date.parse("2026-10-17T08:00:00Z") })).toMatchObject({ etat: "arrete", message: expect.stringMatching(/Limite Claude du mois/) });
    expect(faux.appels).toEqual([]);
  });

  it("une fois par jour au plus, et seulement si la réserve a moins de 10 idées « garder »", async () => {
    await allumer();
    faux.creation = () => reponseErreur(400, "invalid_request_error", "bad");
    const t0 = Date.parse("2026-10-17T08:00:00Z");
    await comite.travaillerComite({ instant: t0 });
    expect(await comite.travaillerComite({ instant: t0 + 2 * H })).toEqual({ etat: "deja-aujourd-hui" });
    for (let i = 0; i < 10; i++) {
      await depots().ideesJugees.enregistrer({ id: `ij-${i}`, signature: `s${i}`, idee: "x", textes: {}, notes: { douleur: 8, cible: 8, angleDifferent: 8, potentiel: 8 }, total: 32, verdict: "garder", raison: "r", angle: "a", date: new Date().toISOString(), source: "lot", creeLe: "", modifieLe: "" });
    }
    expect(await comite.travaillerComite({ instant: t0 + 30 * H })).toEqual({ etat: "reserve-suffisante" });
    await comite.marquerIdeeUtilisee("ij-0");
    expect(await comite.tailleReserve()).toBe(9);
  });
});

/* ------------------------------------------------------------------ */
/* 5. Repli à la demande                                                */
/* ------------------------------------------------------------------ */

describe("Comité · repli à la demande (prix plein, prix montré avant)", () => {
  it("prix montré avant ; un prix vu trop bas est refusé sans appel ; au bon prix : 20 idées jugées, dépense réelle", async () => {
    await allumer();
    const prix = await comite.prixJugementDirect();
    expect(prix.centimesEur).toBeGreaterThan(0);
    expect(prix.texte).toMatch(/au plus/);
    expect(await comite.jugerALaDemande(1)).toMatchObject({ ok: false, message: expect.stringMatching(/prix a changé/) });
    expect(faux.appels).toEqual([]);
    const r = await comite.jugerALaDemande(prix.centimesEur);
    expect(r).toMatchObject({ ok: true, gardes: 20, simule: false });
    expect(faux.appels.filter((a) => a.url === "https://api.anthropic.com/v1/messages")).toHaveLength(2);
    expect((await comite.listerIdeesJugees()).every((j) => j.source === "direct")).toBe(true);
    expect((await depensesIdees())[0]!.lignes[0]!.nature).toBe("reel");
    expect((await reservationsIdees())[0]!.statut).toBe("consommee");
  });

  it("refusé si la réserve n'est pas vide", async () => {
    await allumer();
    await depots().ideesJugees.enregistrer({ id: "ij-1", signature: "s", idee: "x", textes: {}, notes: { douleur: 8, cible: 8, angleDifferent: 8, potentiel: 8 }, total: 32, verdict: "garder", raison: "r", angle: "a", date: new Date().toISOString(), source: "lot", creeLe: "", modifieLe: "" });
    expect(await comite.jugerALaDemande(100_000)).toMatchObject({ ok: false, message: expect.stringMatching(/attendent déjà/) });
    expect(faux.appels).toEqual([]);
  });

  it("Claude non branché : simulation, 0 $, idées marquées « simulées » (hors réserve)", async () => {
    await allumer();
    // Aucune clé : Claude n'est pas branché.
    gc.injecterClaudePourEssai(null);
    const r = await comite.jugerALaDemande(0);
    expect(r).toMatchObject({ ok: true, simule: true, coutUsd: 0 });
    expect((await comite.listerIdeesJugees()).every((j) => j.simule)).toBe(true);
    expect(await comite.tailleReserve()).toBe(0);
    expect(await depensesIdees()).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* 6. L3-01 : l'origine suit le comité jusqu'à la garde d'argent         */
/* ------------------------------------------------------------------ */

describe("Comité · L3-01 : une commande de l'Usine passe par reserverPourUsine (origine transmise)", () => {
  const budgetUsine = async (cents: number) => {
    const { reglerBudgetUsine } = await import("@/services/budget-mensuel");
    const { moisParis } = await import("@/services/couts");
    await reglerBudgetUsine({ budget_mensuel_cents: cents, mois: moisParis() });
  };

  it("lot du jour commandé par l'Usine sans budget reçu : arrêté AVANT tout appel, rien n'est réservé ni engagé", async () => {
    await allumer();
    const r = await comite.travaillerComite({ instant: Date.parse("2026-10-17T08:00:00Z"), origine: "usine" });
    expect(r).toMatchObject({ etat: "arrete", message: expect.stringMatching(/Usine/) });
    expect(faux.appels).toEqual([]);
    expect(await reservationsIdees()).toEqual([]);
  });

  it("jugement à la demande commandé par l'Usine sans budget reçu : refusé AVANT tout appel ; avec le budget reçu : il part", async () => {
    await allumer();
    const prix = await comite.prixJugementDirect();
    expect(await comite.jugerALaDemande(prix.centimesEur, { origine: "usine" })).toMatchObject({ ok: false, message: expect.stringMatching(/Usine/) });
    expect(faux.appels).toEqual([]);
    expect(await reservationsIdees()).toEqual([]);
    await budgetUsine(10_000);
    expect(await comite.jugerALaDemande(prix.centimesEur, { origine: "usine" })).toMatchObject({ ok: true, simule: false });
    expect(faux.appels.length).toBeGreaterThan(0);
  });

  it("défaut inchangé : sans origine (la tâche de fond du studio), le lot part sans budget de l'Usine", async () => {
    await allumer();
    expect(await comite.travaillerComite({ instant: Date.parse("2026-10-17T08:00:00Z") })).toMatchObject({ etat: "envoye" });
  });
});
