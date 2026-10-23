/**
 * VÉRIFICATEUR E2E n° 1 — PARCOURS C (bc), de bout en bout : « Écrire ces N idées » (écriture en série) → N sujets
 * écrits par Claude (DOUBLÉ : le vrai chemin payant, `executerRoleFacture`, pré-vol, réservation, dépenses) → épisodes
 * d'une série TikTok dans l'ordre → « Valider les N » → « Fabriquer les N » sur chaque sujet → N vidéos mères lancées.
 *
 * Configuration de PRODUCTION reproduite (valeurs factices, aucun appel réel) : FOURNISSEUR_SCRIPT=claude et sa clé,
 * HeyGen (voix et double), studio-rendu, R2, illustrations « reel » ; en base : texte-reseaux=claude, publication=buffer…
 * Interrupteurs « Votre avatar parle » et « Montage réel » ÉTEINTS. Tout `fetch` hors du faux Claude fait échouer le test.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "./helpers/g0";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";
import type { DefinitionRole } from "@/generateur/roles/types";

Object.assign(process.env, {
  STUDIO_RENDU_URL: "http://studio-rendu.essai",
  STUDIO_RENDU_CLE: "cle-rendu-essai",
  STUDIO_ALIGNEUR_URL: "http://studio-aligneur.essai",
  FOURNISSEUR_ALIGNEMENT: "studio-aligneur",
  FOURNISSEUR_MONTAGE: "studio-rendu",
  FOURNISSEUR_VISAGE: "heygen",
  FOURNISSEUR_VOIX: "heygen",
  FOURNISSEUR_SCRIPT: "claude",
  FOURNISSEUR_ILLUSTRATION: "reel",
  FOURNISSEUR_STOCKAGE: "r2",
  HEYGEN_API_KEY: "cle-heygen-essai-bc",
  ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE,
  FAL_KEY: "cle-fal-essai",
  PEXELS_API_KEY: "cle-pexels-essai",
  PIXABAY_API_KEY: "cle-pixabay-essai",
  R2_ACCOUNT_ID: "compte-essai",
  R2_ACCESS_KEY_ID: "ACCES-ESSAI",
  R2_SECRET_ACCESS_KEY: "secret-essai",
  R2_BUCKET: "seau-essai",
});

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
// Garde-fous budget : crochet d'essai du pire cas de la chaîne (module de test, plus dans le code de production).
vi.mock("@/generateur/pire-cas", async (orig) => (await import("./helpers/pire-cas-essai")).pireCasInjectable(await orig()));
import { injecterPireCasChainePourEssai } from "./helpers/pire-cas-essai";
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

/** Réseau doublé : R2 (signé en local) répond ; toute autre adresse fait échouer le test. Posé AVANT tout import (le
 * stockage R2 garde le `fetch` du moment de sa création). */
async function reseau(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const u = new URL(String(url instanceof Request ? url.url : url));
  if (u.hostname.endsWith("r2.cloudflarestorage.com")) {
    if ((init?.method ?? "GET") === "PUT") return new Response("", { status: 200 });
    return new Response(new Uint8Array(16), { status: 200, headers: { "content-length": "16" } });
  }
  throw new Error(`Adresse inattendue (aucun appel réel permis) : ${u.hostname}${u.pathname}`);
}
vi.stubGlobal("fetch", (u: string | URL | Request, i?: RequestInit) => reseau(u, i));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const bg = await import("@/services/boucle-generation");
const serie = await import("@/services/serie-ecriture");
const series = await import("@/services/series");
const fr = await import("@/services/fabrication-reseaux");
const gd = await import("@/services/generateur-depenses");
const boucle = await import("@/services/boucle");
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { ROLES_ECRITURE } = await import("@/generateur/roles");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");
const { ideesParLigne } = await import("@/domaine/serie-idees");
const { lancerSerieAction } = await import("@/app/(studio)/ecrire/serie/actions");
const { assemblerBlocs, texteDesBlocs } = await import("@/domaine/derivations-generateur");
const { texteScript } = await import("@/domaine/derivations");

const MDP = "e2e-verif1-bc-serie";
const REGLAGES = { reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", adresse: "vous" as const, mode: "avatar" as const, objectif: "notoriete" as const };
const IDEES = SUJETS_BANC.map((s) => s.idee);
const mots = (t: string) => t.split(/\s+/).filter(Boolean);

/** Faux Claude : reconnaît le rôle par sa consigne et répond par la sortie de sa simulation ; `panne` le coupe. */
const claude = { appels: 0, panne: false };
function fauxClaude() {
  const roles = Object.values(ROLES_ECRITURE) as DefinitionRole[];
  return (async (_u: string | URL | Request, init?: RequestInit) => {
    const corps = JSON.parse(String(init?.body ?? "{}")) as { system: { text: string }[]; messages: { content: string }[] };
    const role = roles.find((r) => corps.system.at(-1)!.text.startsWith(r.consigne.trim()))!;
    claude.appels++;
    if (claude.panne) throw new TypeError("coupure du réseau");
    const bloc = (b: string) => corps.system.find((x) => x.text.startsWith(`<${b}>`))?.text.replace(new RegExp(`^<${b}>\\n|\\n</${b}>$`, "g"), "");
    const sortie = role.simuler({ contexte: { contexteAxion: bloc("contexte_axion"), styleWill: bloc("style_will"), preuves: bloc("preuves"), gagnants: bloc("gagnants") }, variable: corps.messages[0].content });
    return reponseFlux(fluxReussi({ texte: JSON.stringify(sortie), modele: role.modele, entree: 2500, cacheEcrit: 1000, sortie: 1500 }));
  }) as typeof fetch;
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  // Garde-fous budget (15/10) : ce parcours ne porte pas sur le pire cas de la chaîne (testé dans garde-fous-budget).
  injecterPireCasChainePourEssai(0);
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  claude.appels = 0;
  claude.panne = false;
  vi.stubGlobal("fetch", reseau);
  await auth.seConnecter(MDP, false);
  for (const [k, v] of Object.entries({ "fournisseur.publication": "buffer", "fournisseur.texte-reseaux": "claude", "fournisseur.miniature": "studio-rendu", "fournisseur.etalonnage": "studio-rendu", "fournisseur.son": "studio-rendu" })) await ecrireParametre(k, v);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
  for (const x of await depots().travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, (async () => { throw new Error("réseau interdit"); }) as typeof fetch)], ["anthropic"]);
  await credits.declarerRecharge("anthropic", 500);
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fauxClaude(), attenteMs: () => 0 });
});

afterEach(() => {
  bg.arreterBoucleGeneration();
  injecterPireCasChainePourEssai(null);
  gc.injecterClaudePourEssai(null);
  credits.injecterLecteursPourEssai(null);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Will valide un sujet écrit : la limite proposée (un toucher), puis « Valider les N ». */
async function valider(sujetId: string) {
  const m = (await depots().scriptsMaitres.obtenir(sujetId))!;
  if (m.exception?.source === "proposition-machine" && !m.exception.valideeParWill) await bg.validerException(sujetId, "c-est-juste");
  const vs = await depots().variantes.lister((v) => v.scriptMaitreId === sujetId && !v.archiveLe);
  await bg.validerVariantes(vs.map((v) => v.id));
}

async function noterIdees(textes: string[]) {
  const ids: string[] = [];
  for (const t of textes) ids.push((await depots().idees.enregistrer({ id: `idee-bc-${ids.length}`, texte: t, etat: "nouvelle", creeLe: "2026-10-03T08:00:00.000Z", modifieLe: "2026-10-03T08:00:00.000Z" })).id);
  return ids;
}

describe("C · « Écrire ces N idées » → N scripts (Claude, chemin payant réel doublé) → N vidéos lancées", () => {
  it("3 idées tapées « une par ligne » dans une série TikTok : 3 sujets écrits, épisodes 1-2-3 dans l'ordre, 3 « Fabriquer les N » lancés", async () => {
    // Écran Sujet, « Plusieurs idées » : une par ligne (puces et doublons retirés).
    const lignes = ideesParLigne(`- ${IDEES[0]}\n2) ${IDEES[1]}\n• ${IDEES[1].toLowerCase()}\n\n${IDEES[2]}`);
    expect(lignes).toEqual(IDEES);
    const s = await series.creerSerie("Les tableurs");
    // Feuille « Écrire ces 3 idées » : prix maximum calculé = 3 × le prix d'un sujet, Claude réel (pas d'essai).
    const plan = await serie.planSerie(lignes.length);
    expect(plan).toMatchObject({ demandees: 3, partiront: 3, essai: false });
    expect(plan.totalMax.centimes).toBe(3 * (await bg.prixLancement()).centimes);
    const r = await lancerSerieAction(lignes.map((texte) => ({ texte })), { ...REGLAGES, serieId: s.id }, "serie-bc-ordre", plan.totalPartant.centimes, plan.partiront);
    expect(r).toEqual({ ok: true, donnees: { partis: 3, restes: 0, essai: false } });
    // Rien n'est appelé chez Claude dans la requête : c'est la boucle de fond qui écrit, une par une.
    expect(claude.appels).toBe(0);
    let suivi = (await serie.suiviSerie())!;
    expect([suivi.total, suivi.ecrits, suivi.termine]).toEqual([3, 0, false]);
    for (let i = 0; i < 3; i++) await bg.tourBoucleGeneration();
    suivi = (await serie.suiviSerie("serie-bc-ordre"))!;
    expect([suivi.total, suivi.ecrits, suivi.aCompleter, suivi.termine]).toEqual([3, 3, 0, true]);
    expect(claude.appels).toBeGreaterThan(0);
    // Ordre et numéros : sujets n° 1, 2, 3 et épisodes 1, 2, 3, dans l'ordre des lignes.
    const sujets = await Promise.all(suivi.elements.map((e) => depots().scriptsMaitres.obtenir(e.scriptMaitreId!)));
    expect(sujets.map((m) => m!.brief.idee)).toEqual(IDEES);
    expect(sujets.map((m) => m!.episodeSerie)).toEqual([1, 2, 3]);
    expect(sujets.map((m) => m!.numero)).toEqual([...sujets.map((m) => m!.numero!)].sort((a, b) => a - b));
    // Écriture réelle : des dépenses Claude enregistrées, rattachées à chaque sujet.
    for (const m of sujets) expect((await depots().depenses.lister((d) => d.scriptMaitreId === m!.id && d.lignes.some((l) => l.fournisseur === "anthropic"))).length).toBeGreaterThan(0);

    // Chaque sujet : « Valider les N », puis « Fabriquer les N » (prix vu sur la feuille, envoyé par l'écran).
    const meres: string[] = [];
    for (const m of sujets) {
      await valider(m!.id);
      const pf = (await fr.planFabricationSujet(m!.id))!;
      expect(pf.versions.length).toBe(RESEAUX_DECLINAISON.length);
      const f = await fr.fabriquerLesN(m!.id, { operationId: `op-bc-${m!.id}`, lancer: true, totalConfirme: pf.total.centimes });
      expect(f.travailId).toBeTruthy();
      expect(f.enAttente).toBeUndefined();
      expect(f.videoIds).toHaveLength(pf.versions.length);
      // Le même geste renvoyé (double toucher) ne crée ni ne lance rien de plus.
      expect(await fr.fabriquerLesN(m!.id, { operationId: `op-bc-${m!.id}`, lancer: true, totalConfirme: pf.total.centimes })).toMatchObject({ mereVideoId: f.mereVideoId, travailId: f.travailId });
      meres.push(f.mereVideoId);
      // La vidéo mère lit le texte écrit par Claude pour SA version (ouverture + corps + fin), mot pour mot.
      const mere = (await depots().videos.obtenir(f.mereVideoId))!;
      const v = (await depots().variantes.obtenir(mere.varianteId!))!;
      const script = (await depots().scripts.obtenir(v.scriptId))!;
      const version = (await depots().versions.lister((x) => x.videoId === f.mereVideoId))[0];
      expect(mots(texteScript(version.commande.script.blocs))).toEqual(mots(texteDesBlocs(assemblerBlocs(script, v))));
      // La mère porte la série et son épisode (en-tête « Série : … »).
      expect(await series.serieDeVideo(mere)).toMatchObject({ id: s.id, episode: m!.episodeSerie });
    }
    expect(new Set(meres).size).toBe(3);
    expect(await depots().travaux.compter((t) => meres.includes(t.cibleId) && (t.statut === "en_file" || t.statut === "en_cours"))).toBe(3);
  }, 120_000);

  it("la même série renvoyée (double toucher, même clé) ne crée aucun sujet de plus ; le suivi reste juste", async () => {
    const plan = await serie.planSerie(3);
    const a = await serie.lancerSerie(IDEES.map((texte) => ({ texte })), REGLAGES, "serie-bc-double", plan.totalPartant.centimes, plan.partiront);
    const b = await serie.lancerSerie(IDEES.map((texte) => ({ texte })), REGLAGES, "serie-bc-double", plan.totalPartant.centimes, plan.partiront);
    expect(b.serie).toEqual(a.serie);
    expect(await depots().scriptsMaitres.compter((m) => !m.estDemo && IDEES.includes(m.brief.idee))).toBe(3);
    expect(await depots().generations.compter((g) => g.statut === "en-cours" && !g.estDemo)).toBe(3);
  });

  it("au-delà du seuil (20 idées) : le prix total est exigé ; sans lui, rien n'est créé ; avec lui, les 20 partent", async () => {
    // Lot L5 : vingt « variantes » des mêmes trois idées ne sont pas vingt sujets différents ; le contrôle « déjà traité » n'est pas l'objet ici.
    await ecrireParametre("sujets.garde", "eteint");
    const vingt = Array.from({ length: 20 }, (_, i) => `${IDEES[i % 3]} (variante ${i + 1})`);
    const plan = await serie.planSerie(20);
    expect(plan.totalPartant.centimes).toBeGreaterThan(2000);
    await expect(serie.lancerSerie(vingt.map((texte) => ({ texte })), REGLAGES, "serie-bc-vingt")).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    // Un prix vu pour un autre nombre d'idées ne vaut pas.
    await expect(serie.lancerSerie(vingt.map((texte) => ({ texte })), REGLAGES, "serie-bc-vingt", plan.totalPartant.centimes, 19)).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    expect(await depots().scriptsMaitres.compter((m) => !m.estDemo)).toBe(0);
    const { serie: s } = await serie.lancerSerie(vingt.map((texte) => ({ texte })), REGLAGES, "serie-bc-vingt", plan.totalPartant.centimes, 20);
    expect(s.elements.filter((e) => e.sort === "parti")).toHaveLength(20);
    expect(await depots().scriptsMaitres.compter((m) => !m.estDemo)).toBe(20);
  });

  /**
   * Série de 3 ; l'écriture n° 2 tombe en panne (Claude coupé, aucune réponse) et s'arrête. Garde-fous budget (15/10) :
   * elle s'arrête dès la 1re panne ; les tours suivants ne la rejouent plus.
   */
  async function serieAvecPanne(): Promise<string> {
    vi.useFakeTimers({ toFake: ["Date"] });
    const plan = await serie.planSerie(3);
    await serie.lancerSerie(IDEES.map((texte) => ({ texte })), REGLAGES, "serie-bc-panne", plan.totalPartant.centimes, plan.partiront);
    await bg.tourBoucleGeneration(); // n° 1 écrit
    claude.panne = true;
    await bg.tourBoucleGeneration(); // n° 2 : 1re panne
    claude.panne = false;
    await bg.tourBoucleGeneration(); // n° 3 écrit (les autres passent avant celle qui vient de rater)
    claude.panne = true;
    await bg.tourBoucleGeneration(); // n° 2 : 2e panne
    vi.setSystemTime(Date.now() + 61_000);
    await bg.tourBoucleGeneration(); // n° 2 : 3e panne → arrêtée
    claude.panne = false;
    return (await serie.suiviSerie())!.elements[1].scriptMaitreId!;
  }

  /** « Reprendre l'écriture » avec l'accord de Will sur le supplément montré par la fiche (relecture finale G1). */
  async function reprendreAvecAccord(id: string): Promise<boolean> {
    return bg.reprendreEcritureArretee(id, (await bg.ecritureArretee(id))?.supplement?.centimes);
  }

  it("une écriture tombe en panne (Claude coupé) : les autres sont écrites, Will est prévenu, la fiche propose « Reprendre »", async () => {
    const panne = await serieAvecPanne();
    const suivi = (await serie.suiviSerie())!;
    expect(suivi.elements.map((e) => e.etat === "ecrit")).toEqual([true, false, true]);
    expect(suivi.termine).toBe(true);
    expect((await bg.ecritureArretee(panne))?.message).toMatch(/^Claude n'a pas répondu/);
    expect(await depots().notifications.trouver((n) => n.titre === "Une écriture s'est arrêtée")).toBeTruthy();
    expect(await reprendreAvecAccord(panne)).toBe(true);
  });

  // BLOQUANT CONFIRMÉ (perte si une écriture échoue) : chaque appel à Claude resté SANS réponse (coupure) garde pour
  // toujours son « pire cas » dans la dépense du sujet (services/generation-claude.ts:175 : `appelId` sans `termineLe`
  // → `estimationPireCasUsd`, ≈ 0,27 $ pour le stratège). Après les 3 pannes, ≈ 0,80 $ fantômes : « Reprendre
  // l'écriture » repart, paie toutes les étapes, puis s'arrête « Plafond du sujet atteint » (generation-claude.ts:423)
  // à la DERNIÈRE étape (déclinaison) : aucune version par réseau, rien à valider ni à fabriquer, le sujet reste
  // « en-ecriture » et le suivi dit « À compléter ». L'argent des étapes est dépensé pour rien. Attendu : un appel parti
  // en panne sans réponse ne compte plus son pire cas une fois la panne constatée (ou le plafond de la reprise en
  // tient compte), et la reprise va au bout.
  it("CORRIGÉ — « Reprendre l'écriture » après 3 pannes : l'écriture va au bout (3 sur 3 écrits)", async () => {
    const panne = await serieAvecPanne();
    await reprendreAvecAccord(panne);
    vi.setSystemTime(Date.now() + 61_000);
    await bg.tourBoucleGeneration();
    expect(await serie.suiviSerie()).toMatchObject({ total: 3, ecrits: 3, termine: true });
  });

  it("CORRECTEUR FINAL A — la reprise va au bout ; les appels sans réponse restent comptés (rien d'effacé) et la nouvelle dépense reste dans la marge du lancement", async () => {
    const panne = await serieAvecPanne();
    const g0 = (await depots().generations.lister((g) => g.scriptMaitreId === panne))[0];
    // L'appel sans réponse (1 seul : arrêt dès la 1re panne, garde-fous du 15/10) compté à son pire cas.
    expect(g0.etapes.filter((e) => e.appelId && !e.termineLe)).toHaveLength(1);
    const fantomes = gc.depenseGenerationUsd(g0);
    expect(fantomes).toBeGreaterThan(0.25);
    await reprendreAvecAccord(panne);
    vi.setSystemTime(Date.now() + 61_000);
    await bg.tourBoucleGeneration();
    const g = (await depots().generations.obtenir(g0.id))!;
    expect(g.statut).toBe("terminee");
    // Le plafond est relevé exactement des appels sans réponse : la reprise n'a pas plus de marge qu'au lancement.
    expect(g.plafondUsd).toBeCloseTo(g0.plafondUsd + fantomes, 6);
    expect(g.etapes.filter((e) => e.appelId && !e.termineLe)).toHaveLength(1);
    expect(gc.depenseGenerationUsd(g)).toBeLessThanOrEqual(g.plafondUsd);
    expect(await depots().variantes.compter((v) => v.scriptMaitreId === panne)).toBeGreaterThan(0);
    // Une seconde reprise ne relève plus rien (chaque appel sans réponse ne compte qu'une fois).
    expect(await gc.releverPlafondApresPannes(g0.id, Number.POSITIVE_INFINITY)).toBe(0);
  });

  /*
   * RELECTURE FINALE G1 : « Reprendre l'écriture » relevait le plafond du sujet (pire cas des appels sans réponse) sans
   * montrer de prix ni demander d'accord, et chaque cycle « panne puis reprise » ajoutait cette marge. Attendu : la fiche
   * montre le montant supplémentaire possible ; la reprise passe par la confirmation de ce prix ; un seul relèvement
   * par accord.
   */
  it("CORRIGÉ G1 — « Reprendre l'écriture » montre le supplément possible et exige son accord ; un relèvement par accord", async () => {
    const panne = await serieAvecPanne();
    const g0 = (await depots().generations.lister((g) => g.scriptMaitreId === panne))[0];
    const arret = (await bg.ecritureArretee(panne))!;
    // Le montant supplémentaire possible est connu de la fiche (centimes d'euro).
    expect(arret.supplement?.centimes ?? 0).toBeGreaterThan(0);
    const supplement = arret.supplement!.centimes;
    // Sans accord : rien ne bouge, le prix est demandé.
    const sansAccord = await bg.reprendreEcritureArretee(panne).then(
      () => null,
      (e: { code?: string; montant?: number }) => e,
    );
    expect(sansAccord).toMatchObject({ code: "CONFIRMATION_REQUISE", montant: supplement });
    // Un accord plus bas que le prix du jour ne suffit pas.
    await expect(bg.reprendreEcritureArretee(panne, supplement - 1)).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE", montant: supplement });
    let g = (await depots().generations.obtenir(g0.id))!;
    expect(g.statut).toBe("echec");
    expect(g.plafondUsd).toBe(g0.plafondUsd);
    expect(await bg.ecritureArretee(panne)).toBeTruthy();
    // Accord donné sur ce montant : un seul relèvement, puis la reprise va au bout.
    expect(await bg.reprendreEcritureArretee(panne, supplement)).toBe(true);
    g = (await depots().generations.obtenir(g0.id))!;
    expect(g.plafondUsd).toBeGreaterThan(g0.plafondUsd);
    const apresAccord = g.plafondUsd;
    // Le même accord rejoué (double toucher) ne relève rien de plus.
    expect(await bg.reprendreEcritureArretee(panne, supplement)).toBe(false);
    expect((await depots().generations.obtenir(g0.id))!.plafondUsd).toBe(apresAccord);
  });

  // GÊNE CONFIRMÉE : une écriture ARRÊTÉE sur panne (Claude n'a pas répondu 3 fois) est affichée « À compléter » dans le
  // suivi de la série (services/serie-ecriture.ts:237-238 : tout ce qui n'est ni écrit, ni en cours, ni en attente
  // devient « a-completer »). Or « À compléter » veut dire « il manque une matière » ; la fiche du sujet, elle, propose
  // « Reprendre l'écriture ». Will cherche une matière à ajouter qui n'existe pas. Attendu : un état distinct (« Arrêtée »)
  // pour une écriture en échec.
  it("CORRIGÉ — suivi de série : une écriture arrêtée sur panne n'est pas dite « À compléter »", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const plan = await serie.planSerie(1);
    await serie.lancerSerie([{ texte: IDEES[0] }], REGLAGES, "serie-bc-arret", plan.totalPartant.centimes, plan.partiront);
    claude.panne = true;
    for (let i = 0; i < 3; i++) {
      await bg.tourBoucleGeneration();
      vi.setSystemTime(Date.now() + 61_000);
    }
    const suivi = (await serie.suiviSerie())!;
    expect(await bg.ecritureArretee(suivi.elements[0].scriptMaitreId!)).toBeTruthy();
    expect(suivi.elements[0].etat).not.toBe("a-completer");
    expect(suivi.aCompleter).toBe(0);
  });

  // GÊNE CONFIRMÉE (ordre / numéros d'épisode) : une idée de la série qui s'arrête à 0 € (hors du domaine, matière
  // manquante) prend quand même un numéro d'ÉPISODE (generateur.ts:179, `rattacherSujet` à la création, AVANT l'étape 0)
  // alors qu'elle ne sera jamais écrite ni publiée : la série publiée saute un épisode (« ép. 1 », « ép. 3 »). Attendu :
  // l'épisode attribué seulement aux sujets qui partent en écriture (ou rendu si l'écriture s'arrête à 0 €).
  // INTÉGRATION FINALE : corrigé (décision du 04/10) — l'épisode est pris au départ réel de l'écriture (`attribuerNumero`).
  it("CORRIGÉ — une idée arrêtée à 0 € ne fait pas sauter de numéro d'épisode aux suivantes", async () => {
    const s = await series.creerSerie("Les tableurs");
    const idees = [IDEES[0], "Comment contester un PV de stationnement", IDEES[1]];
    const plan = await serie.planSerie(3);
    const { serie: lancee } = await serie.lancerSerie(idees.map((texte) => ({ texte })), { ...REGLAGES, serieId: s.id }, "serie-bc-episodes", plan.totalPartant.centimes, plan.partiront);
    // Relecture finale : l'épisode se prend à la première étape vraiment payée.
    for (let i = 0; i < 3; i++) await bg.tourBoucleGeneration();
    const ecrits = [];
    for (const e of lancee.elements) {
      const m = (await depots().scriptsMaitres.obtenir(e.scriptMaitreId!))!;
      if (m.numero !== undefined) ecrits.push(m.episodeSerie);
    }
    expect(ecrits).toEqual([1, 2]);
  });

  // INTÉGRATION FINALE : l'ancien constat (« … mais avec l'épisode 2 ») décrivait le défaut corrigé ci-dessus.
  it("constat : l'idée hors domaine est « partie » (« À compléter » au suivi), sans numéro de sujet ni épisode", async () => {
    const s = await series.creerSerie("Les tableurs");
    const idees = [IDEES[0], "Comment contester un PV de stationnement", IDEES[1]];
    const plan = await serie.planSerie(3);
    const { serie: lancee } = await serie.lancerSerie(idees.map((texte) => ({ texte })), { ...REGLAGES, serieId: s.id }, "serie-bc-episodes", plan.totalPartant.centimes, plan.partiront);
    expect(lancee.elements.map((e) => e.sort)).toEqual(["parti", "parti", "parti"]);
    for (let i = 0; i < 3; i++) await bg.tourBoucleGeneration();
    const sujets = await Promise.all(lancee.elements.map((e) => depots().scriptsMaitres.obtenir(e.scriptMaitreId!)));
    expect(sujets.map((m) => [m!.numero === undefined, m!.episodeSerie, m!.manque?.type])).toEqual([
      [false, 1, undefined],
      [true, undefined, "HORS_DOMAINE"],
      [false, 2, undefined],
    ]);
    expect((await serie.suiviSerie())!.elements[1].etat).toBe("a-completer");
  });

  // GÊNE CONFIRMÉE (doublon) : la série ne vérifie pas, côté serveur, qu'une idée de « Idées » est déjà partie
  // (serie-ecriture.ts:153-176 : seul l'écran filtre, `ideeEcrivable`, SerieIdees.tsx:11). Un écran resté ouvert (autre
  // onglet, retour arrière) relance la même idée avec une nouvelle clé : un second sujet est créé et PAYÉ, l'idée est
  // reliée au second. Attendu : une idée déjà reliée à un sujet n'est pas relancée (« déjà écrite »).
  it("CORRIGÉ — une idée de « Idées » déjà écrite, renvoyée par un écran périmé, n'est pas écrite (et payée) une seconde fois", async () => {
    const ids = await noterIdees([IDEES[0]]);
    const plan = await serie.planSerie(1);
    await serie.lancerSerie([{ texte: IDEES[0], ideeId: ids[0] }], REGLAGES, "serie-bc-idee-1", plan.totalPartant.centimes, plan.partiront);
    await serie.lancerSerie([{ texte: IDEES[0], ideeId: ids[0] }], REGLAGES, "serie-bc-idee-2", plan.totalPartant.centimes, plan.partiront).catch(() => null);
    expect(await depots().scriptsMaitres.compter((m) => !m.estDemo && m.brief.ideeId === ids[0])).toBe(1);
  });

  // (Constat retiré : l'idée déjà écrite n'est plus relancée, voir le test « CORRIGÉ » juste au-dessus.)
});

describe("C · « Fabriquer les N » avec la configuration de production, interrupteurs éteints", () => {
  async function sujetEcrit(): Promise<string> {
    const plan = await serie.planSerie(1);
    const { serie: s } = await serie.lancerSerie([{ texte: IDEES[0] }], REGLAGES, "serie-bc-prod", plan.totalPartant.centimes, plan.partiront);
    await bg.tourBoucleGeneration();
    const id = s.elements[0].scriptMaitreId!;
    await valider(id);
    return id;
  }

  it("les vidéos partent et vont au bout avec le moteur de SIMULATION : rien n'est payé, aucune dépense réelle", async () => {
    const id = await sujetEcrit();
    const pf = (await fr.planFabricationSujet(id))!;
    expect(pf.lignes!.every((l) => l.fournisseur === "simulation")).toBe(true);
    const avant = (await depots().depenses.lister((d) => d.lignes.some((l) => l.fournisseur !== "simulation"))).length;
    const prod = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = "production";
    let f;
    try {
      f = await fr.fabriquerLesN(id, { operationId: "op-bc-prod", lancer: true, totalConfirme: pf.total.centimes });
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prod;
    }
    expect(f.travailId).toBeTruthy();
    for (const v of await depots().versions.lister((x) => f.videoIds.includes(x.videoId))) expect(v.commande.moteurId).toBe("simulation");
    vi.useFakeTimers({ toFake: ["Date"] });
    for (let i = 0; i < 300; i++) {
      vi.setSystemTime(Date.now() + 5_000);
      await boucle.tourDeBoucle();
      if ((await Promise.all(f.videoIds.map((x) => depots().videos.obtenir(x)))).every((x) => x?.statut === "prete")) break;
    }
    vi.useRealTimers();
    expect((await Promise.all(f.videoIds.map((x) => depots().videos.obtenir(x)))).map((x) => x?.statut)).toEqual(f.videoIds.map(() => "prete"));
    const reelles = (await depots().depenses.lister((d) => d.lignes.some((l) => l.fournisseur !== "simulation") && !!d.videoId && f.videoIds.includes(d.videoId))).length;
    expect(reelles).toBe(0);
    expect((await depots().depenses.lister((d) => d.lignes.some((l) => l.fournisseur !== "simulation"))).length).toBeGreaterThanOrEqual(avant);
  }, 120_000);

  // FICTIF PRÉSENTÉ COMME RÉEL (confirmé) : sur la fiche du sujet, la feuille « Fabriquer les N » n'est PAS marquée Essai
  // et annonce le prix (ex. « 7,35 € ») et le « total du jour après » comme une vraie dépense, alors que le moteur est la
  // simulation (interrupteur « Montage réel » éteint) et qu'aucune ligne n'est payée. Cause : `partPayee()`
  // (services/generateur-depenses.ts:67-76, lue par ecrire/sujets/[id]/page.tsx:99 et lireResumeDepense) juge « payé »
  // dès que le double HeyGen est relié et sa clé présente, sans regarder le moteur qui fabriquera. Attendu : « Essai :
  // rien ne sera payé » tant que le moteur de la fabrication est la simulation.
  it("CORRIGÉ — « Fabriquer les N » en simulation (interrupteurs éteints) : la feuille dit « Essai : rien ne sera payé »", async () => {
    const id = await sujetEcrit();
    const pf = (await fr.planFabricationSujet(id))!;
    expect(pf.lignes!.every((l) => l.fournisseur === "simulation")).toBe(true);
    // Lecteurs de crédits de la production (HeyGen et Claude, clés présentes).
    credits.injecterLecteursPourEssai(null);
    const resume = await gd.lireResumeDepense(pf.total);
    expect(resume.essai).toBe(true);
    expect((await gd.partPayee()).rienNestPaye).toBe(true);
  });

  it("CORRECTEUR FINAL A — la feuille marque le prix « Essai » et ne l'ajoute ni au total du jour ni au budget", async () => {
    const id = await sujetEcrit();
    const pf = (await fr.planFabricationSujet(id))!;
    credits.injecterLecteursPourEssai(null);
    const resume = await gd.lireResumeDepense(pf.total, [pf.formatId]);
    expect(resume.essai).toBe(true);
    expect(resume.messageEssai).toMatch(/^Essai : rien ne sera payé\./);
    expect(resume.prix).toMatch(/€$/);
    expect(resume.jourApres).toBe(resume.jourAvant);
  });
});
