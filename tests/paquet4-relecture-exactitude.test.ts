/**
 * RELECTURE PAQUET 4 — lentille EXACTITUDE (docs/controles/RELECTURE-PAQUET4-EXACTITUDE.md) : tests d'attaque A1 à A4
 * rejoués et gardés comme tests de non-régression, plus les petits défauts 3 et 5. Chacun était ROUGE sur 81d1bba.
 *  - A1 (D1) : une instance SANS le verrou ne fait jamais tourner la boucle d'écriture Claude ; perte du verrou = arrêt ;
 *    reprise du verrou = relance.
 *  - A2 (D3) : une écriture lancée en essai reste en essai jusqu'au bout, même si Claude est relié entre-temps.
 *  - A3 (D2) : chaque CONFIRMATION_REQUISE du seuil porte le montant ; un montant confirmé plus bas est refusé.
 *  - A4 (petit défaut 1) : plafond fal.ai, trois soumissions simultanées ne passent plus sur la place d'une seule.
 * Aucun réseau, aucune clé : Claude « branché » répond par un faux `fetch` qui INTERDIT tout appel.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE } from "./helpers/g0";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
// Garde-fous budget : crochet d'essai du pire cas de la chaîne (module de test, plus dans le code de production).
vi.mock("@/generateur/pire-cas", async (orig) => (await import("./helpers/pire-cas-essai")).pireCasInjectable(await orig()));
import { injecterPireCasChainePourEssai } from "./helpers/pire-cas-essai";
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const gc = await import("@/services/generation-claude");
const couts = await import("@/services/couts");
const boucle = await import("@/services/boucle");
const fabrication = await import("@/services/fabrication");
const travaux = await import("@/services/travaux");
const credits = await import("@/services/credits");
const commun = await import("@/services/_commun");
const { ecrireParametre } = commun;
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");
const serie = await import("@/services/serie-ecriture");
const { creerFabricationFal } = await import("@/fournisseurs/illustration/fal");

const MDP = "paquet4-relecture-exactitude";
const appelsClaude: string[] = [];
const fetchInterdit = (async (url: string | URL | Request) => {
  appelsClaude.push(String(url));
  throw new Error("réseau interdit");
}) as typeof fetch;

const REGLAGES = { reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", adresse: "vous" as const, mode: "avatar" as const, objectif: "notoriete" as const };
const IDEES = [...SUJETS_BANC.map((s) => s.idee), "Les réunions qui auraient pu être un e-mail", "Le devis refait trois fois"];
const CLE_BOUCLE_GENERATION = Symbol.for("studio-axion-ia.boucle-generation");
const minuterieEcriture = () => (globalThis as unknown as Record<symbol, { minuterie?: unknown } | undefined>)[CLE_BOUCLE_GENERATION]?.minuterie;

beforeAll(async () => preparerMotDePasse(MDP));
beforeEach(async () => {
  // Garde-fous budget (15/10) : ce parcours ne porte pas sur le pire cas de la chaîne (testé dans garde-fous-budget).
  injecterPireCasChainePourEssai(0);
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  appelsClaude.length = 0;
  await auth.seConnecter(MDP, false);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
});
afterEach(() => {
  injecterPireCasChainePourEssai(null);
  gc.injecterClaudePourEssai(null);
  bg.arreterBoucleGeneration();
  boucle.arreterBoucle();
  // Processus sans verrou (comme les autres essais) : `demarrerBoucleUnique` l'a posé à faux.
  boucle.etatBoucle().verrouTenu = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function brancherClaude() {
  await ecrireParametre("fournisseur.script", "claude");
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fetchInterdit, attenteMs: () => 0 });
  await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, 10_000);
  const b = await couts.resumeBudget();
  await ecrireParametre("budget.mensuel", { centimes: b.depense.centimes + b.engage.centimes + 1_000_000, devise: "EUR" });
}

/* ------------------------------------------------------------------ */
describe("A1 (D1) · verrou réplica : la boucle d'écriture Claude ne tourne que dans l'instance qui tient le verrou", () => {
  it("instance sans le verrou : lancer une écriture ou ouvrir une fiche sujet ne pose AUCUNE minuterie d'écriture", async () => {
    const ok = await boucle.demarrerBoucleUnique({ prendreVerrou: async () => false, boucleFabrication: false });
    expect(ok).toBe(false);
    bg.suspendreBoucleGeneration(false);
    const r = await bg.lancerGeneration({ idee: IDEES[0], reseaux: REGLAGES.reseaux, formatId: "avocat", adresse: "vous", mode: "avatar", objectif: "notoriete" });
    expect(r.ok).toBe(true);
    expect(minuterieEcriture()).toBeUndefined();
    // La fiche sujet appelle `assurerBoucleGeneration()` à chaque affichage.
    bg.assurerBoucleGeneration();
    expect(minuterieEcriture()).toBeUndefined();
    // L'écriture reste en base : l'instance qui tient le verrou la prendra.
    expect(await depots().generations.compter((g) => !g.estDemo && g.statut === "en-cours")).toBe(1);
  });

  it("verrou perdu : la boucle d'écriture s'arrête ; verrou repris : elle est relancée", async () => {
    vi.useFakeTimers();
    bg.suspendreBoucleGeneration(false);
    let perdre!: () => void;
    let libre = true;
    let lances = 0;
    let arrets = 0;
    const ok = await boucle.demarrerBoucleUnique({
      prendreVerrou: async (surPerte) => {
        perdre = surPerte;
        return libre;
      },
      boucleFabrication: false,
      attenteMs: 30_000,
      avecLeVerrou: () => {
        lances++;
        bg.assurerBoucleGeneration();
      },
      surPerte: () => {
        arrets++;
        bg.arreterBoucleGeneration();
      },
    });
    expect(ok).toBe(true);
    expect(lances).toBe(1);
    expect(minuterieEcriture()).toBeDefined();
    libre = false;
    perdre();
    expect(arrets).toBe(1);
    expect(minuterieEcriture()).toBeUndefined();
    // Sans verrou, rien ne la redémarre (fiche sujet ouverte entre-temps).
    bg.assurerBoucleGeneration();
    expect(minuterieEcriture()).toBeUndefined();
    libre = true;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(lances).toBe(2);
    expect(minuterieEcriture()).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
describe("A2 (D3) · série lancée en essai, Claude relié en cours de file : rien ne part chez Claude", () => {
  it("toutes les écritures restent en essai jusqu'au bout (0 appel) et sont marquées essai", async () => {
    const textes = IDEES.slice(0, 4);
    const { plan, serie: lancee } = await serie.lancerSerie(
      textes.map((texte) => ({ texte })),
      REGLAGES,
      "serie-relecture-essai",
    );
    expect(plan.essai).toBe(true);
    // Will relie Claude pendant que la file s'écrit.
    await brancherClaude();
    for (let i = 0; i < textes.length * 3; i++) await bg.tourBoucleGeneration();
    expect(appelsClaude).toHaveLength(0);
    const sujets = await depots().scriptsMaitres.lister((m) => !m.estDemo && textes.includes(m.brief.idee));
    const gens = await depots().generations.lister((g) => sujets.some((m) => m.id === g.scriptMaitreId));
    // Une idée sans matière s'arrête à l'étape 0 (0 €, sans écriture) : les autres sont parties.
    expect(lancee.elements.filter((e) => e.sort === "parti").length).toBeGreaterThanOrEqual(gens.length);
    expect(gens.length).toBeGreaterThanOrEqual(2);
    expect(gens.every((g) => gc.ecritureEnEssai(g))).toBe(true);
    expect(gens.every((g) => g.etapes.every((e) => e.modeleDemande === "simulation"))).toBe(true);
    for (const g of gens.filter((x) => x.statut === "terminee")) expect(g.simulee).toBe(true);
  });

  it("relancer en réel = une NOUVELLE écriture, au prix affiché (jamais la suite de l'essai)", async () => {
    const r0 = await bg.lancerGeneration({ idee: IDEES[0], reseaux: REGLAGES.reseaux, formatId: "avocat", adresse: "vous", mode: "avatar", objectif: "notoriete" });
    expect(r0.ok).toBe(true);
    if (!r0.ok) return;
    await brancherClaude();
    const r1 = await bg.lancerGeneration({ scriptMaitreId: r0.scriptMaitreId });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.generationId).not.toBe(r0.generationId);
    expect(r1.prixAffiche.centimes).toBeGreaterThan(0);
    const reelle = await depots().generations.obtenir(r1.generationId);
    expect(reelle?.essai).toBe(false);
    expect((await depots().generations.obtenir(r0.generationId))?.essai).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
describe("A3 (D2) · au-delà du seuil, la confirmation porte le MONTANT", () => {
  async function travailEnEchec(): Promise<string> {
    for (const x of await depots().travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
    await ecrireParametre("budget.seuilConfirmation", { centimes: 1_000_000, devise: "EUR" });
    const { travailId } = await fabrication.lancerFabrication("v-03", { confirme: true, simulerEchecEtape: "montage" });
    vi.useFakeTimers({ toFake: ["Date"] });
    for (let i = 0; i < 200; i++) {
      if ((await depots().travaux.obtenir(travailId))?.statut === "echec") break;
      vi.setSystemTime(Date.now() + 5_000);
      await boucle.tourDeBoucle();
    }
    vi.useRealTimers();
    expect((await depots().travaux.obtenir(travailId))?.statut).toBe("echec");
    return travailId;
  }

  /** Le travail en échec devient une commande de l'Usine : `reessayerTravail` lit l'origine sur la version du travail. */
  async function enUsine(travailId: string): Promise<void> {
    const t = await depots().travaux.obtenir(travailId);
    const v = t?.versionId ? await depots().versions.obtenir(t.versionId) : null;
    expect(v).toBeTruthy();
    await depots().versions.modifier(v!.id, { commande: { ...v!.commande, origine: "usine" } } as never);
  }

  /** Budget du mois de l'Usine posé (large) : sans lui, l'Usine est refusée pour une autre raison que la confirmation. */
  async function budgetUsineLarge(): Promise<void> {
    const { reglerBudgetUsine } = await import("@/services/budget-mensuel");
    await ecrireParametre("budget.mensuel", { centimes: 1_000_000, devise: "EUR" });
    await reglerBudgetUsine({ budget_mensuel_cents: 1_000_000, mois: couts.moisParis() });
  }
  const estimation250 = () => {
    const total = { centimes: 250, devise: "EUR" as const };
    return { lignes: [{ etape: "Essai", fournisseur: "simulation", unite: "appel" as const, quantite: 1, prixUnitaire: total, total, nature: "estime" as const }], total };
  };

  /** Estimation avec un double réel HeyGen : sa confirmation dit le prix en euros (garde R7, sous le seuil aussi). */
  const estimationDouble = (centimes: number) => {
    const total = { centimes, devise: "EUR" as const };
    return { lignes: [{ etape: "Double, angle principal", fournisseur: "heygen", unite: "seconde" as const, quantite: 1, prixUnitaire: total, total, nature: "estime" as const }], total };
  };

  it("« Réessayer » : studio = le prix du jour vaut accord, la relance part (journalisé) ; Usine = prix en euros et montant pour l'écran", async () => {
    const travailId = await travailEnEchec();
    await ecrireParametre("budget.seuilConfirmation", { centimes: 0, devise: "EUR" });
    // Studio (décision du fondateur, 08/11) : aucune confirmation, la relance part.
    const r = await travaux.reessayerTravail(travailId);
    expect(r.statut).not.toBe("echec");
    expect(JSON.stringify(await depots().evenements.lister())).toMatch(/accepté sans confirmation/);
    // Usine : confirmation toujours exigée, sur le vrai chemin « Réessayer » : le message dit le prix, l'écran reçoit le montant.
    const usineId = await travailEnEchec();
    await enUsine(usineId);
    await ecrireParametre("budget.seuilConfirmation", { centimes: 0, devise: "EUR" });
    await budgetUsineLarge();
    const errUsine = await travaux.reessayerTravail(usineId).catch((e: unknown) => e);
    expect(errUsine).toMatchObject({ code: "CONFIRMATION_REQUISE" });
    // Le message du seuil (src/services/credits.ts:345) ne cite plus le prix en euros : le prix en euros reste prouvé par le double réel plus bas.
    expect((errUsine as Error).message).toMatch(/coûte plus que d'habitude/);
    const montantUsine = (errUsine as { montant?: number }).montant;
    expect(montantUsine).toBeGreaterThan(0);
    const ecranUsine = await commun.essayer(() => travaux.reessayerTravail(usineId));
    expect(ecranUsine).toMatchObject({ ok: false, code: "CONFIRMATION_REQUISE", montant: montantUsine });
    // Garde commune, en plus : montant porté, double réel = prix en euros.
    const err = await credits.verifierBudgetEtCredits(estimation250(), undefined, "Cette vidéo", { origine: "usine" }).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "CONFIRMATION_REQUISE", montant: 250 });
    await ecrireParametre("budget.seuilConfirmation", { centimes: 1_000_000, devise: "EUR" });
    const errDouble = await credits.verifierBudgetEtCredits(estimationDouble(250), undefined, "Cette vidéo", { origine: "usine" }).catch((e: unknown) => e);
    expect(errDouble).toMatchObject({ code: "CONFIRMATION_REQUISE", montant: 250 });
    expect((errDouble as Error).message).toMatch(/2,50\s?€/);
    const ecran = await commun.essayer(() => credits.verifierBudgetEtCredits(estimationDouble(250), undefined, "Cette vidéo", { origine: "usine" }));
    expect(ecran).toMatchObject({ ok: false, code: "CONFIRMATION_REQUISE", montant: 250 });
  });

  it("montant confirmé plus bas que le prix du jour : studio = la relance part sans confirmation ; Usine = refusé (nouveau prix), montant juste : la relance part", async () => {
    const studioId = await travailEnEchec();
    await ecrireParametre("budget.seuilConfirmation", { centimes: 0, devise: "EUR" });
    const rs = await travaux.reessayerTravail(studioId);
    expect(rs.statut).not.toBe("echec");
    // Usine, vrai chemin « Réessayer ».
    const travailId = await travailEnEchec();
    await enUsine(travailId);
    await ecrireParametre("budget.seuilConfirmation", { centimes: 0, devise: "EUR" });
    await budgetUsineLarge();
    const montant = ((await travaux.reessayerTravail(travailId).catch((e: unknown) => e)) as { montant: number }).montant;
    expect(montant).toBeGreaterThan(0);
    const bas = await travaux.reessayerTravail(travailId, { confirme: montant - 1 }).catch((e: unknown) => e);
    expect(bas).toMatchObject({ code: "CONFIRMATION_REQUISE", montant });
    expect((bas as Error).message).toMatch(/Le prix a changé/);
    expect((await depots().travaux.obtenir(travailId))?.statut).toBe("echec");
    const r = await travaux.reessayerTravail(travailId, { confirme: montant });
    expect(r.statut).not.toBe("echec");
    // Garde commune, en plus.
    const total = { centimes: 250, devise: "EUR" as const };
    const basGarde = await credits.verifierBudgetEtCredits(estimation250(), 249, "Cette vidéo", { origine: "usine" }).catch((e: unknown) => e);
    expect(basGarde).toMatchObject({ code: "CONFIRMATION_REQUISE", montant: 250 });
    expect((basGarde as Error).message).toMatch(/Le prix a changé/);
    await expect(credits.verifierBudgetEtCredits({ lignes: [], total }, 250, "Cette vidéo", { origine: "usine" })).resolves.toBeUndefined();
  });

  it("au-delà du seuil : studio = accord au prix du jour ; Usine = CONFIRMATION_REQUISE avec un montant (garde commune)", async () => {
    await ecrireParametre("budget.seuilConfirmation", { centimes: 100, devise: "EUR" });
    const total = { centimes: 250, devise: "EUR" as const };
    await expect(credits.verifierBudgetEtCredits(estimation250(), false, "Cette vidéo")).resolves.toBeUndefined();
    await budgetUsineLarge();
    const err = await credits.verifierBudgetEtCredits(estimation250(), false, "Cette vidéo", { origine: "usine" }).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "CONFIRMATION_REQUISE", montant: 250 });
    expect((err as Error).message).toMatch(/coûte plus que d'habitude/);
    await expect(credits.verifierBudgetEtCredits({ lignes: [], total }, 250, "Cette vidéo", { origine: "usine" })).resolves.toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
describe("A4 (petit défaut 1) · plafond fal.ai : contrôle et réservation d'un seul tenant", () => {
  it("plafond d'une image, trois soumissions simultanées : un seul POST part", async () => {
    let posts = 0;
    vi.stubGlobal("fetch", (async (url: string | URL | Request, init?: RequestInit) => {
      if (!String(url).startsWith("https://queue.fal.run/") || init?.method !== "POST") throw new Error("réseau interdit");
      posts++;
      await new Promise((r) => setTimeout(r, 20));
      const n = posts;
      return new Response(JSON.stringify({ request_id: `r${n}`, status_url: `https://queue.fal.run/s/${n}`, response_url: `https://queue.fal.run/r/${n}` }), { status: 200 });
    }) as typeof fetch);
    const f = creerFabricationFal({ cle: "cle-fal-factice-relecture", deposer: async () => "x", plafondUsdCentimes: 4 });
    const r = await Promise.allSettled([0, 1, 2].map((i) => f.soumettre({ genre: "image", requete: "a quiet office, no people", ratio: "9:16", cleIdempotence: `k${i}` })));
    expect(posts).toBe(1);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  });

  it("une soumission refusée net rend sa place", async () => {
    let posts = 0;
    vi.stubGlobal("fetch", (async () => {
      posts++;
      return new Response("{}", { status: posts === 1 ? 422 : 200 });
    }) as unknown as typeof fetch);
    const f = creerFabricationFal({ cle: "cle-fal-factice-relecture", deposer: async () => "x", plafondUsdCentimes: 4 });
    await expect(f.soumettre({ genre: "image", requete: "a quiet office", ratio: "9:16", cleIdempotence: "k1" })).rejects.toMatchObject({ erreur: { code: "refuse" } });
    // La place n'est pas restée réservée : la suivante part (et échoue ici sur une réponse sans suivi, sans plafond atteint).
    await expect(f.soumettre({ genre: "image", requete: "a quiet office", ratio: "9:16", cleIdempotence: "k2" })).rejects.toMatchObject({ erreur: { code: "inconnu" } });
    expect(posts).toBe(2);
  });
});

/* ------------------------------------------------------------------ */
describe("Petit défaut 3 · seuil plus bas que le pire cas d'une étape d'écriture : studio = elle part ; Usine = attente claire, pas une panne", () => {
  it("studio : le seuil est un repère, l'écriture part (Claude est appelé), aucune attente « seuil »", async () => {
    await brancherClaude();
    await ecrireParametre("budget.seuilConfirmation", { centimes: 0, devise: "EUR" });
    const r = await bg.lancerGeneration({ idee: IDEES[0], reseaux: REGLAGES.reseaux, formatId: "avocat", adresse: "vous", mode: "avatar", objectif: "notoriete" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    await bg.tourBoucleGeneration();
    expect(appelsClaude.length).toBeGreaterThan(0);
    expect((await depots().generations.obtenir(r.generationId))?.statut).not.toBe("en-attente-credit");
    expect((await bg.etatEcriture(r.scriptMaitreId))?.attenteSeuil).toBeNull();
  });

  it("Usine : rien ne part, l'écriture ATTEND (« seuil ») avec une phrase claire, et reprend quand le seuil est relevé", async () => {
    await brancherClaude();
    await ecrireParametre("budget.seuilConfirmation", { centimes: 0, devise: "EUR" });
    const r = await bg.lancerGeneration({ idee: IDEES[0], reseaux: REGLAGES.reseaux, formatId: "avocat", adresse: "vous", mode: "avatar", objectif: "notoriete" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // L'origine « usine » est figée dans les options de l'écriture, comme à un vrai lancement de l'Usine.
    const cle = `generateur.chaine-options.${r.generationId}`;
    await ecrireParametre(cle, { ...(await commun.lireParametre<object>(cle, {})), origine: "usine" });
    const { reglerBudgetUsine } = await import("@/services/budget-mensuel");
    await reglerBudgetUsine({ budget_mensuel_cents: 1_000_000, mois: couts.moisParis() });
    await bg.tourBoucleGeneration();
    expect(appelsClaude).toHaveLength(0);
    const g = await depots().generations.obtenir(r.generationId);
    expect(g?.statut).toBe("en-attente-credit");
    const etat = await bg.etatEcriture(r.scriptMaitreId);
    expect(etat?.attenteSeuil).toMatch(/seuil de confirmation/);
    expect(etat?.attenteSeuil).toMatch(/Réglages/);
    // Aucune panne notée (« Claude n'a pas répondu ») : ce n'en est pas une.
    expect(await bg.ecritureArretee(r.scriptMaitreId)).toBeNull();
    // Seuil relevé : garde-fous budget (15/10), l'écriture est « prête » ; seul le geste de Will la relance.
    await ecrireParametre("budget.seuilConfirmation", { centimes: 1_000_000, devise: "EUR" });
    expect(await gc.reprendreGenerationsEnAttenteCredit()).toEqual([]);
    expect(await gc.ecriturePreteAReprendre(r.generationId)).toBe(true);
    expect(await gc.relancerEcrituresEnAttente(r.scriptMaitreId)).toContain(r.generationId);
  });
});

/* ------------------------------------------------------------------ */
describe("Petit défaut 5 · série : studio = part au prix du jour ; Usine = confirmation exigée pour le total du plan", () => {
  it("studio, total d'un autre plan (taille différente) : la série part (journal « serie-seuil »), aucune confirmation", async () => {
    await brancherClaude();
    const prix = (await bg.prixLancement()).centimes;
    await ecrireParametre("budget.seuilConfirmation", { centimes: prix, devise: "EUR" });
    const textes = IDEES.slice(0, 2);
    const r = await serie.lancerSerie(textes.map((texte) => ({ texte })), REGLAGES, "serie-relecture-taille", 100 * prix, 5);
    expect(r.plan.totalPartant.centimes).toBe(2 * prix);
    expect(await depots().generations.compter((g) => !g.estDemo)).toBeGreaterThan(0);
    expect(JSON.stringify(await depots().evenements.lister())).toMatch(/serie-seuil/);
  });

  it("Usine : le total du plan (2 écritures) au-dessus du seuil exige la confirmation, montant juste : passe", async () => {
    await brancherClaude();
    const prix = (await bg.prixLancement()).centimes;
    await ecrireParametre("budget.seuilConfirmation", { centimes: prix, devise: "EUR" });
    const { reglerBudgetUsine } = await import("@/services/budget-mensuel");
    await reglerBudgetUsine({ budget_mensuel_cents: 1_000_000, mois: couts.moisParis() });
    const total = { centimes: 2 * prix, devise: "EUR" as const };
    const estimation = { lignes: [{ etape: "Écriture", fournisseur: "simulation", unite: "appel" as const, quantite: 2, prixUnitaire: { centimes: prix, devise: "EUR" as const }, total, nature: "estime" as const }], total };
    await expect(credits.verifierBudgetEtCredits(estimation, undefined, "Ces 2 écritures", { origine: "usine" })).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE", montant: 2 * prix });
    await expect(credits.verifierBudgetEtCredits(estimation, 2 * prix - 1, "Ces 2 écritures", { origine: "usine" })).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE", montant: 2 * prix });
    await expect(credits.verifierBudgetEtCredits(estimation, 2 * prix, "Ces 2 écritures", { origine: "usine" })).resolves.toBeUndefined();
  });
});
