/**
 * VÉRIFICATION E2E n° 2 — CAS LIMITES (04/10/2026).
 *
 * Six familles de cas limites, chacune prouvée par le code réel (services et fournisseurs), sans AUCUN appel réseau :
 * `fetch` est remplacé par des doublures (Buffer : `helpers/r1-buffer.ts` ; Claude : `helpers/g0.ts` ; HeyGen, fal :
 * doublures locales ci-dessous). Aucune clé réelle.
 *
 *  1. Quotas Buffer (HTTP 429, `LimitReachedError`, limite au niveau GraphQL) ;
 *  2. Crédits HeyGen à 0 (solde lu nul, réponse « crédit insuffisant » pendant la fabrication) ;
 *  3. Claude en surcharge (529 `overloaded_error`, 429 `rate_limit_error`) ;
 *  4. Réseau coupé (TypeError « fetch failed », ECONNRESET, délai) pour Claude, HeyGen, Buffer et fal.ai ;
 *  5. Double clic (deux appels simultanés de la même action) ;
 *  6. Deux onglets (modifications concurrentes de la même entité).
 *
 * Les tests qui RÉVÈLENT un défaut sont marqués `it.fails` avec un commentaire « DÉFAUT : … » : la suite reste verte
 * tant que le défaut existe, et rougit le jour où il est corrigé (il suffira alors de retirer `.fails`).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { exemplesCommeVraies } from "./helpers/videos-reelles";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseErreur, reponseFlux } from "./helpers/g0";
import { CANAUX, fauxBuffer, type Comportement } from "./helpers/r1-buffer";
import type { GenerationScript, Travail, Video } from "@/domaine/types";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

/*
 * Buffer RÉEL (doublure) et stockage R2 signé en local : le registre des fournisseurs lit ces variables À L'IMPORT, elles
 * sont donc posées avant les imports (comme `r1-envoi-reel.test.ts`). Aucune clé réelle, aucun appel.
 */
const CLE_BUFFER = "cle-buffer-de-test-verif2-limites-0a1b";
Object.assign(process.env, {
  BUFFER_API_KEY: CLE_BUFFER,
  FOURNISSEUR_PUBLICATION: "buffer",
  R2_ACCOUNT_ID: "compte-essai",
  R2_ACCESS_KEY_ID: "ACCES-ESSAI",
  R2_SECRET_ACCESS_KEY: "secret-essai",
  R2_BUCKET: "seau-essai",
  FOURNISSEUR_STOCKAGE: "r2",
});

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const pub = await import("@/services/publications");
const fabrication = await import("@/services/fabrication");
const travaux = await import("@/services/travaux");
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { creerLecteurHeygen } = await import("@/fournisseurs/credits/heygen");
const { creerClientHeygen, erreurDepuisReponse } = await import("@/fournisseurs/heygen/client");
const { creerRendusHeygen } = await import("@/fournisseurs/heygen/rendus");
const { creerFabricationFal } = await import("@/fournisseurs/illustration/fal");
const { creerPublicationBuffer, ErreurBuffer, PHRASES_BUFFER } = await import("@/fournisseurs/publication/buffer");
const { roleSonde } = await import("@/generateur/roles/sonde");

const MDP = "e2e-verif2-limites";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  reinitialiserDepots();
  // CORRECTEUR FINAL A : une vidéo d'exemple, une version d'essai ou un fichier /demo/ ne part jamais chez Buffer
  // (« C'est une vidéo d'exemple »). La vidéo des envois Buffer de ce test reçoit donc ce que laisse une vraie
  // fabrication (vrai moteur dans la version, fichier sur le stockage du studio, `estDemo: false`). La règle ne change pas.
  await exemplesCommeVraies(depots(), { videos: [VIDEO_BUFFER], plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
});

/* ================================================================== */
/* Outils communs                                                       */
/* ================================================================== */

/** Un `fetch` qui ne doit JAMAIS être appelé (lecteur de solde Claude : solde suivi, aucun appel). */
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

/** Une coupure réseau telle que Node la lève (undici) : TypeError « fetch failed », cause ECONNRESET. */
function coupureEconnreset(): TypeError {
  return Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }) });
}

/** Les mots qui ne doivent jamais arriver sous les yeux de Will (jargon, anglais brut, codes HTTP). */
function lisibleEnFrancais(message: string): void {
  expect(message).toMatch(/[a-zàâçéèêëîïôûùüÿ]/i);
  expect(message).not.toMatch(/\b(429|529|5\d\d|ECONNRESET|fetch failed|overloaded|rate.?limit|Too Many Requests|TypeError|undefined)\b/i);
}

/** Attente courte (simule la latence d'une écriture en base). */
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ================================================================== */
/* 1. QUOTAS BUFFER                                                     */
/* ================================================================== */

const VIDEO_BUFFER = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();

function brancherBuffer(options: Parameters<typeof fauxBuffer>[0] = {}) {
  const b = fauxBuffer(options);
  vi.stubGlobal("fetch", b.appeler);
  return b;
}
const suite =
  (...c: Comportement[]) =>
  (n: number) =>
    c[n - 1] ?? "ok";

async function cocherTout(videoId = VIDEO_BUFFER) {
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(videoId, c, true);
}

async function publicationsInstagram() {
  return depots().publications.lister((x) => x.videoId === VIDEO_BUFFER && x.reseau === "instagram" && x.via === "buffer");
}

describe("1 · Quotas Buffer", () => {

  it("HTTP 429 à l'envoi : phrase française, publication « refusée » (jamais « envoyée »), aucun renvoi automatique", async () => {
    const buffer = brancherBuffer({ creation: suite({ http: 429 }) });
    await cocherTout();
    const e = await pub.envoyerVersBuffer(VIDEO_BUFFER, ["instagram"], DEMAIN).catch((x: Error & { code?: string }) => x);
    expect(e).toMatchObject({ code: "BUFFER_REFUSE", message: PHRASES_BUFFER.limite });
    lisibleEnFrancais((e as Error).message);
    // UNE seule tentative : le studio ne réessaie pas tout seul derrière un 429.
    expect(buffer.mutations()).toHaveLength(1);
    const [p] = await publicationsInstagram();
    expect(p).toMatchObject({ etatEnvoi: "refuse", statut: "echec", erreur: PHRASES_BUFFER.limite });
    expect(p.idExterne).toBeUndefined();
    // La vidéo n'est PAS passée « programmée ».
    expect((await depots().videos.obtenir(VIDEO_BUFFER))?.etapeEditoriale).not.toBe("programmee");
  });

  it("limite levée : Will renvoie, UN nouvel envoi part (le refus n'occupe pas le compte), pas deux", async () => {
    const buffer = brancherBuffer({ creation: suite({ http: 429 }, "ok") });
    await cocherTout();
    await pub.envoyerVersBuffer(VIDEO_BUFFER, ["instagram"], DEMAIN).catch(() => undefined);
    const r = await pub.envoyerVersBuffer(VIDEO_BUFFER, ["instagram"], DEMAIN);
    expect(buffer.mutations()).toHaveLength(2);
    expect(r.publications).toHaveLength(1);
    expect(r.publications[0]).toMatchObject({ etatEnvoi: "envoye", via: "buffer" });
    // Une troisième touche ne renvoie rien : la publication envoyée est rendue telle quelle.
    await pub.envoyerVersBuffer(VIDEO_BUFFER, ["instagram"], DEMAIN);
    expect(buffer.mutations()).toHaveLength(2);
    const pubs = await publicationsInstagram();
    expect(pubs.filter((x) => x.etatEnvoi === "envoye")).toHaveLength(1);
    expect(pubs.filter((x) => x.etatEnvoi === "refuse")).toHaveLength(1);
  });

  it("quota du compte atteint (`LimitReachedError`, publications programmées) : phrase dédiée, « refusée », rien d'incertain", async () => {
    const buffer = brancherBuffer({ creation: suite({ union: "LimitReachedError", message: "You have reached the limit of scheduled posts for this channel" }) });
    await cocherTout();
    const e = await pub.envoyerVersBuffer(VIDEO_BUFFER, ["instagram"], DEMAIN).catch((x: Error & { code?: string }) => x);
    expect(e).toMatchObject({ code: "BUFFER_REFUSE", message: PHRASES_BUFFER.limiteCompte });
    lisibleEnFrancais((e as Error).message);
    // Le message anglais de Buffer ne remonte jamais à l'écran.
    expect((e as Error).message).not.toMatch(/scheduled posts/i);
    expect(buffer.mutations()).toHaveLength(1);
    const [p] = await publicationsInstagram();
    expect(p).toMatchObject({ etatEnvoi: "refuse", statut: "echec" });
  });

  it("limite exprimée DANS la réponse GraphQL (HTTP 200 + `errors`) : prudence, « à vérifier », jamais renvoyée à l'aveugle", async () => {
    // Forme non confirmée chez Buffer (aucun relevé) : on vérifie seulement que l'état reste SÛR (pas de double envoi).
    const json = (c: unknown) => new Response(JSON.stringify(c), { status: 200, headers: { "content-type": "application/json" } });
    const f = vi.fn(async () => json({ data: null, errors: [{ message: "Rate limit reached", extensions: { code: "RATE_LIMIT_EXCEEDED" } }] }));
    const service = creerPublicationBuffer(CLE_BUFFER, { appeler: f as unknown as typeof fetch });
    const e = await service.envoyer({ reseau: "instagram", texte: "t", date: DEMAIN, fichierCle: "https://r2.exemple/v.mp4", canalId: CANAUX.instagram }).catch((x) => x);
    expect(e).toBeInstanceOf(ErreurBuffer);
    expect(e).toMatchObject({ incertain: true, message: PHRASES_BUFFER.incomprehensibleEnvoi });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("429 pendant la RELECTURE d'un envoi à vérifier : rien n'est renvoyé, l'état reste « à vérifier »", async () => {
    // 1er envoi : Buffer crée puis la réponse se perd ; ensuite toutes ses lectures répondent 429.
    const buffer = brancherBuffer({ creation: suite("coupure-apres") });
    await cocherTout();
    await pub.envoyerVersBuffer(VIDEO_BUFFER, ["instagram"], DEMAIN);
    const base = buffer.appeler;
    vi.stubGlobal("fetch", (async (url: string, init?: RequestInit) => {
      const op = /^\s*(?:query|mutation)\s+(\w+)/.exec(JSON.parse(String(init?.body ?? "{}")).query ?? "")?.[1];
      if (op === "PublicationsRecentes") return new Response("", { status: 429 });
      return base(url, init);
    }) as typeof fetch);
    const e = await pub.envoyerVersBuffer(VIDEO_BUFFER, ["instagram"], DEMAIN).catch((x: Error & { code?: string }) => x);
    expect(e).toMatchObject({ code: "ENVOI_A_VERIFIER" });
    lisibleEnFrancais((e as Error).message);
    expect(buffer.mutations()).toHaveLength(1);
    expect((await publicationsInstagram())[0]).toMatchObject({ etatEnvoi: "a-verifier" });
  });
});

/* ================================================================== */
/* 2. CRÉDITS HEYGEN À 0                                                */
/* ================================================================== */

/** Faux HeyGen : `GET /v3/users/me` répond le solde donné ; toute autre requête est notée (et refusée). */
function heygenAuSolde(dollars: number) {
  const appels: { methode: string; url: string }[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    appels.push({ methode: init?.method ?? "GET", url: String(url) });
    if (String(url).endsWith("/v3/users/me")) return Response.json({ data: { billing_type: "wallet", wallet: { currency: "USD", remaining_balance: dollars } } });
    return Response.json({ error: { code: "unexpected", message: "appel non prévu" } }, { status: 400 });
  }) as typeof fetch;
  return { fetch: f, appels };
}

describe("2 · Crédits HeyGen à 0", () => {
  async function voixHeygen() {
    for (const v of await depots().voix.lister()) await depots().voix.modifier(v.id, { fournisseur: "heygen" });
  }
  const actifs = (videoId: string) => depots().travaux.compter((t) => t.cibleId === videoId && (t.statut === "en_cours" || t.statut === "en_file"));

  it("solde HeyGen lu à 0 $ : la fabrication est refusée AVANT toute dépense, message clair, rien de réservé", async () => {
    const hg = heygenAuSolde(0);
    credits.injecterLecteursPourEssai([creerLecteurHeygen({ HEYGEN_API_KEY: "cle-heygen-essai" }, hg.fetch)], ["heygen"]);
    await voixHeygen();
    const avant = await actifs("v-03");
    const e = await fabrication.lancerFabrication("v-03", { confirme: true }).catch((x: Error & { code?: string }) => x);
    expect(e).toMatchObject({ code: "CREDIT_INSUFFISANT" });
    expect((e as Error).message).toMatch(/^Crédit HeyGen insuffisant : il reste 0,00\s?\$/);
    lisibleEnFrancais((e as Error).message);
    // Seule la LECTURE (gratuite) du solde est partie ; aucun POST payant.
    expect(hg.appels.every((a) => a.methode === "GET" && a.url.endsWith("/v3/users/me"))).toBe(true);
    expect(await actifs("v-03")).toBe(avant);
    expect(await depots().reservations.compter((r) => r.videoId === "v-03")).toBe(0);
  });

  it("double clic à 0 $ : deux refus, aucun travail, aucune réservation", async () => {
    const hg = heygenAuSolde(0);
    credits.injecterLecteursPourEssai([creerLecteurHeygen({ HEYGEN_API_KEY: "cle-heygen-essai" }, hg.fetch)], ["heygen"]);
    await voixHeygen();
    const avant = await actifs("v-03");
    const r = await Promise.allSettled([fabrication.lancerFabrication("v-03", { confirme: true }), fabrication.lancerFabrication("v-03", { confirme: true })]);
    expect(r.map((x) => x.status)).toEqual(["rejected", "rejected"]);
    expect(await actifs("v-03")).toBe(avant);
    expect(await depots().reservations.compter((x) => x.videoId === "v-03")).toBe(0);
  });

  it("HeyGen répond « crédit insuffisant » (402, ou 200 avec `error` objet) : erreur `quota` non réessayable, phrase française", async () => {
    const cas = [
      { status: 402, corps: { error: { code: "insufficient_credit", message: "Insufficient credit" } } },
      { status: 200, corps: { error: { code: "wallet_balance_insufficient", message: "Your wallet balance is not enough" } } },
      { status: 400, corps: { error: "Insufficient credits" } },
    ];
    for (const c of cas) {
      const client = creerClientHeygen({ cle: "cle-heygen-essai", fetch: (async () => Response.json(c.corps, { status: c.status })) as typeof fetch });
      const e = (await client.requete("POST", "/v3/videos", {}).catch((x: unknown) => x)) as { erreur: unknown; message: string };
      expect(e.erreur).toMatchObject({ code: "quota", reessayable: false });
      expect(credits.estCreditInsuffisant(e)).toBe(true);
      lisibleEnFrancais(e.message);
      expect(e.message).toMatch(/crédits HeyGen sont épuisés/);
    }
  });

  it("crédit épuisé PENDANT la fabrication : « en attente de crédit », prochain essai dans 1 h, UNE notification, pas de boucle", async () => {
    const le = new Date().toISOString();
    const t: Travail = { id: "trav-verif2", type: "fabrication", cibleId: "v-03", versionId: "ver-verif2", titre: "Essai", etapes: [], statut: "en_cours", progression: 10, tentatives: 0, cleIdempotence: "k", fournisseurUtilise: "heygen", creeLe: le, modifieLe: le };
    await depots().travaux.enregistrer(t);
    const lu = { travail: t, commande: {} as never, moteur: {} as never };
    const instant = Date.now();
    expect(await travaux.ecrirePanne(lu, erreurDepuisReponse(402, null), instant)).toEqual({ ecrit: true });
    const apres = (await depots().travaux.obtenir(t.id))!;
    expect(apres.statut).toBe("en_cours");
    expect(apres.reprise).toMatchObject({ motif: "credit", fournisseurCredit: "heygen", echecs: 1 });
    expect(Date.parse(apres.reprise!.prochainEssai) - instant).toBe(credits.RELANCE_ATTENTE_CREDIT_MS);
    const notifs = async () => (await depots().notifications.lister()).filter((n) => /Crédit HeyGen épuisé/.test(n.titre)).length;
    expect(await notifs()).toBe(1);
    // Nouvel essai gratuit une heure plus tard, encore refusé : toujours en attente, pas de seconde notification.
    await travaux.ecrirePanne({ ...lu, travail: apres }, erreurDepuisReponse(402, null), instant + credits.RELANCE_ATTENTE_CREDIT_MS);
    const encore = (await depots().travaux.obtenir(t.id))!;
    expect(encore.statut).toBe("en_cours");
    expect(encore.reprise).toMatchObject({ motif: "credit", echecs: 2 });
    expect(await notifs()).toBe(1);
  });
});

/* ================================================================== */
/* 3. CLAUDE EN SURCHARGE                                               */
/* ================================================================== */

let nGen = 0;
async function nouvelleGeneration(): Promise<GenerationScript> {
  const le = new Date().toISOString();
  const g: GenerationScript = { id: `gen-v2-${++nGen}`, scriptMaitreId: `suj-v2-${nGen}`, hachageContexte: "h", plafondUsd: 1.5, portee: "sujet", etapes: [], statut: "en-cours", creeLe: le, modifieLe: le };
  await depots().generations.enregistrer(g);
  return g;
}
const entreeSonde = { contexte: { contexteAxion: "Axion-IA : formations IA pour dirigeants." }, variable: "<brief>Les PV de stationnement</brief>" };

async function brancherClaudeEcriture(reponses: (() => Response | Promise<Response>)[]) {
  await ecrireParametre("fournisseur.script", "claude");
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await credits.declarerRecharge("anthropic", 500);
  let n = 0;
  const f = vi.fn(async () => reponses[Math.min(n++, reponses.length - 1)]());
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f as unknown as typeof fetch, attenteMs: () => 0 });
  return f;
}
const reservationsAppel = () => depots().reservations.lister((r) => (r.travailId ?? "").startsWith("appel"));
const depensesClaude = async () => (await depots().depenses.lister()).filter((d) => d.lignes.some((l) => l.fournisseur === "anthropic"));

/** Matières et preuves du banc G4 (un sujet écrivable de bout en bout, en essai). */
async function preparerBanc() {
  const bg = await import("@/services/boucle-generation");
  bg.suspendreBoucleGeneration(true);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
}
async function lancerSujetBanc(i: number) {
  const bg = await import("@/services/boucle-generation");
  const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");
  return bg.lancerGeneration({ idee: SUJETS_BANC[i].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[i].pilier.id, mode: "avatar" as const });
}

describe("3 · Claude en surcharge", () => {
  it("529 `overloaded_error` à chaque essai : 3 essais au plus, aucune dépense, réservation rendue, message français", async () => {
    const f = await brancherClaudeEcriture([() => reponseErreur(529, "overloaded_error", "Overloaded")]);
    const g = await nouvelleGeneration();
    const e = await gc.executerRoleFacture(g.id, roleSonde, entreeSonde).catch((x) => x);
    expect(e).toMatchObject({ code: "CLAUDE_INDISPONIBLE" });
    lisibleEnFrancais(e.message);
    expect(f).toHaveBeenCalledTimes(gc.ESSAIS_SURCHARGE);
    expect(await depensesClaude()).toHaveLength(0);
    const res = await reservationsAppel();
    expect(res).toHaveLength(1);
    expect(res[0].statut).toBe("liberee");
    // L'étape est close (« rejetée ») : rien ne reste « lancé » sans fin.
    const etape = (await depots().generations.obtenir(g.id))!.etapes.at(-1)!;
    expect(etape).toMatchObject({ resultat: "rejete" });
    expect(etape.termineLe).toBeTruthy();
  });

  it("429 `rate_limit_error` puis succès : UNE dépense (la réponse réussie), jamais deux", async () => {
    const f = await brancherClaudeEcriture([() => reponseErreur(429, "rate_limit_error", "Number of request tokens has exceeded your per-minute rate limit"), () => reponseFlux(fluxReussi({ texte: "ok" }))]);
    const g = await nouvelleGeneration();
    const r = await gc.executerRoleFacture(g.id, roleSonde, entreeSonde);
    expect(r.ok).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
    expect(await depensesClaude()).toHaveLength(1);
    expect((await reservationsAppel()).map((x) => x.statut)).toEqual(["consommee"]);
  });

  it("surcharge annoncée DANS le flux (événement `error` overloaded) : traitée comme une surcharge, réessai borné", async () => {
    const fluxSurcharge = () => reponseFlux([["error", { type: "error", error: { type: "overloaded_error", message: "Overloaded" } }]]);
    const f = await brancherClaudeEcriture([fluxSurcharge]);
    const g = await nouvelleGeneration();
    const e = await gc.executerRoleFacture(g.id, roleSonde, entreeSonde).catch((x) => x);
    expect(e).toMatchObject({ code: "CLAUDE_INDISPONIBLE" });
    expect(f).toHaveBeenCalledTimes(gc.ESSAIS_SURCHARGE);
    expect(await depensesClaude()).toHaveLength(0);
  });

  it("la génération n'est jamais laissée « en-cours » à vie : 3 tours en panne l'arrêtent (« échec »), Will est prévenu", async () => {
    const bg = await import("@/services/boucle-generation");
    const { ErreurStudio } = await import("@/services/_commun");
    await preparerBanc();
    const r = await lancerSujetBanc(0);
    if (!r.ok) throw new Error("lancement");
    const enPanne = () => ({
      executer: async () => {
        throw new ErreurStudio("CLAUDE_INDISPONIBLE", "Claude ne répond pas pour l'instant : l'écriture reprendra toute seule.");
      },
    });
    // Un tour par essai ; entre deux tours, l'attente programmée est déclarée échue (au lieu d'attendre 1 min).
    for (let i = 0; i < bg.PANNES_AVANT_ARRET; i++) {
      const p = await bg.lirePanneEcriture(r.generationId);
      if (p) await ecrireParametre(`generateur.panne.${r.generationId}`, { ...p, prochainEssai: new Date(0).toISOString() });
      await bg.tourBoucleGeneration(enPanne as never);
    }
    expect((await depots().generations.obtenir(r.generationId))!.statut).toBe("echec");
    const panne = (await bg.lirePanneEcriture(r.generationId))!;
    expect(panne).toMatchObject({ arretee: true, essais: bg.PANNES_AVANT_ARRET });
    lisibleEnFrancais(panne.message);
    expect((await depots().notifications.lister()).some((n) => n.titre === "Une écriture s'est arrêtée")).toBe(true);
    // Plus aucun tour ne la reprend sans geste de Will.
    expect(await bg.tourBoucleGeneration(enPanne as never)).toBeNull();
  });
});

/* ================================================================== */
/* 4. RÉSEAU COUPÉ                                                      */
/* ================================================================== */

describe("4 · Réseau coupé", () => {
  it("Claude : ECONNRESET avant la réponse → message français, réservation GARDÉE (a pu être facturée), génération récupérable", async () => {
    const f = await brancherClaudeEcriture([
      () => {
        throw coupureEconnreset();
      },
    ]);
    const g = await nouvelleGeneration();
    const e = await gc.executerRoleFacture(g.id, roleSonde, entreeSonde).catch((x) => x);
    expect(e).toMatchObject({ code: "CLAUDE_INDISPONIBLE" });
    lisibleEnFrancais(e.message);
    // Une coupure n'est PAS une surcharge : un seul envoi (pas de rafale de renvois facturables).
    expect(f).toHaveBeenCalledTimes(1);
    expect((await reservationsAppel()).map((r) => r.statut)).toEqual(["active"]);
    // L'écriture reste reprenable par la boucle (ni « échec » d'office, ni perdue).
    expect((await depots().generations.obtenir(g.id))!.statut).toBe("en-cours");
  });

  it("Claude : flux coupé au milieu (ECONNRESET pendant la lecture) → même règle, aucune dépense inventée", async () => {
    const fluxCoupe = () => {
      const morceau = new TextEncoder().encode(`event: message_start\ndata: ${JSON.stringify({ type: "message_start", message: { id: "m", model: "claude-opus-5-5", usage: { input_tokens: 10, output_tokens: 1 } } })}\n\n`);
      let envoye = false;
      const flux = new ReadableStream<Uint8Array>({
        pull(c) {
          if (!envoye) {
            envoye = true;
            c.enqueue(morceau);
          } else c.error(coupureEconnreset());
        },
      });
      return new Response(flux, { status: 200, headers: { "content-type": "text/event-stream" } });
    };
    const f = await brancherClaudeEcriture([fluxCoupe]);
    const g = await nouvelleGeneration();
    const e = await gc.executerRoleFacture(g.id, roleSonde, entreeSonde).catch((x) => x);
    expect(e).toMatchObject({ code: "CLAUDE_INDISPONIBLE" });
    expect(f).toHaveBeenCalledTimes(1);
    expect(await depensesClaude()).toHaveLength(0);
    expect((await reservationsAppel()).map((r) => r.statut)).toEqual(["active"]);
  });

  it("HeyGen : coupure à la création d'un rendu → « indisponible » réessayable, et le nouvel essai porte la MÊME clé d'idempotence", async () => {
    const cles: (string | null)[] = [];
    let n = 0;
    const f = (async (_url: string | URL | Request, init?: RequestInit) => {
      cles.push(new Headers(init?.headers).get("idempotency-key"));
      if (n++ === 0) throw coupureEconnreset();
      return Response.json({ data: { video_id: "vid-123", status: "pending" } });
    }) as typeof fetch;
    const rendus = creerRendusHeygen(creerClientHeygen({ cle: "cle-heygen-essai", fetch: f }));
    const demande = { lookId: "look-1", audioUrl: "https://r2.exemple/son.mp3", titre: "Essai", cleIdempotence: "rendu-v03-1" };
    const e = await rendus.creer(demande).catch((x) => x);
    expect(e.erreur).toMatchObject({ code: "indisponible", reessayable: true });
    expect(e.message).toBe("HeyGen ne répond pas (réseau).");
    expect(credits.estCreditInsuffisant(e)).toBe(false);
    expect(await rendus.creer(demande)).toEqual({ videoId: "vid-123" });
    expect(cles).toEqual(["rendu-v03-1", "rendu-v03-1"]);
  });

  it("HeyGen : panne réseau pendant la fabrication → nouvel essai programmé, le travail reste en cours (récupérable)", async () => {
    const le = new Date().toISOString();
    const t: Travail = { id: "trav-reseau", type: "fabrication", cibleId: "v-03", versionId: "ver-r", titre: "Essai", etapes: [], statut: "en_cours", progression: 10, tentatives: 0, cleIdempotence: "k", fournisseurUtilise: "heygen", creeLe: le, modifieLe: le };
    await depots().travaux.enregistrer(t);
    const client = creerClientHeygen({ cle: "k", fetch: (async () => {
      throw coupureEconnreset();
    }) as typeof fetch });
    const err = await client.requete("GET", "/v3/videos/x").catch((x) => x);
    await travaux.ecrirePanne({ travail: t, commande: {} as never, moteur: {} as never }, err);
    const apres = (await depots().travaux.obtenir(t.id))!;
    expect(apres.statut).toBe("en_cours");
    expect(apres.reprise).toMatchObject({ echecs: 1 });
    expect(apres.reprise?.motif).not.toBe("credit");
    expect(Date.parse(apres.reprise!.prochainEssai)).toBeGreaterThan(Date.now() - 1000);
  });

  describe("Buffer", () => {
    it("coupure (TypeError « fetch failed ») pendant l'envoi → « à vérifier », phrase française, aucun second envoi à la retouche", async () => {
      const buffer = brancherBuffer();
      await cocherTout();
      const base = buffer.appeler;
      let coupe = true;
      vi.stubGlobal("fetch", (async (url: string, init?: RequestInit) => {
        const op = /^\s*(?:query|mutation)\s+(\w+)/.exec(JSON.parse(String(init?.body ?? "{}")).query ?? "")?.[1];
        if (op === "CreerPublication" && coupe) {
          coupe = false;
          buffer.appels.push({ operation: op, variables: {}, query: "", autorisation: null });
          throw coupureEconnreset();
        }
        return base(url, init);
      }) as typeof fetch);
      const r = await pub.envoyerVersBuffer(VIDEO_BUFFER, ["instagram"], DEMAIN);
      expect(r.publications[0]).toMatchObject({ etatEnvoi: "a-verifier" });
      expect(r.problemes?.[0]).toMatchObject({ code: "ENVOI_A_VERIFIER" });
      lisibleEnFrancais(r.problemes![0].message);
      // Retouche immédiate : Buffer relu (rien trouvé, trop tôt pour conclure) → aucun renvoi.
      await expect(pub.envoyerVersBuffer(VIDEO_BUFFER, ["instagram"], DEMAIN)).rejects.toMatchObject({ code: "ENVOI_A_VERIFIER" });
      expect(buffer.mutations()).toHaveLength(1);
    });
  });

  it("fal.ai : coupure à la soumission → « incertaine » (jamais resoumise à l'aveugle), phrase française", async () => {
    vi.stubGlobal("fetch", async () => {
      throw coupureEconnreset();
    });
    const fal = creerFabricationFal({ cle: "k", deposer: async (_c, cle) => cle });
    const e = await fal.soumettre({ genre: "image", requete: "a contract on a desk", ratio: "9:16", cleIdempotence: "b" }).catch((x) => x);
    expect(e).toMatchObject({ soumissionIncertaine: true, message: "fal.ai n'a pas confirmé la demande." });
    expect(e.erreur).toMatchObject({ code: "indisponible", reessayable: true });
    lisibleEnFrancais(e.message);
  });

  it("fal.ai : 429 à la soumission → refus NET (rien n'a été pris), réessayable, pas « incertain »", async () => {
    vi.stubGlobal("fetch", async () => new Response("Too Many Requests", { status: 429 }));
    const fal = creerFabricationFal({ cle: "k", deposer: async (_c, cle) => cle });
    const e = await fal.soumettre({ genre: "image", requete: "a contract on a desk", ratio: "9:16", cleIdempotence: "b" }).catch((x) => x);
    expect(e.soumissionIncertaine).toBeUndefined();
    expect(e.erreur).toMatchObject({ code: "indisponible", reessayable: true });
    lisibleEnFrancais(e.message);
  });

  it("fal.ai : délai dépassé pendant le suivi → « indisponible » réessayable (la demande gardée sera relue, pas repayée)", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    const fal = creerFabricationFal({ cle: "k", deposer: async (_c, cle) => cle });
    const id = JSON.stringify({ genre: "image", statut: "https://queue.fal.run/x/status", reponse: "https://queue.fal.run/x", cle: "b" });
    const e = await fal.suivre(id).catch((x) => x);
    expect(e.erreur).toMatchObject({ code: "indisponible", reessayable: true });
    expect(e.message).toBe("fal.ai ne répond pas.");
  });
});

/* ================================================================== */
/* 5. DOUBLE CLIC                                                       */
/* ================================================================== */

/** Claude CHOISI pour les textes de publication ; chaque appel est compté. */
async function brancherClaudeTextes(delaiMs = 40) {
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await ecrireParametre("fournisseur.texte-reseaux", "claude");
  await credits.declarerRecharge("anthropic", 500);
  const appels: number[] = [];
  const f = (async () => {
    appels.push(Date.now());
    await pause(delaiMs);
    const texte = "Ce que coûtent vraiment les outils d'équipe.\n\nLe point en une minute, sans jargon.";
    const sortie = { premiereLigne: texte.split("\n")[0], texte, motsDiese: ["#PME", "#Teletravail"], justifications: [] };
    return reponseFlux(fluxReussi({ texte: JSON.stringify(sortie), modele: "claude-sonnet-5-5" }));
  }) as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
  return appels;
}

/** Une vraie vidéo prête (copie de la démo v-04, hors exemples). */
async function videoPrete(id = "v-verif2"): Promise<Video> {
  const modele = (await depots().videos.obtenir("v-04"))!;
  const v: Video = { ...modele, id, estDemo: false, titre: "Télétravail : quels outils pour l'équipe ?" };
  await depots().videos.enregistrer(v);
  return v;
}

describe("5 · Double clic", () => {
  it("« Fabriquer » touché deux fois : un seul travail, une seule réservation", async () => {
    const hg = heygenAuSolde(10_000);
    credits.injecterLecteursPourEssai([creerLecteurHeygen({ HEYGEN_API_KEY: "cle-heygen-essai" }, hg.fetch)], ["heygen"]);
    for (const v of await depots().voix.lister()) await depots().voix.modifier(v.id, { fournisseur: "heygen" });
    const [a, b] = await Promise.all([fabrication.lancerFabrication("v-03", { confirme: true }), fabrication.lancerFabrication("v-03", { confirme: true })]);
    expect(a.travailId).toBe(b.travailId);
    expect(await depots().reservations.compter((x) => x.statut === "active" && x.videoId === "v-03")).toBe(1);
  });

  describe("« Envoyer vers Buffer »", () => {
    it("touché deux fois pendant un envoi lent : UN seul message dans Buffer, le second dit « déjà en cours »", async () => {
      const buffer = brancherBuffer({ delaiMutationMs: 40 });
      await cocherTout();
      const r = await Promise.allSettled([pub.envoyerVersBuffer(VIDEO_BUFFER, ["instagram"], DEMAIN), pub.envoyerVersBuffer(VIDEO_BUFFER, ["instagram"], DEMAIN)]);
      expect(buffer.mutations()).toHaveLength(1);
      expect(r.map((x) => x.status).sort()).toEqual(["fulfilled", "rejected"]);
      const refus = r.find((x) => x.status === "rejected") as PromiseRejectedResult;
      expect(refus.reason).toMatchObject({ code: "ENVOI_EN_COURS" });
      lisibleEnFrancais(refus.reason.message);
    });
  });

  it("« Écrire » (relancer l'écriture d'un même sujet) touché deux fois : une seule écriture", async () => {
    const bg = await import("@/services/boucle-generation");
    await preparerBanc();
    const r = await lancerSujetBanc(0);
    if (!r.ok) throw new Error("lancement");
    const [a, b] = await Promise.all([bg.lancerGeneration({ scriptMaitreId: r.scriptMaitreId }), bg.lancerGeneration({ scriptMaitreId: r.scriptMaitreId })]);
    expect(a).toMatchObject({ ok: true, generationId: r.generationId });
    expect(b).toMatchObject({ ok: true, generationId: r.generationId });
    expect(await depots().generations.compter((g) => g.scriptMaitreId === r.scriptMaitreId)).toBe(1);
  });

  // ANCIEN DÉFAUT : « Réécrire ce texte » (src/services/publications.ts, `regenererTexteKit`) n'avait aucun verrou autour
  // de l'appel Claude. Dans un même onglet le bouton est bloqué pendant l'écriture (`chargement`), mais deux onglets (ou
  // une page rechargée pendant l'écriture) envoyaient deux demandes : TOUTES LES DEUX partaient chez Claude et étaient
  // payées, le second texte était jeté (`poserSiInchange` → TEXTE_MODIFIE).
  // CORRIGÉ : une marque « réécriture en cours » par réseau est posée EN BASE dans le kit (`reecrituresEnCours`), sous
  // le verrou du kit, avant l'appel. Le second toucher est refusé avec une phrase simple, AVANT tout appel : rien de payé.
  it("CORRIGÉ — « Réécrire ce texte » touché deux fois : un seul appel Claude payé", async () => {
    const appels = await brancherClaudeTextes(40);
    const v = await videoPrete();
    await pub.obtenirKit(v.id);
    const r = await Promise.allSettled([pub.regenererTexteKit(v.id, "linkedin"), pub.regenererTexteKit(v.id, "linkedin")]);
    // L'un passe ; l'autre est refusé AVANT d'appeler Claude, avec une phrase simple.
    expect(r.map((x) => x.status).sort()).toEqual(["fulfilled", "rejected"]);
    const refus = (r.find((x) => x.status === "rejected") as PromiseRejectedResult).reason;
    expect(refus).toMatchObject({ code: "REECRITURE_EN_COURS" });
    lisibleEnFrancais(refus.message);
    // Un seul appel payé.
    expect(appels).toHaveLength(1);
    expect((await depots().depenses.lister((d) => d.videoId === v.id)).length).toBe(1);
    // La marque est retirée après l'écriture : un nouveau « Réécrire » plus tard repart normalement (un second appel).
    expect((await depots().kits.trouver((k) => k.videoId === v.id))!.reecrituresEnCours?.linkedin).toBeUndefined();
    await pub.regenererTexteKit(v.id, "linkedin");
    expect(appels).toHaveLength(2);
  });

  it("CORRIGÉ — une marque « réécriture en cours » abandonnée (studio arrêté pendant l'écriture) ne bloque pas pour toujours", async () => {
    const appels = await brancherClaudeTextes(0);
    const v = await videoPrete();
    await pub.obtenirKit(v.id);
    const k = (await depots().kits.trouver((x) => x.videoId === v.id))!;
    // Marque toute fraîche : refus, aucun appel.
    await depots().kits.modifier(k.id, { reecrituresEnCours: { linkedin: new Date().toISOString() } });
    await expect(pub.regenererTexteKit(v.id, "linkedin")).rejects.toMatchObject({ code: "REECRITURE_EN_COURS" });
    expect(appels).toHaveLength(0);
    // Marque vieille de plus de 5 minutes : ignorée, la réécriture part.
    await depots().kits.modifier(k.id, { reecrituresEnCours: { linkedin: new Date(Date.now() - pub.DUREE_MARQUE_REECRITURE_MS - 1000).toISOString() } });
    await pub.regenererTexteKit(v.id, "linkedin");
    expect(appels).toHaveLength(1);
  });

  // RELECTURE FINALE G2 : la marque durait 5 min alors qu'un texte peut prendre 2 essais de 300 s ; et la fin du premier
  // appel levait la marque d'un second. Attendu : la marque tient plus que 2 × 300 s, et seul son propriétaire la lève.
  it("CORRIGÉ G2 — la marque tient plus de 2 × 300 s, et seul celui qui l'a posée la lève", async () => {
    const { DELAI_TOTAL_MS } = await import("@/fournisseurs/claude/client");
    const { ESSAIS_TEXTE_PUBLICATION } = await import("@/generateur/roles/publication");
    expect(pub.DUREE_MARQUE_REECRITURE_MS).toBeGreaterThan(ESSAIS_TEXTE_PUBLICATION * DELAI_TOTAL_MS);
    const appels = await brancherClaudeTextes(0);
    const v = await videoPrete();
    await pub.obtenirKit(v.id);
    const k = (await depots().kits.trouver((x) => x.videoId === v.id))!;
    // Une marque posée il y a 5 min 30 (premier appel encore en cours, second essai) bloque toujours.
    await depots().kits.modifier(k.id, { reecrituresEnCours: { linkedin: new Date(Date.now() - 330_000).toISOString() } });
    await expect(pub.regenererTexteKit(v.id, "linkedin")).rejects.toMatchObject({ code: "REECRITURE_EN_COURS" });
    expect(appels).toHaveLength(0);
    // La réécriture d'un AUTRE (marque reprise après expiration) n'est pas levée par la fin d'un appel plus ancien.
    const marque = new Date(Date.now() - pub.DUREE_MARQUE_REECRITURE_MS - 1000).toISOString();
    await depots().kits.modifier(k.id, { reecrituresEnCours: { linkedin: marque } });
    const kits = depots().kits;
    const original = kits.modifier.bind(kits);
    let posee = false;
    vi.spyOn(kits, "modifier").mockImplementation(async (id, patch) => {
      const r = await original(id, patch);
      // Juste après que CET appel a posé sa marque, un autre (après expiration) pose la sienne.
      if (!posee && patch.reecrituresEnCours?.linkedin && patch.reecrituresEnCours.linkedin !== marque) {
        posee = true;
        await original(id, { reecrituresEnCours: { linkedin: "2999-01-01T00:00:00.000Z" }, reecrituresJetons: { linkedin: "jeton-autre" } } as never);
      }
      return r;
    });
    await pub.regenererTexteKit(v.id, "linkedin");
    vi.restoreAllMocks();
    // La marque de l'autre est toujours là.
    expect((await depots().kits.obtenir(k.id))!.reecrituresEnCours?.linkedin).toBe("2999-01-01T00:00:00.000Z");
  });
});

/* ================================================================== */
/* 6. DEUX ONGLETS                                                      */
/* ================================================================== */

/**
 * La base Postgres du studio (src/donnees/postgres/index.ts:218-227) garde une copie en mémoire et ne la met à jour
 * qu'APRÈS l'écriture en base (`await this.base.ecrire(...)` puis `t.set(...)`). On reproduit ici cette latence
 * d'écriture sur le dépôt en mémoire : une lecture faite pendant l'écriture voit l'ancien état, comme en production.
 */
function latenceEcritureKits(ms = 20) {
  const kits = depots().kits;
  const original = kits.modifier.bind(kits);
  vi.spyOn(kits, "modifier").mockImplementation(async (id, patch) => {
    await pause(ms);
    return original(id, patch);
  });
}

describe("6 · Deux onglets", () => {
  it("deux retouches du MÊME texte en parallèle : la dernière gagne entière (aucun mélange des deux)", async () => {
    const v = await videoPrete();
    await pub.obtenirKit(v.id);
    await Promise.all([pub.modifierTexteKit(v.id, "linkedin", "Texte onglet A", ["#A"]), pub.modifierTexteKit(v.id, "linkedin", "Texte onglet B", ["#B"])]);
    const t = (await depots().kits.trouver((k) => k.videoId === v.id))!.textes.linkedin!;
    expect([`${t.texte}|${t.motsDiese.join()}`]).toEqual([expect.stringMatching(/^(Texte onglet A\|#A|Texte onglet B\|#B)$/)]);
    expect(t.modifieAMain).toBe(true);
  });

  it("retouches de DEUX réseaux différents en parallèle (latence base) : aucune n'est perdue (verrou du kit)", async () => {
    const v = await videoPrete();
    await pub.obtenirKit(v.id);
    latenceEcritureKits();
    await Promise.all([pub.modifierTexteKit(v.id, "linkedin", "Texte LinkedIn", []), pub.modifierTexteKit(v.id, "tiktok", "Texte TikTok", [])]);
    const k = (await depots().kits.trouver((x) => x.videoId === v.id))!;
    expect(k.textes.linkedin?.texte).toBe("Texte LinkedIn");
    expect(k.textes.tiktok?.texte).toBe("Texte TikTok");
  });

  it("deux lancements de la MÊME vidéo depuis deux onglets : un seul travail (verrou par vidéo)", async () => {
    const [a, b] = await Promise.all([fabrication.lancerFabrication("v-03", { confirme: true }), fabrication.lancerFabrication("v-03", { confirme: true })]);
    expect(a.travailId).toBe(b.travailId);
  });

  // DÉFAUT : `cocherAvantDePublier` (src/services/publications.ts:421-425) relit le kit puis réécrit TOUT l'objet
  // `avantDePublier` ({ ...kit.avantDePublier, [cle]: valeur }) HORS du verrou du kit. Onglet B : Will DÉCOCHE « Droits »
  // (licence douteuse) ; onglet A, au même moment : il coche « Image ». A écrit en dernier avec son ancienne copie :
  // « Droits » est RECOCHÉ en silence et la vidéo redevient publiable sans que Will l'ait voulu.
  // Corrigé par le correcteur final B (lecture et écriture sous le verrou du kit) : `.fails` retiré.
  it("décocher « Droits » dans un onglet pendant qu'on coche « Image » dans l'autre : le décochage est gardé", async () => {
    const v = await videoPrete();
    await pub.obtenirKit(v.id);
    for (const c of ["son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(v.id, c, true);
    latenceEcritureKits();
    await Promise.all([pub.cocherAvantDePublier(v.id, "droits", false), pub.cocherAvantDePublier(v.id, "image", true)]);
    const cases = (await depots().kits.trouver((k) => k.videoId === v.id))!.avantDePublier;
    expect(cases.image).toBe(true);
    expect(cases.droits).toBe(false);
  });

  // DÉFAUT (même cause) : deux cases cochées en parallèle (deux onglets, ou deux touchers rapides avec une base lente) :
  // une des deux coches disparaît en silence.
  it("deux cases cochées en parallèle : les deux restent cochées", async () => {
    const v = await videoPrete();
    await pub.obtenirKit(v.id);
    latenceEcritureKits();
    await Promise.all([pub.cocherAvantDePublier(v.id, "image", true), pub.cocherAvantDePublier(v.id, "son", true)]);
    const cases = (await depots().kits.trouver((k) => k.videoId === v.id))!.avantDePublier;
    expect(cases).toMatchObject({ image: true, son: true });
  });
});
