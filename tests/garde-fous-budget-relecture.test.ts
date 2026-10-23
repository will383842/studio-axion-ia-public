/**
 * GARDE-FOUS BUDGET · correctif après la relecture d'exactitude (refus, 15/10). Faux `fetch`, aucune clé réelle, 0 €.
 * Rien n'est neutralisé ici : ni le pire cas de la chaîne, ni le contrôle appel par appel du plafond.
 *  1. Pire cas PRUDENT (entrée au prix normal, une écriture du socle en cache par rôle, sorties à `maxTokens`), selon la
 *     chaîne utilisée (`pireCasChaine("courte" | "grande", …)`) ; plafond lu des réglages `generateur.plafondSujetUsd` et
 *     `generateur.plafondGrandeChaineUsd` (défaut 1,50 $) ; refus avant le 1er appel avec le chiffre et le réglage.
 *  2. Écriture déjà en route sans réserve : jamais arrêtée au début d'un tour, contrôle appel par appel comme avant.
 *     « Reprendre (≈ X €) » ne montre jamais un prix puis un refus ; un bouton aussi pour « plafond-atteint ».
 *  3. Réserve recalculée à chaque reprise ou retour en arrière, dépense déjà faite comprise.
 *  5. Prix de « Reprendre » = ce qui reste vraiment à dépenser, borné par le plafond ; confirmé par le serveur.
 *  7. De bout en bout, plafond PAR DÉFAUT : refus AVANT le 1er appel (grande chaîne) ou fin sans arrêt (chaîne courte) ;
 *     et, plafond relevé au pire cas, la grande chaîne facturée au pire va au bout.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, reponseFlux, fluxReussi } from "./helpers/g0";
import { etapeZeroBanc, TOURNURES_G4 } from "./helpers/g4";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const bg = await import("@/services/boucle-generation");
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { ROLES_ECRITURE } = await import("@/generateur/roles");
const { ROLES_CHAINE_COURTE, ROLES_CHAINE_COURTE_HORS_RECETTE, executerChaineCourte } = await import("@/generateur/chaine-courte");
const { pireCasChaine } = await import("@/generateur/pire-cas");
const { jetonsEstimes } = await import("@/fournisseurs/claude/tarifs");
import type { z } from "zod";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import type { ExecuteurRoles, SortieExecution } from "@/generateur/chaine";
import type { GenerationScript } from "@/domaine/types";

const MDP = "essai-garde-fous-relecture";
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
  await credits.declarerRecharge("anthropic", 100_000);
  await ecrireParametre("fournisseur.script", "claude");
  // Lot A5 : réglage absent = chaîne courte ; ce fichier éprouve les garde-fous de la GRANDE chaîne, il la demande donc expressément.
  (await import("@/services/generation-claude")).forcerChainePourEssai("grande");
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
  bg.arreterBoucleGeneration();
  vi.unstubAllEnvs();
});

const lancer = (i: number) => bg.lancerGeneration({ idee: SUJETS_BANC[i].idee, reseaux: [...SUJETS_BANC[i].reseaux], formatId: "avocat", pilier: SUJETS_BANC[i].pilier.id, mode: "avatar" as const });

/**
 * Faux Claude FACTURÉ AU PIRE : reconnaît le rôle par sa consigne, répond par sa simulation, mais chaque appel est
 * facturé avec toute son entrée (1 jeton pour 3 caractères du corps envoyé, JSON compris), le socle écrit en cache au
 * premier appel de chaque rôle (jamais lu ensuite), et `maxTokens` jetons de sortie.
 */
function claudeAuPire(roles: DefinitionRole[]) {
  const appels: string[] = [];
  const vus = new Set<string>();
  const f = (async (_url: string | URL | Request, init?: RequestInit) => {
    const brut = String(init?.body ?? "{}");
    const corps = JSON.parse(brut) as { system: { text: string; cache_control?: unknown }[]; messages: { content: string }[] };
    const consigne = corps.system.at(-1)!.text;
    const role = roles.find((r) => consigne.startsWith(r.consigne.trim()))!;
    appels.push(role.id);
    const bloc = (b: string) => corps.system.find((x) => x.text.startsWith(`<${b}>`))?.text.replace(new RegExp(`^<${b}>\\n|\\n</${b}>$`, "g"), "");
    const sortie = role.simuler({ contexte: { contexteAxion: bloc("contexte_axion"), styleWill: bloc("style_will"), preuves: bloc("preuves"), gagnants: bloc("gagnants") }, variable: corps.messages[0].content });
    const total = jetonsEstimes(brut);
    const socle = vus.has(role.id) ? 0 : jetonsEstimes(corps.system.filter((b) => b.cache_control).map((b) => b.text).join("\n"));
    vus.add(role.id);
    return reponseFlux(fluxReussi({ texte: typeof sortie === "string" ? sortie : JSON.stringify(sortie), modele: role.modele, entree: total - socle, cacheEcrit: socle, cacheLu: 0, sortie: role.maxTokens }));
  }) as typeof fetch;
  return { fetch: f, appels };
}

const generation = async (id: string) => (await depots().generations.obtenir(id))!;

describe("1 · pire cas prudent, selon la chaîne, plafond lu des réglages", () => {
  const z = etapeZeroBanc(SUJETS_BANC[0]);
  if (!z.ok) throw new Error("étape 0");
  const o = { donnees: z.donnees, options: { tournures: TOURNURES_G4 } };

  it("chaque appel : entrée au prix NORMAL + maxTokens ; le socle écrit en cache une fois par rôle (plus à chaque appel)", () => {
    for (const chaine of ["grande", "courte"] as const) {
      const p = pireCasChaine(chaine, o);
      const prix = (m: string) => (m.includes("opus") ? { e: 4, s: 20 } : { e: 2, s: 10 });
      const appels = p.detail.reduce((t, x) => t + x.appels * ((x.jetonsEntree * prix(x.modele).e + x.maxTokens * prix(x.modele).s) / 1e6), 0);
      expect(p.usd).toBeCloseTo(appels + p.ecritureCacheUsd + p.margeEnVolUsd, 9);
      // L'ancien calcul (toute l'entrée au prix d'écriture en cache, à chaque appel) était plus haut.
      const ancien = p.detail.reduce((t, x) => t + x.appels * ((x.jetonsEntree * prix(x.modele).e * 1.25 + x.maxTokens * prix(x.modele).s) / 1e6), 0);
      expect(p.usd).toBeLessThan(ancien);
      // Une écriture du socle par rôle : bien moins que 0,25 × l'entrée de chaque appel.
      expect(p.ecritureCacheUsd).toBeGreaterThan(0);
      expect(p.ecritureCacheUsd).toBeLessThan(ancien - appels);
    }
  });

  it("chaîne courte : 3 appels, sous 1,50 $ ; grande chaîne : au-dessus (refusée par défaut)", () => {
    const courte = pireCasChaine("courte", o);
    expect(courte.detail.map((x) => x.role)).toEqual(["court-angle", "court-script", "court-relecture"]);
    expect(courte.appels).toBe(3);
    // Au moins les sorties maximales : 8 000 + 16 000 jetons Opus, 6 000 jetons Sonnet.
    expect(courte.usd).toBeGreaterThanOrEqual((8000 + 16000) * 20e-6 + 6000 * 10e-6);
    expect(courte.usd).toBeLessThan(1.5);
    expect(pireCasChaine("grande", o).usd).toBeGreaterThan(1.5);
  });

  it("des déclinaisons parties ensemble comptent la marge des appels en vol", () => {
    expect(pireCasChaine("grande", o).margeEnVolUsd).toBeGreaterThan(0);
  });

  it("retour à l'étape 3 (accroches rechoisies) : le tri des accroches (étape 4) est recompté", () => {
    const etat = { version: 1 as const, etape: 6, coutUsd: 0, journal: [], finalistes: [{ id: "acc-1" }] as never, choixWill: { accrocheIds: ["acc-2"] } };
    const p = pireCasChaine("grande", { ...o, etatDepart: etat });
    expect(p.detail.some((x) => x.etape === 4 && x.role === "juge")).toBe(true);
    const sansChoix = pireCasChaine("grande", { ...o, etatDepart: { ...etat, choixWill: undefined } });
    expect(sansChoix.detail.some((x) => x.etape === 4)).toBe(false);
  });

  it("plafond du sujet lu du réglage (défaut 1,50 $) ; aucun plafond monté en dur", async () => {
    expect(await gc.plafondChaineUsd("grande")).toBe(1.5);
    expect(await gc.plafondChaineUsd("courte")).toBe(1.5);
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, 6);
    await ecrireParametre(gc.PARAM_PLAFOND_SUJET, 0.9);
    expect(await gc.plafondChaineUsd("grande")).toBe(6);
    expect(await gc.plafondChaineUsd("courte")).toBe(0.9);
    // La grande chaîne écrit aujourd'hui : le lancement prend son plafond.
    const r = await lancer(0);
    if (!r.ok) throw new Error("lancement");
    expect((await generation(r.generationId)).plafondUsd).toBe(6);
  });
});

describe("7 · de bout en bout, plafond PAR DÉFAUT (rien neutralisé)", () => {
  it("grande chaîne facturée au pire : refusée AVANT le 1er appel, message avec le chiffre et le réglage à changer", async () => {
    const claude = claudeAuPire(Object.values(ROLES_ECRITURE) as DefinitionRole[]);
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: claude.fetch, attenteMs: () => 0 });
    const r = await lancer(0);
    if (!r.ok) throw new Error("lancement");
    expect((await generation(r.generationId)).plafondUsd).toBe(1.5);
    expect(await bg.tourBoucleGeneration()).toBe(r.generationId);
    expect(claude.appels).toHaveLength(0);
    expect((await generation(r.generationId)).statut).toBe("plafond-atteint");
    const reserve = (await gc.lireReserveChaine(r.generationId))!;
    expect(reserve).toMatchObject({ accepte: false, plafondUsd: 1.5, chaine: "grande", reglage: "generateur.plafondGrandeChaineUsd", depenseUsd: 0 });
    const e = await bg.etatEcriture(r.scriptMaitreId);
    expect(e?.messagePlafond).toMatch(/jusqu'à \d+,\d\d \$ \(.*€\), plus que le plafond de 1,50 \$ par sujet : rien n'est parti\. Pour l'écrire, relevez le réglage « generateur\.plafondGrandeChaineUsd » à \d+,\d\d \$ au moins\./);
    // Le bouton dit pourquoi au lieu d'un prix ; le geste ne change rien.
    expect(e?.reprise).toMatchObject({ possible: false });
    expect(e?.reprise?.raison).toMatch(/generateur\.plafondGrandeChaineUsd/);
    await expect(bg.reprendreEcriture(r.scriptMaitreId, 100_000)).rejects.toMatchObject({ code: "REPRISE_IMPOSSIBLE" });
    expect((await generation(r.generationId)).statut).toBe("plafond-atteint");
    expect(claude.appels).toHaveLength(0);
  });

  it("chaîne courte facturée au pire, plafond du sujet par défaut : réservée, elle va au bout sans arrêt (3 appels)", async () => {
    const claude = claudeAuPire([...Object.values(ROLES_CHAINE_COURTE), ...Object.values(ROLES_CHAINE_COURTE_HORS_RECETTE)] as DefinitionRole[]);
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: claude.fetch, attenteMs: () => 0 });
    const z = etapeZeroBanc(SUJETS_BANC[0]);
    if (!z.ok) throw new Error("étape 0");
    const le = new Date().toISOString();
    const g: GenerationScript = { id: "gen-courte", scriptMaitreId: "suj-courte", hachageContexte: "h", plafondUsd: await gc.plafondChaineUsd("courte"), portee: "sujet", etapes: [], statut: "en-cours", essai: false, creeLe: le, modifieLe: le };
    await depots().generations.enregistrer(g);
    const pire = pireCasChaine("courte", { donnees: z.donnees, options: { tournures: TOURNURES_G4 } });
    expect(await gc.reserverPireCasChaine(g.id, { pireCasRestantUsd: pire.usd, chaine: "courte" })).toEqual({ ok: true });
    const r = await executerChaineCourte(z.donnees, { executer: (role, e) => gc.executerRoleFacture(g.id, role, e) }, { tournures: TOURNURES_G4 });
    expect(r.statut).toBe("terminee");
    expect(claude.appels).toEqual(["court-angle", "court-script", "court-relecture"]);
    const fin = await generation(g.id);
    expect(fin.statut).toBe("en-cours");
    const depense = gc.depenseGenerationUsd(fin);
    expect(depense).toBeGreaterThan(0);
    expect(depense).toBeLessThanOrEqual(pire.usd);
    expect(pire.usd).toBeLessThanOrEqual(1.5);
  });

  it("face caméra : chaîne courte facturée au pire, plafond du sujet par défaut : réservée, elle va au bout sans arrêt (3 appels)", async () => {
    const claude = claudeAuPire([...Object.values(ROLES_CHAINE_COURTE), ...Object.values(ROLES_CHAINE_COURTE_HORS_RECETTE)] as DefinitionRole[]);
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: claude.fetch, attenteMs: () => 0 });
    const z = etapeZeroBanc(SUJETS_BANC[0], undefined, { formatId: "facecam" });
    if (!z.ok) throw new Error("étape 0");
    const le = new Date().toISOString();
    const g: GenerationScript = { id: "gen-courte-fc", scriptMaitreId: "suj-courte-fc", hachageContexte: "h", plafondUsd: await gc.plafondChaineUsd("courte"), portee: "sujet", etapes: [], statut: "en-cours", essai: false, creeLe: le, modifieLe: le };
    await depots().generations.enregistrer(g);
    const pire = pireCasChaine("courte", { donnees: z.donnees, options: { tournures: TOURNURES_G4 } });
    expect(await gc.reserverPireCasChaine(g.id, { pireCasRestantUsd: pire.usd, chaine: "courte" })).toEqual({ ok: true });
    const r = await executerChaineCourte(z.donnees, { executer: (role, e) => gc.executerRoleFacture(g.id, role, e) }, { tournures: TOURNURES_G4 });
    expect(r.statut).toBe("terminee");
    expect(claude.appels).toEqual(["court-angle", "court-script", "court-relecture"]);
    const fin = await generation(g.id);
    expect(fin.statut).toBe("en-cours");
    const depense = gc.depenseGenerationUsd(fin);
    expect(depense).toBeGreaterThan(0);
    expect(depense).toBeLessThanOrEqual(pire.usd);
    expect(pire.usd).toBeLessThanOrEqual(1.5);
  });

  it("grande chaîne : Will relève le réglage au chiffre annoncé, « Reprendre (≈ X €) » confirmé, la chaîne facturée au pire va au bout", async () => {
    const claude = claudeAuPire(Object.values(ROLES_ECRITURE) as DefinitionRole[]);
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: claude.fetch, attenteMs: () => 0 });
    const r = await lancer(0);
    if (!r.ok) throw new Error("lancement");
    await bg.tourBoucleGeneration();
    const refus = (await gc.lireReserveChaine(r.generationId))!;
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, Math.ceil(refus.pireCasUsd * 100) / 100);
    const e = await bg.etatEcriture(r.scriptMaitreId);
    expect(e?.reprise).toMatchObject({ possible: true });
    expect(e!.reprise!.prixUsd).toBeCloseTo(refus.pireCasUsd, 6);
    // Le serveur fait confirmer le prix : sans accord, ou plus bas, il le redemande.
    await expect(bg.reprendreEcriture(r.scriptMaitreId)).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    const err = await bg.reprendreEcriture(r.scriptMaitreId, 1).catch((x) => x);
    expect(err).toMatchObject({ code: "CONFIRMATION_REQUISE" });
    expect((await generation(r.generationId)).statut).toBe("plafond-atteint");
    expect(await bg.reprendreEcriture(r.scriptMaitreId, err.montant)).toBe(1);
    expect((await generation(r.generationId)).plafondUsd).toBeCloseTo(Math.ceil(refus.pireCasUsd * 100) / 100, 6);
    expect(await bg.tourBoucleGeneration()).toBe(r.generationId);
    const fin = await generation(r.generationId);
    expect(fin.statut).toBe("terminee");
    expect(claude.appels.length).toBeGreaterThan(10);
    expect(gc.depenseGenerationUsd(fin)).toBeLessThanOrEqual(refus.pireCasUsd);
    expect(await gc.lireReserveChaine(r.generationId)).toMatchObject({ accepte: true });
  }, 60_000);
});

describe("2 · écritures déjà en route sans réserve, et « Reprendre » qui ne ment jamais", () => {
  it("écriture en route avant la mise en ligne (une étape payée, aucune réserve) : jamais arrêtée par la réserve, elle continue appel par appel", async () => {
    const claude = claudeAuPire(Object.values(ROLES_ECRITURE) as DefinitionRole[]);
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: claude.fetch, attenteMs: () => 0 });
    const r = await lancer(0);
    if (!r.ok) throw new Error("lancement");
    const le = new Date().toISOString();
    await depots().generations.modifier(r.generationId, { etapes: [{ role: "stratege", versionConsigne: 1, modeleDemande: "claude-opus-5-5", effort: "high", appelId: "a-avant", lanceLe: le, termineLe: le, estimationPireCasUsd: 0.3, modeleEffectif: "claude-opus-5-5", jetons: { entree: 1000, cacheLu: 0, cacheEcrit: 0, sortie: 500 }, resultat: "ok" }] });
    expect(await gc.ecritureSansReserve(await generation(r.generationId))).toBe(true);
    await bg.tourBoucleGeneration();
    // Des appels sont partis (aucun refus avant le premier), aucune réserve n'a été posée.
    expect(claude.appels.length).toBeGreaterThan(0);
    expect(await gc.lireReserveChaine(r.generationId)).toBeNull();
    // Facturée au pire, elle finit au plafond (ancien contrôle appel par appel), jamais par un refus de réserve.
    const g = await generation(r.generationId);
    expect(["terminee", "plafond-atteint"]).toContain(g.statut);
    expect(gc.depenseGenerationUsd(g)).toBeLessThanOrEqual(1.5 + 1e-9);
    // Au plafond, « Reprendre » dit pourquoi au lieu d'un prix.
    if (g.statut === "plafond-atteint") {
      const e = await bg.etatEcriture(r.scriptMaitreId);
      expect(e?.reprise?.possible).toBe(false);
      expect(e?.reprise?.raison).toMatch(/Plafond de l'écriture atteint.*generateur\.plafondGrandeChaineUsd/);
    }
  }, 60_000);

  it("en attente de crédit, empêchement pas levé : le bouton dit pourquoi, le geste ne demande aucun prix", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", CLE_ESSAI_CLAUDE); // un compte d'abonnement utilisable (sans compte : « Aucun compte Claude actif »)
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fetchInterdit, attenteMs: () => 0 });
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, 20);
    await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, 0);
    const r = await lancer(0);
    if (!r.ok) throw new Error("lancement");
    await bg.tourBoucleGeneration();
    expect((await generation(r.generationId)).statut).toBe("en-attente-credit");
    const e = await bg.etatEcriture(r.scriptMaitreId);
    expect(e?.reprise).toMatchObject({ possible: false });
    // Comptes d'abonnement (défaut) : on attend leur renouvellement, on ne « recharge » pas ; mode api : « rechargez Claude ».
    expect(e?.reprise?.raison).toMatch(/renouvellement des comptes Claude/);
    expect(e?.reprise?.raison).not.toMatch(/rechargez/);
    await expect(bg.reprendreEcriture(r.scriptMaitreId, 100_000)).rejects.toMatchObject({ code: "TOUJOURS_BLOQUEE" });
    // Limite relevée : le prix est montré, puis confirmé.
    await gc.definirPlafondMensuelClaude(100);
    const e2 = await bg.etatEcriture(r.scriptMaitreId);
    expect(e2?.reprise).toMatchObject({ possible: true });
    expect(e2!.reprise!.prixUsd).toBeGreaterThan(0);
    expect(e2!.reprise!.prixUsd).toBeLessThanOrEqual(20);
    await expect(bg.reprendreEcriture(r.scriptMaitreId)).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    expect(await bg.reprendreEcriture(r.scriptMaitreId, 100_000)).toBe(1);
    expect((await generation(r.generationId)).statut).toBe("en-cours");
  });
});

describe("3 et 5 · réserve recalculée à chaque reprise, prix de ce qui reste vraiment", () => {
  it("chaque tour recalcule la réserve depuis l'état de départ (retour à l'étape 3 compris), dépense déjà faite comprise", async () => {
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fetchInterdit, attenteMs: () => 0 });
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, 20);
    const r = await lancer(0);
    if (!r.ok) throw new Error("lancement");
    // Une reprise : l'état est à l'étape 6, Will a rechoisi ses accroches (retour à l'étape 3), 0,8 $ déjà dépensés.
    const le = new Date().toISOString();
    await ecrireParametre(`generateur.chaine.${r.generationId}`, { version: 1, etape: 6, coutUsd: 0.8, journal: [], finalistes: [{ id: "acc-1" }], choixWill: { accrocheIds: ["acc-2"] } });
    await depots().generations.modifier(r.generationId, { etapes: [{ role: "stratege", versionConsigne: 1, modeleDemande: "claude-opus-5-5", effort: "high", appelId: "a1", lanceLe: le, termineLe: le, estimationPireCasUsd: 0.3, modeleEffectif: "claude-opus-5-5", jetons: { entree: 0, cacheLu: 0, cacheEcrit: 0, sortie: 40_000 }, resultat: "ok" }] });
    await ecrireParametre(`generateur.reserveChaine.${r.generationId}`, { pireCasUsd: 1, depenseUsd: 0, plafondUsd: 20, accepte: true, etape: 0, le });
    // L'exécutant facturé ne part pas (fetch interdit) : seule la réserve du tour compte ici.
    await bg.tourBoucleGeneration().catch(() => undefined);
    const reserve = (await gc.lireReserveChaine(r.generationId))!;
    expect(reserve.etape).toBe(3);
    expect(reserve.depenseUsd).toBeCloseTo(0.8, 6);
    expect(reserve.pireCasUsd).toBeGreaterThan(reserve.depenseUsd + 1);
  });

  it("reprise après une réponse coupée : si ce qui est dépensé + le pire cas restant dépasse le plafond, le bouton dit pourquoi", async () => {
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fetchInterdit, attenteMs: () => 0 });
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, 6);
    const r = await lancer(0);
    if (!r.ok) throw new Error("lancement");
    // Écriture réservée au lancement ; le stratège répond, la réponse du fond est coupée (`max_tokens`).
    const le = new Date().toISOString();
    await ecrireParametre(`generateur.reserveChaine.${r.generationId}`, { pireCasUsd: 4, depenseUsd: 0, plafondUsd: 6, accepte: true, etape: 0, le });
    const coupe = (): ExecuteurRoles => ({
      async executer<S extends z.ZodType>(role: DefinitionRole<S>, e: EntreeRole): Promise<SortieExecution<z.infer<S>>> {
        if (role.id === "fond") return { ok: true, texte: "{coupé", invalide: "JSON illisible", coutUsd: 0.17, modele: "claude-opus-5-5", stopReason: "max_tokens" };
        return { ok: true, donnees: role.simuler(e) as z.infer<S>, coutUsd: 0, modele: "simulation", stopReason: "end_turn" };
      },
    });
    await bg.tourBoucleGeneration(coupe);
    expect((await generation(r.generationId)).statut).toBe("echec");
    // Étapes rejouées : 5,90 $ déjà comptés.
    await depots().generations.modifier(r.generationId, { etapes: [...(await generation(r.generationId)).etapes, { role: "fond", versionConsigne: 1, modeleDemande: "claude-opus-5-5", effort: "high", appelId: "a-fond", lanceLe: le, termineLe: le, estimationPireCasUsd: 1, modeleEffectif: "claude-opus-5-5", jetons: { entree: 0, cacheLu: 0, cacheEcrit: 0, sortie: 295_000 }, resultat: "coupe" }] });
    const a = await bg.ecritureArretee(r.scriptMaitreId);
    expect(a?.bloque).toMatch(/plus que le plafond de 6,00 \$ par sujet : elle ne peut pas reprendre\. Pour l'écrire, relevez le réglage « generateur\.plafondGrandeChaineUsd »/);
    await expect(bg.reprendreEcritureArretee(r.scriptMaitreId)).rejects.toMatchObject({ code: "REPRISE_IMPOSSIBLE" });
    expect((await generation(r.generationId)).statut).toBe("echec");
    // Réglage relevé : la reprise peut partir, au prix montré et confirmé (re-relecture A09 : plafond relevé au réglage).
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, 20);
    const apres = await bg.ecritureArretee(r.scriptMaitreId);
    expect(apres?.bloque).toBeUndefined();
    await expect(bg.reprendreEcritureArretee(r.scriptMaitreId)).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    expect(await bg.reprendreEcritureArretee(r.scriptMaitreId, apres?.supplement?.centimes)).toBe(true);
    expect((await generation(r.generationId)).plafondUsd).toBe(20);
  }, 30_000);

  it("prix de « Reprendre » : le pire cas de ce qui reste (pas 0, même si la dépense a dépassé la réserve), borné par le plafond", async () => {
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fetchInterdit, attenteMs: () => 0 });
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, 20);
    await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, 0);
    const r = await lancer(0);
    if (!r.ok) throw new Error("lancement");
    await bg.tourBoucleGeneration();
    const reserve = (await gc.lireReserveChaine(r.generationId))!;
    // Étapes rejouées : 9 $ déjà comptés, bien au-delà du pire cas réservé.
    const le = new Date().toISOString();
    await depots().generations.modifier(r.generationId, { etapes: [{ role: "stratege", versionConsigne: 1, modeleDemande: "claude-opus-5-5", effort: "high", appelId: "a1", lanceLe: le, estimationPireCasUsd: 9 }] });
    await gc.definirPlafondMensuelClaude(100);
    const e = await bg.etatEcriture(r.scriptMaitreId);
    expect(e?.reprise).toMatchObject({ possible: true });
    // Ce qui reste à écrire (le pire cas recalculé), pas « plafond − dépensé », pas 0.
    expect(e!.reprise!.prixUsd).toBeCloseTo(reserve.pireCasUsd, 6);
    expect(e!.reprise!.prixUsd).toBeLessThanOrEqual(20 - 9);
  });

  it("le crochet d'essai du pire cas a quitté le code de production ; plus de « 3e essai » ni de reprise « toute seule »", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("src/services/generation-claude.ts", "utf8")).not.toMatch(/injecterPireCasChainePourEssai|cleInjectionPireCas/);
    const bgSource = readFileSync("src/services/boucle-generation.ts", "utf8");
    expect(bgSource).not.toMatch(/3e essai|Au 3e échec|le 3e arrête/);
    expect(bgSource).not.toMatch(/reprendra toute seule|reprendra tout seul/);
  });
});

describe("Re-relecture A09 · même règle pour les deux « Reprendre », série au plafond du réglage", () => {
  it("« Reprendre l'écriture » (panne) qui relève le plafond au réglage : le prix est montré et DOIT être confirmé", async () => {
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fetchInterdit, attenteMs: () => 0 });
    const r = await lancer(0);
    if (!r.ok) throw new Error("lancement");
    await depots().generations.modifier(r.generationId, { statut: "echec" });
    await ecrireParametre(`generateur.panne.${r.generationId}`, { essais: 1, code: "CLAUDE_INDISPONIBLE", message: "Claude n'a pas répondu.", le: new Date().toISOString(), prochainEssai: new Date().toISOString(), arretee: true });
    // Will relève le réglage (pour un autre sujet) : la reprise de celui-ci pourrait dépenser jusqu'au nouveau plafond.
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, 100);
    const arret = await bg.ecritureArretee(r.scriptMaitreId);
    expect(arret?.supplement?.centimes).toBeGreaterThan(0);
    await expect(bg.reprendreEcritureArretee(r.scriptMaitreId)).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE", montant: arret!.supplement!.centimes });
    expect((await depots().generations.obtenir(r.generationId))?.plafondUsd).toBe(1.5);
    expect(await bg.reprendreEcritureArretee(r.scriptMaitreId, arret!.supplement!.centimes)).toBe(true);
    expect((await depots().generations.obtenir(r.generationId))?.plafondUsd).toBe(100);
    }, 30_000);

  it("série : la limite du mois est comptée au plafond du RÉGLAGE, pas à 1,50 $ en dur", async () => {
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fetchInterdit, attenteMs: () => 0 });
    const serie = await import("@/services/serie-ecriture");
    await ecrireParametre("budget.mensuel", { centimes: 1_000_000, devise: "EUR" });
    await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, 10);
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, 4.88);
    await ecrireParametre(gc.PARAM_PLAFOND_SUJET, 4.88);
    const plan = await serie.planSerie(5);
    expect(plan.essai).toBe(false);
    expect(plan.partiront).toBeLessThanOrEqual(Math.floor(10 / 4.88));
  });
});

describe("Re-relecture A09 (PR #254) · une seule source pour le plafond d'un sujet : le réglage de la chaîne", () => {
  it("série : le plafond compté est celui de la chaîne qui écrira (grande ou courte), jamais l'autre réglage", async () => {
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fetchInterdit, attenteMs: () => 0 });
    const serie = await import("@/services/serie-ecriture");
    await ecrireParametre("budget.mensuel", { centimes: 1_000_000, devise: "EUR" });
    await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, 10);
    // Grande chaîne (forcée par le crochet d'essai du beforeEach) : seul son réglage est relevé.
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, 4.88);
    expect((await serie.planSerie(5)).partiront).toBe(Math.floor(10 / 4.88));
    // Chaîne courte : c'est le réglage du sujet qui compte.
    gc.forcerChainePourEssai(null);
    await ecrireParametre(bg.PARAM_CHAINE, "courte");
    await ecrireParametre(gc.PARAM_PLAFOND_SUJET, 2.4);
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, 4.88);
    // 10 / 2,4 donne 4 ; 10 / 4,88 donnerait 2 : seul le réglage du sujet (courte) compte.
    expect((await serie.planSerie(5)).partiront).toBe(Math.floor(10 / 2.4));
  });

  it("aucune valeur 1,50 $ retapée : le plafond par défaut d'un sujet a une seule source", async () => {
    const gen = await import("@/services/generateur");
    expect(gen.PLAFOND_SUJET_USD).toBe(gc.PLAFOND_PAR_DEFAUT_USD);
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("src/services/generateur.ts", "utf8")).not.toMatch(/PLAFOND_SUJET_USD = 1\.5/);
    expect(readFileSync("src/services/serie-ecriture.ts", "utf8")).not.toMatch(/plafondChaineUsd\(chaineDeLEcriture\(\)\)/);
  });

  it("écriture simulée : son plafond est lu du réglage de la chaîne, comme une écriture payante", async () => {
    await ecrireParametre("fournisseur.script", "simulation");
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, 2.75);
    const gen = await import("@/services/generateur");
    const r = await gen.creerEtEcrireSujet({ idee: SUJETS_BANC[0].idee, reseaux: [...SUJETS_BANC[0].reseaux], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" } as never);
    const m = (await depots().scriptsMaitres.obtenir(r.scriptMaitreId))!;
    expect((await generation(m.generationId!)).plafondUsd).toBe(2.75);
  });
});
