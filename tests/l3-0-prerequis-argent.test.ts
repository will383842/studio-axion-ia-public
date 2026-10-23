/**
 * L3-0 (prérequis argent, 18/10) — réserves du relecteur argent sur L1-09 (#386), avant la porte du lot 3.
 *  1. toute dépense commandée par l'Usine passe par `reserverPourUsine` (= `verifierEtReserver` avec `origine: "usine"`) ;
 *  2. la dépense d'ÉCRITURE du script porte `origine` (défaut manuel inchangé) ;
 *  3. `plafond_cents` d'une commande est borné par le plafond d'UN SUJET (§ 3 quater) ;
 *  4. l'alerte « déjà alerté » est marquée APRÈS l'envoi réussi.
 * Dépôts en mémoire, lecteurs de solde vides, aucune clé, aucun réseau, 0 €.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { CLE_ESSAI_CLAUDE, fauxFetch, fluxReussi, reponseFlux } from "./helpers/g0";
import { roleSonde } from "@/generateur/roles/sonde";
import type { GenerationScript, LigneCout } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const couts = await import("@/services/couts");
const budget = await import("@/services/budget-mensuel");
const gc = await import("@/services/generation-claude");
const dcv = await import("@/services/depense-claude-video");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");

const MDP = "l3-0-prerequis-argent";
const eur = (c: number) => ({ centimes: c, devise: "EUR" as const });
const ligne = (c: number): LigneCout => ({ etape: "Voix", fournisseur: "simulation", unite: "forfait", quantite: 1, prixUnitaire: eur(c), total: eur(c), nature: "estime" });
const estimation = (c: number) => ({ lignes: [ligne(c)], total: eur(c) });
let n = 0;
const demande = () => ({ videoId: `v-l30-${++n}`, travailId: `trv-l30-${n}` });

beforeAll(async () => {
  process.env.SESSION_SECRET = "k".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  credits.injecterLecteursPourEssai([], []);
  await auth.seConnecter(MDP, false);
  for (const d of await depots().depenses.lister()) await depots().depenses.supprimer(d.id);
  await ecrireParametre("budget.seuilConfirmation", eur(1_000_000));
  await ecrireParametre("budget.mensuel", eur(100));
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  vi.useRealTimers();
});

describe("1. reserverPourUsine : le chemin unique d'une dépense commandée par l'Usine", () => {
  it("sans budget reçu de l'Usine : refus BUDGET_USINE_ABSENT, aucune réservation ni engagement", async () => {
    const d = demande();
    await expect(credits.reserverPourUsine(estimation(10), true, "Cette vidéo", d)).rejects.toMatchObject({ code: "BUDGET_USINE_ABSENT" });
    expect(await depots().reservations.compter((r) => r.travailId === d.travailId)).toBe(0);
    expect(await lireParametre(`budget.engage.${d.travailId}`, null)).toBeNull();
  });

  it("budget reçu : passe et engage ; au-delà du budget de l'Usine : BUDGET_MENSUEL_ATTEINT", async () => {
    await budget.reglerBudgetUsine({ budget_mensuel_cents: 50, mois: couts.moisParis() });
    await credits.reserverPourUsine(estimation(40), true, "Cette vidéo", demande());
    await expect(credits.reserverPourUsine(estimation(20), true, "Cette vidéo", demande())).rejects.toMatchObject({ code: "BUDGET_MENSUEL_ATTEINT" });
  });

  it("l'origine ne peut pas être surchargée par l'appelant (toujours « usine »)", async () => {
    // @ts-expect-error — le 5e paramètre n'existe pas : une origine passée est ignorée.
    await expect(credits.reserverPourUsine(estimation(10), true, "Cette vidéo", demande(), { origine: "studio" })).rejects.toMatchObject({ code: "BUDGET_USINE_ABSENT" });
  });

  it("la dépense manuelle de Will est inchangée : verifierEtReserver sans origine passe sans budget de l'Usine", async () => {
    await expect(credits.verifierEtReserver(estimation(10), true, "Cette vidéo", demande())).resolves.toBeUndefined();
  });
});

/* --- 2. Dépense d'écriture du script : `origine` ---------------------------------------------------------------- */

const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;
const reponseOk = () => reponseFlux(fluxReussi({ texte: '{"phrase":"Vous recevez un PV."}' }));
const entreeRole = { contexte: { contexteAxion: "Axion-IA : formations IA pour dirigeants." }, variable: "<brief>Les PV de stationnement</brief>" };

/** Faux Claude (faux `fetch`, aucune clé réelle) et crédit Claude suivi : aucun euro n'est dépensé. */
async function brancherClaude() {
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await credits.declarerRecharge("anthropic", 5000);
  await ecrireParametre("budget.mensuel", eur(15_000));
  await ecrireParametre("fournisseur.script", "claude");
  await ecrireParametre("fournisseur.texte-reseaux", "claude");
  const f = fauxFetch([reponseOk, reponseOk, reponseOk]);
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f.fetch, attenteMs: () => 0 });
  return f;
}

async function nouvelleGeneration(): Promise<GenerationScript> {
  const le = new Date().toISOString();
  const g: GenerationScript = { id: `gen-l30-${++n}`, scriptMaitreId: `suj-l30-${n}`, hachageContexte: "h", plafondUsd: 1.5, portee: "sujet", etapes: [], statut: "en-cours", creeLe: le, modifieLe: le };
  await depots().generations.enregistrer(g);
  return g;
}

const depensesClaude = async () => (await depots().depenses.lister()).filter((d) => d.lignes.some((l) => l.fournisseur === "anthropic"));

describe("2. écriture du script (generation-claude) : `origine`", () => {
  it("origine « usine » sans budget reçu : refus, AUCUN appel, aucune dépense, aucune réservation", async () => {
    const { appels } = await brancherClaude();
    const g = await nouvelleGeneration();
    const r = await gc.executerRoleFacture(g.id, roleSonde, entreeRole, { origine: "usine" });
    expect(r).toMatchObject({ ok: false, arret: "budget-usine" });
    expect(appels).toHaveLength(0);
    expect(await depensesClaude()).toHaveLength(0);
    expect(await depots().reservations.lister()).toHaveLength(0);
  });

  it("origine « usine » avec le budget du mois reçu : l'écriture part", async () => {
    const { appels } = await brancherClaude();
    await budget.reglerBudgetUsine({ budget_mensuel_cents: 10_000, mois: couts.moisParis() });
    const g = await nouvelleGeneration();
    expect(await gc.executerRoleFacture(g.id, roleSonde, entreeRole, { origine: "usine" })).toMatchObject({ ok: true, simule: false });
    expect(appels).toHaveLength(1);
  });

  it("défaut manuel inchangé : sans origine, l'écriture part sans budget de l'Usine", async () => {
    const { appels } = await brancherClaude();
    const g = await nouvelleGeneration();
    expect(await gc.executerRoleFacture(g.id, roleSonde, entreeRole)).toMatchObject({ ok: true, simule: false });
    expect(appels).toHaveLength(1);
  });

  it("budget de l'Usine atteint : refus « budget-usine », la génération n'est pas mise en attente (rien ne repart seul)", async () => {
    const { appels } = await brancherClaude();
    await budget.reglerBudgetUsine({ budget_mensuel_cents: 0, mois: couts.moisParis() });
    const g = await nouvelleGeneration();
    expect(await gc.executerRoleFacture(g.id, roleSonde, entreeRole, { origine: "usine" })).toMatchObject({ ok: false, arret: "budget-usine" });
    expect(appels).toHaveLength(0);
    expect((await depots().generations.obtenir(g.id))!.statut).toBe("en-cours");
  });
});

describe("2. dépense d'une vidéo (depense-claude-video) : `origine`", () => {
  const videoId = "v-04";
  const options = { etape: "Texte de publication · LinkedIn" };

  it("origine « usine » sans budget reçu : refus « budget-usine », aucun appel, aucune dépense", async () => {
    const { appels } = await brancherClaude();
    await depots().videos.enregistrer({ ...(await depots().videos.obtenir(videoId))!, id: "v-l30", estDemo: false });
    const r = await dcv.executerRolePourVideo("v-l30", roleSonde, entreeRole, { ...options, origine: "usine" });
    expect(r).toMatchObject({ ok: false, arret: "budget-usine" });
    expect(appels).toHaveLength(0);
    expect(await depensesClaude()).toHaveLength(0);
    expect(await depots().reservations.lister()).toHaveLength(0);
  });

  it("avec le budget reçu : part ; sans origine (Will) : part sans budget de l'Usine", async () => {
    const { appels } = await brancherClaude();
    await depots().videos.enregistrer({ ...(await depots().videos.obtenir(videoId))!, id: "v-l30", estDemo: false });
    expect((await dcv.executerRolePourVideo("v-l30", roleSonde, entreeRole, options)).ok).toBe(true);
    await budget.reglerBudgetUsine({ budget_mensuel_cents: 10_000, mois: couts.moisParis() });
    expect((await dcv.executerRolePourVideo("v-l30", roleSonde, entreeRole, { ...options, origine: "usine" })).ok).toBe(true);
    expect(appels).toHaveLength(2);
  });
});

/* --- 3. plafond_cents : borné par le plafond d'UN SUJET (§ 3 quater), pas par celui du mois -------------------- */

describe("3. plafond_cents d'une commande de l'Usine", () => {
  it("défaut : plafond d'un sujet 1,50 $ au taux 0,9 = 135 centimes ; 135 passe, 136 est refusé (champ plafond_cents)", async () => {
    await ecrireParametre("budget.mensuel", eur(1_000_000));
    expect(await budget.verifierPlafondCommande(135)).toBe(135);
    await expect(budget.verifierPlafondCommande(136)).rejects.toMatchObject({ code: "CHAMP_INVALIDE", champ: "plafond_cents" });
  });

  it("n'est PAS borné par le plafond du mois : mois à 100 centimes, plafond_cents 135 accepté", async () => {
    await ecrireParametre("budget.mensuel", eur(100));
    expect(await budget.verifierPlafondCommande(135)).toBe(135);
  });

  it("suit le réglage `generateur.plafondSujetUsd` et le taux : 2 $ à 0,5 → 100 centimes", async () => {
    await ecrireParametre(gc.PARAM_CHAINE, "courte"); // relecture argent (E) : le plafond suit la chaîne active
    await ecrireParametre(gc.PARAM_PLAFOND_SUJET, 2);
    await ecrireParametre("taux.usdEur", 0.5);
    expect(await budget.verifierPlafondCommande(100)).toBe(100);
    await expect(budget.verifierPlafondCommande(101)).rejects.toMatchObject({ code: "CHAMP_INVALIDE", champ: "plafond_cents" });
  });

  it("entier strictement positif, jamais de flottant ni de texte", async () => {
    for (const v of [0, -3, 2.5, Number.NaN, "10"]) {
      await expect(budget.verifierPlafondCommande(v as number)).rejects.toMatchObject({ code: "CHAMP_INVALIDE", champ: "plafond_cents" });
    }
  });

  it("réglage du sujet illisible : retombe sur le défaut du studio (1,50 $), jamais « sans plafond »", async () => {
    await ecrireParametre(gc.PARAM_CHAINE, "courte");
    await ecrireParametre(gc.PARAM_PLAFOND_SUJET, "beaucoup");
    expect(await budget.verifierPlafondCommande(135)).toBe(135);
    await expect(budget.verifierPlafondCommande(136)).rejects.toMatchObject({ code: "CHAMP_INVALIDE" });
  });
});

/* --- 4. Alerte budget : la marque « déjà alerté » s'écrit APRÈS l'envoi réussi ------------------------------- */

describe("4. alerte du budget : marque écrite après l'envoi", () => {
  const notes = async () => (await depots().notifications.lister()).filter((x) => x.type === "budget" && x.titre.includes("refusée"));
  const cleMarque = () => `budget.refus.${couts.jourParis()}.plafond`;

  it("envoi en panne : le refus part quand même, AUCUNE marque posée ; l'alerte repart au refus suivant", async () => {
    await credits.verifierEtReserver(estimation(90), true, "Cette vidéo", demande());
    const enregistrer = vi.spyOn(depots().notifications, "enregistrer").mockRejectedValueOnce(new Error("panne d'envoi"));
    await expect(credits.verifierEtReserver(estimation(20), true, "Cette vidéo", demande())).rejects.toMatchObject({ code: "BUDGET_DEPASSE" });
    expect(await lireParametre(cleMarque(), false)).toBe(false);
    expect(await notes()).toHaveLength(0);
    enregistrer.mockRestore();
    await expect(credits.verifierEtReserver(estimation(20), true, "Cette vidéo", demande())).rejects.toMatchObject({ code: "BUDGET_DEPASSE" });
    expect(await notes()).toHaveLength(1);
    expect(await lireParametre(cleMarque(), false)).toBe(true);
  });

  it("envoi réussi : marque posée, une seule alerte par jour et par motif (inchangé)", async () => {
    await credits.verifierEtReserver(estimation(90), true, "Cette vidéo", demande());
    for (let i = 0; i < 3; i++) await expect(credits.verifierEtReserver(estimation(20), true, "Cette vidéo", demande())).rejects.toMatchObject({ code: "BUDGET_DEPASSE" });
    expect(await notes()).toHaveLength(1);
  });
});
