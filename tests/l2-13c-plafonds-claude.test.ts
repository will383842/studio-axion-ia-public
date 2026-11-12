/**
 * L2-13c : garde-fous Claude en QUANTITÉS, jamais en montant.
 *  - Une commande d'origine Studio (le fondateur) n'est jamais refusée pour un montant : au plus une alerte, sans montant.
 *  - Une commande d'origine « usine » reste refusée au-delà de son budget ou de son plafond.
 *  - Les garde-fous en nombre (anti-boucle) restent en place.
 *  - Aucun message (journal, cloche, erreur) ne cite un montant.
 * Faux `fetch`, aucun réseau.
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
const bg = await import("@/services/boucle-generation");
const gc = await import("@/services/generation-claude");
const serie = await import("@/services/serie-ecriture");
const { plafondClaudeDuMoisAtteint } = await import("@/services/plafond-claude");
const { definirPlafondSujet } = await import("@/services/plafond-sujet");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { ecrireParametre } = await import("@/services/_commun");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");
const { roleSonde } = await import("@/generateur/roles/sonde");
import type { GenerationScript } from "@/domaine/types";

const MDP = "l2-13c-plafonds-claude";
/** Un montant : un chiffre suivi (ou précédé) d'un symbole monétaire ou d'un mot de monnaie. */
const MONTANT = /\d\s*(?:€|\$|eur\b|euros?\b|dollars?\b|usd\b)|(?:€|\$)\s*\d/i;

beforeAll(async () => preparerMotDePasse(MDP));

const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;
const entree = { contexte: { contexteAxion: "Axion-IA : formations IA pour dirigeants." }, variable: "<brief>Les PV</brief>" };
const REGLAGES = { reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", adresse: "vous" as const, mode: "avatar" as const, objectif: "notoriete" as const };
const IDEES = ["Les réunions qui auraient pu être un e-mail", "Le devis refait trois fois", "Le client qui ne répond plus"];

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
});
afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
  bg.arreterBoucleGeneration();
});

/** Claude « branché » par un faux flux ; chaque requête est comptée. */
async function brancherClaude(reponse: () => Response = () => reponseFlux(fluxReussi({ texte: JSON.stringify({ phrase: "ok" }), modele: "claude-sonnet-5-5" }))) {
  await credits.declarerRecharge("anthropic", 500);
  const appels: unknown[] = [];
  const f = (async (_u: string | URL | Request, init?: RequestInit) => {
    appels.push(init?.body);
    return reponse();
  }) as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
  return appels;
}

let n = 0;
async function generation(plafondUsd = 1.5, dejaUsd = 0): Promise<GenerationScript> {
  const le = new Date().toISOString();
  const etapes = dejaUsd ? [{ role: "x", versionConsigne: 1, modeleDemande: "claude-sonnet-5-5", effort: "low", appelId: `appel-deja-${n + 1}`, lanceLe: le, estimationPireCasUsd: dejaUsd } as never] : [];
  const g: GenerationScript = { id: `gen-l213c-${++n}`, scriptMaitreId: `suj-l213c-${n}`, hachageContexte: "h", plafondUsd, portee: "sujet", etapes, statut: "en-cours", essai: false, creeLe: le, modifieLe: le };
  await depots().generations.enregistrer(g);
  return g;
}

/** Tout ce qui a été écrit pour des personnes (journal, titres et messages de la cloche), à partir d'un instantané `avant`. */
async function textesEcrits(avant: string[] = []): Promise<string[]> {
  const journal = (await depots().evenements.lister()).map((e) => e.message);
  const cloche = (await depots().notifications.lister()).flatMap((x) => [x.titre, x.message]);
  return [...journal, ...cloche].filter((t): t is string => typeof t === "string" && !avant.includes(t));
}

/** Budget, limite Claude et seuil de confirmation au plus bas : tout montant est « dépassé ». */
async function toutDepasser() {
  await ecrireParametre("fournisseur.script", "claude");
  await ecrireParametre("budget.mensuel", { centimes: 1, devise: "EUR" });
  await ecrireParametre("budget.seuilConfirmation", { centimes: 1, devise: "EUR" });
  await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, 0.0001);
}

describe("plafond-claude : la version complète pour le fondateur, la version simple pour l'usine", () => {
  it("plafond du mois dépassé : jamais atteint pour le fondateur (origine absente ou « studio »), atteint pour l'usine", async () => {
    await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, 0.01);
    const date = new Date().toISOString();
    const l = { etape: "Script", fournisseur: "anthropic", unite: "appel", quantite: 1, prixUnitaire: { centimes: 100, devise: "EUR" as const }, total: { centimes: 100, devise: "EUR" as const }, nature: "reel" as const };
    await depots().depenses.enregistrer({ id: "dep-l213c-1", lignes: [l], total: l.total, date, creeLe: date, modifieLe: date } as never);
    expect(await plafondClaudeDuMoisAtteint()).toBe(false);
    expect(await plafondClaudeDuMoisAtteint("studio")).toBe(false);
    expect(await plafondClaudeDuMoisAtteint("usine")).toBe(true);
  });
});

describe("generation-claude : écriture d'un sujet", () => {
  it("fondateur : plafond du sujet, limite du mois et budget dépassés → l'écriture part, jamais refusée, sans montant dans les messages", async () => {
    await toutDepasser();
    const appels = await brancherClaude();
    const avant = await textesEcrits();
    const g = await generation(1.5, 8);
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(r.ok).toBe(true);
    expect(appels).toHaveLength(1);
    expect((await depots().generations.obtenir(g.id))?.statut).not.toBe("plafond-atteint");
    // Les lignes « Prix … accepté sans confirmation » sont écrites par credits.ts / mode-budget.ts (hors périmètre de L2-13c) :
    // elles sont notées « PILOTAGE » dans le journal de la fiche. Tout le reste de ce que génération-claude écrit est sans montant.
    for (const t of (await textesEcrits(avant)).filter((x) => !/accepté sans confirmation/.test(x))) expect(t).not.toMatch(MONTANT);
  });

  it("fondateur (origine « studio » donnée) : même résultat", async () => {
    await toutDepasser();
    const appels = await brancherClaude();
    const g = await generation(1.5, 8);
    expect((await gc.executerRoleFacture(g.id, roleSonde, entree, { origine: "studio" })).ok).toBe(true);
    expect(appels).toHaveLength(1);
  });

  it("usine : plafond du sujet dépassé → refusée, zéro appel ; limite du mois → en attente, zéro appel ; sans budget reçu → refusée", async () => {
    await ecrireParametre("fournisseur.script", "claude");
    const appels = await brancherClaude();
    const avant = await textesEcrits();
    expect(await gc.executerRoleFacture((await generation(1.5, 2)).id, roleSonde, entree, { origine: "usine" })).toMatchObject({ ok: false, arret: "plafond-atteint" });
    await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, 0.0001);
    expect(await gc.executerRoleFacture((await generation()).id, roleSonde, entree, { origine: "usine" })).toMatchObject({ ok: false, arret: "en-attente-credit" });
    await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, 100);
    expect(await gc.executerRoleFacture((await generation()).id, roleSonde, entree, { origine: "usine" })).toMatchObject({ ok: false, arret: "budget-usine" });
    expect(appels).toHaveLength(0);
    for (const t of await textesEcrits(avant)) expect(t).not.toMatch(MONTANT);
  });

  it("anti-boucle conservé : une surcharge permanente s'arrête après ESSAIS_SURCHARGE appels", async () => {
    await ecrireParametre("fournisseur.script", "claude");
    const appels = await brancherClaude(() => reponseErreur(529, "overloaded_error", "Surcharge"));
    const g = await generation();
    await gc.executerRoleFacture(g.id, roleSonde, entree).catch(() => undefined);
    expect(appels).toHaveLength(gc.ESSAIS_SURCHARGE);
  });
});

describe("serie-ecriture : plusieurs idées d'un geste", () => {
  it("fondateur : seuil, budget et limite Claude au plus bas, sans confirmation → toutes les idées partent, aucun refus, aucun montant écrit", async () => {
    await toutDepasser();
    await brancherClaude();
    const avant = await textesEcrits();
    const plan = await serie.planSerie(IDEES.length);
    expect(plan.partiront).toBe(IDEES.length);
    const { serie: s } = await serie.lancerSerie(IDEES.map((texte) => ({ texte })), REGLAGES, "serie-l213c-fondateur");
    expect(s.elements.map((e) => e.sort)).toEqual(["parti", "parti", "parti"]);
    // Une alerte est permise (journal ou cloche), jamais un montant.
    for (const t of await textesEcrits(avant)) expect(t).not.toMatch(MONTANT);
  });

  it("anti-boucle conservé : plus de MAX_SERIE idées d'un coup est refusé, et un geste rejoué ne relance rien", async () => {
    await ecrireParametre("fournisseur.script", "claude");
    await brancherClaude();
    const trop = Array.from({ length: serie.MAX_SERIE + 1 }, (_, i) => ({ texte: `Idée numéro ${i} de la série trop longue` }));
    await expect(serie.lancerSerie(trop, REGLAGES, "serie-l213c-trop")).rejects.toMatchObject({ code: "SERIE_LONGUE" });
    const un = await serie.lancerSerie(IDEES.map((texte) => ({ texte })), REGLAGES, "serie-l213c-rejeu");
    const deux = await serie.lancerSerie(IDEES.map((texte) => ({ texte })), REGLAGES, "serie-l213c-rejeu");
    expect(deux.serie.id).toBe(un.serie.id);
    expect(await depots().scriptsMaitres.lister(() => true)).toHaveLength(IDEES.length);
  });
});

describe("plafond-sujet : réglage du fondateur", () => {
  it("une valeur dans la plage s'enregistre ; une valeur hors plage est refusée sans citer de montant ; le journal ne cite aucun montant", async () => {
    await definirPlafondSujet(200);
    await definirPlafondSujet(250);
    await expect(definirPlafondSujet(9999)).rejects.toSatisfy((e: Error) => !MONTANT.test(e.message));
    for (const t of await textesEcrits()) expect(t).not.toMatch(MONTANT);
  });
});
