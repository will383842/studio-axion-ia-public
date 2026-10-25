/**
 * Budget INDICATIF — écriture : reprise, arrêt de sécurité et origine (suite de la relecture de #607). Faux `fetch`, 0 €.
 * Écritures de bout en bout (`deroulerGeneration` via la boucle), grande chaîne facturée au pire.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, reponseErreur, reponseFlux, fluxReussi } from "./helpers/g0";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const bg = await import("@/services/boucle-generation");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { ROLES_ECRITURE } = await import("@/generateur/roles");
const { jetonsEstimes } = await import("@/fournisseurs/claude/tarifs");
import type { DefinitionRole } from "@/generateur/roles/types";

const MDP = "essai-budget-indicatif-reprise";
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
  gc.forcerChainePourEssai("grande");
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
  bg.arreterBoucleGeneration();
  vi.unstubAllEnvs();
});

const lancer = (i: number) => bg.lancerGeneration({ idee: SUJETS_BANC[i].idee, reseaux: [...SUJETS_BANC[i].reseaux], formatId: "avocat", pilier: SUJETS_BANC[i].pilier.id, mode: "avatar" as const });

/** Faux Claude facturé au pire (même principe que garde-fous-budget-relecture). */
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
const claude = () => {
  const c = claudeAuPire(Object.values(ROLES_ECRITURE) as DefinitionRole[]);
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: c.fetch, attenteMs: () => 0 });
  return c;
};

/** Pire cas de la grande chaîne, lu d'une écriture refusée en mode bloquant (plafond par défaut), puis close. */
async function pireCasDeLaGrandeChaine(): Promise<number> {
  claude();
  await ecrireParametre("budget.mode", "bloquant");
  const r = await lancer(0);
  if (!r.ok) throw new Error("lancement");
  await bg.tourBoucleGeneration();
  const pire = (await gc.lireReserveChaine(r.generationId))!.pireCasUsd;
  await depots().generations.modifier(r.generationId, { statut: "echec" });
  return pire;
}
const faireUsine = async (generationId: string) => {
  const cle = `generateur.chaine-options.${generationId}`;
  await ecrireParametre(cle, { ...((await lireParametre<object>(cle, {})) ?? {}), origine: "usine" });
};
const entre = (pire: number, diviseur: number) => Math.ceil((pire / diviseur) * 100) / 100;

describe("de bout en bout : plafond du sujet, mode indicatif", () => {
  it("pire cas entre 1 × et 5 × le plafond : l'écriture PART (bloquant : refusée avant le 1er appel)", async () => {
    const pire = await pireCasDeLaGrandeChaine();
    expect(pire).toBeGreaterThan(1.5);
    const c = claude();
    await ecrireParametre("budget.mode", "bloquant");
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, entre(pire, 3));
    const b = await lancer(1);
    if (!b.ok) throw new Error("lancement");
    await bg.tourBoucleGeneration();
    expect((await generation(b.generationId)).statut).toBe("plafond-atteint");
    expect(c.appels).toHaveLength(0);
    await ecrireParametre("budget.mode", "indicatif");
    const r = await lancer(2);
    if (!r.ok) throw new Error("lancement");
    await bg.tourBoucleGeneration();
    expect(c.appels.length).toBeGreaterThan(0);
    expect((await generation(r.generationId)).statut).not.toBe("plafond-atteint");
  }, 90_000);

  it("commande de l'USINE : le même dépassement reste BLOQUÉ, aucun appel", async () => {
    const pire = await pireCasDeLaGrandeChaine();
    const c = claude();
    await ecrireParametre("budget.mode", "indicatif");
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, entre(pire, 3));
    const r = await lancer(2);
    if (!r.ok) throw new Error("lancement");
    await faireUsine(r.generationId);
    await bg.tourBoucleGeneration();
    expect((await generation(r.generationId)).statut).toBe("plafond-atteint");
    expect(c.appels).toHaveLength(0);
  }, 90_000);

  it("au-delà de 5 × : indicatif, l'écriture PART quand même (plus d'arrêt de sécurité) ; bloquant, elle est refusée", async () => {
    const pire = await pireCasDeLaGrandeChaine();
    const c = claude();
    await ecrireParametre("budget.mode", "bloquant");
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, Math.floor((pire / 8) * 100) / 100);
    const b = await lancer(1);
    if (!b.ok) throw new Error("lancement");
    await bg.tourBoucleGeneration();
    expect(c.appels).toHaveLength(0);
    expect((await generation(b.generationId)).statut).toBe("plafond-atteint");
    await ecrireParametre("budget.mode", "indicatif");
    const r = await lancer(2);
    if (!r.ok) throw new Error("lancement");
    await bg.tourBoucleGeneration();
    expect(c.appels.length).toBeGreaterThan(0);
    expect((await generation(r.generationId)).statut).not.toBe("plafond-atteint");
  }, 90_000);

  it("« Reprendre » en indicatif : devis possible entre 1 × et 5 ×, geste confirmé, l'écriture repart", async () => {
    const pire = await pireCasDeLaGrandeChaine();
    const c = claude();
    await ecrireParametre("budget.mode", "bloquant");
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, Math.floor((pire / 8) * 100) / 100);
    const r = await lancer(2);
    if (!r.ok) throw new Error("lancement");
    await bg.tourBoucleGeneration();
    expect((await generation(r.generationId)).statut).toBe("plafond-atteint");
    await ecrireParametre("budget.mode", "indicatif");
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, entre(pire, 3));
    const e = await bg.etatEcriture(r.scriptMaitreId);
    expect(e?.reprise).toMatchObject({ possible: true });
    const err = await bg.reprendreEcriture(r.scriptMaitreId).catch((x) => x);
    expect(err).toMatchObject({ code: "CONFIRMATION_REQUISE" });
    expect(await bg.reprendreEcriture(r.scriptMaitreId, err.montant)).toBe(1);
    await bg.tourBoucleGeneration();
    expect(c.appels.length).toBeGreaterThan(0);
    expect((await generation(r.generationId)).statut).not.toBe("plafond-atteint");
  }, 90_000);

  it("« Reprendre » en indicatif sans relever le plafond (pire/8, bien au-delà de 5 ×) : la reprise reste possible, jamais plafonnée", async () => {
    const pire = await pireCasDeLaGrandeChaine();
    await ecrireParametre("budget.mode", "bloquant");
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, Math.floor((pire / 8) * 100) / 100);
    const r = await lancer(2);
    if (!r.ok) throw new Error("lancement");
    await bg.tourBoucleGeneration();
    expect((await generation(r.generationId)).statut).toBe("plafond-atteint");
    await ecrireParametre("budget.mode", "indicatif");
    const e = await bg.etatEcriture(r.scriptMaitreId);
    expect(e?.reprise.possible).toBe(true);
  }, 90_000);
});

describe("écriture en attente de crédit : en indicatif, seul le crédit réel compte", () => {
  async function enAttenteFacturation(usine = false) {
    await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, 0.0001);
    const f = (async () => reponseErreur(402, "billing_error", "Your credit balance is too low")) as unknown as typeof fetch;
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
    const r = await lancer(0);
    if (!r.ok) throw new Error("lancement");
    if (usine) await faireUsine(r.generationId);
    await bg.tourBoucleGeneration();
    return r;
  }

  it("mois au-delà du repère → refus de facturation → recharge → « prête » (indicatif)", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, 20);
    const r = await enAttenteFacturation();
    expect((await generation(r.generationId)).statut).toBe("en-attente-credit");
    await gc.declarerRechargeClaude(1000);
    expect(await gc.ecriturePreteAReprendre(r.generationId)).toBe(true);
    expect(await gc.ecritureDebloquee(r.generationId)).toBe(true);
  }, 60_000);

  it("même cas en mode bloquant : PAS prête (limite du mois)", async () => {
    await ecrireParametre("budget.mode", "bloquant");
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, 20);
    const r = await enAttenteFacturation();
    await gc.declarerRechargeClaude(1000);
    expect(await gc.ecriturePreteAReprendre(r.generationId)).toBe(false);
  }, 60_000);

  it("commande de l'Usine en indicatif : PAS prête non plus", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, 20);
    const r = await enAttenteFacturation(true);
    await gc.declarerRechargeClaude(1000);
    expect(await gc.ecriturePreteAReprendre(r.generationId)).toBe(false);
  }, 60_000);

  it("écriture DÉJÀ en attente pour « limite du mois » : en indicatif elle redevient prête", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, 20);
    const r = await lancer(0);
    if (!r.ok) throw new Error("lancement");
    await depots().generations.modifier(r.generationId, { statut: "en-attente-credit" });
    const total = { centimes: 10, devise: "EUR" as const };
    const lignes = [{ etape: "Écriture · x", fournisseur: "anthropic", unite: "appel", quantite: 1, prixUnitaire: total, total, nature: "estime" as const }];
    await ecrireParametre(`generateur.attenteCredit.${r.generationId}`, { motif: "plafond-mensuel", depuis: new Date(Date.now() - 1000).toISOString(), estimationUsd: 0.1, lignes, message: "x" });
    await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, 0.0001);
    await gc.reprendreGenerationsEnAttenteCredit();
    expect(await gc.ecriturePreteAReprendre(r.generationId)).toBe(true);
  }, 60_000);
});

describe("seuil de confirmation : plus jamais exigé en indicatif", () => {
  const eur0 = { centimes: 0, devise: "EUR" as const };
  it("seuil dépassé en indicatif → le tour part tout de suite, sans attente « seuil » ni geste « Reprendre » (le prix ne bloque jamais)", async () => {
    const c = claude();
    await ecrireParametre("budget.mode", "indicatif");
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, 20);
    await ecrireParametre("budget.seuilConfirmation", eur0);
    const r = await lancer(0);
    if (!r.ok) throw new Error("lancement");
    await bg.tourBoucleGeneration();
    expect((await generation(r.generationId)).statut).not.toBe("en-attente-credit");
    expect(c.appels.length).toBeGreaterThan(0);
  }, 90_000);

  it("mode bloquant : la phrase d'attente demande toujours de relever le seuil dans Réglages", async () => {
    claude();
    await ecrireParametre("budget.mode", "bloquant");
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, 20);
    await ecrireParametre("budget.seuilConfirmation", eur0);
    const r = await lancer(0);
    if (!r.ok) throw new Error("lancement");
    await bg.tourBoucleGeneration();
    expect(await gc.phraseAttenteSeuil(r.generationId)).toMatch(/Relevez-le dans Réglages/);
  }, 60_000);
});
