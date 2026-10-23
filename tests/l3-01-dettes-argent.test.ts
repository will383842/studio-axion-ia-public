/**
 * L3-01 — dettes argent soldées avant la porte de commande (studio). Doubles de test seulement : dépôts en mémoire,
 * lecteurs de solde vides ou faux `fetch` Claude, aucune clé réelle, aucun réseau, 0 €.
 *  1. une dépense de x,5 centime est comptée au centime supérieur (x,0 reste x) ;
 *  2. aucun flottant dans les sommes du budget du mois (dépensé, engagé, restant, limite Claude) ;
 *  3. alerte « budget à 80 % » : la marque `budget.alerte.<mois>` n'est posée qu'APRÈS un envoi réussi ;
 *  4. l'origine d'une fabrication est FIGÉE dans sa commande (retouches, formats, relances, voix la relisent).
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { LigneCout } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const couts = await import("@/services/couts");
const gc = await import("@/services/generation-claude");
const montants = await import("@/lib/montants");
const fabrication = await import("@/services/fabrication");
const budget = await import("@/services/budget-mensuel");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");

const MDP = "l3-01-dettes-argent";
const eur = (c: number) => ({ centimes: c, devise: "EUR" as const });
const ligneReelle = (c: number, fournisseur = "heygen"): LigneCout => ({ etape: "Voix", fournisseur, unite: "forfait", quantite: 1, prixUnitaire: eur(c), total: eur(c), nature: "reel" });

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
  await ecrireParametre("budget.mensuel", eur(15_000));
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  vi.useRealTimers();
});

/* --- 1. x,5 centime : au centime supérieur ------------------------------------------------------------------------ */

describe("1. une dépense de x,5 centime est comptée au centime supérieur", () => {
  it("x,0 reste x (aucun centime de trop, même avec le bruit des flottants)", () => {
    expect(montants.centimesAuSuperieur(9)).toBe(9);
    // 10 cents de dollar à 0,9 = 9,000000000000002 en flottant : 9 centimes, pas 10.
    expect(montants.usdVersEur(10, 0.9)).toEqual(eur(9));
    expect(montants.usdVersEur(700, 0.9)).toEqual(eur(630));
  });

  it("x,5 monte d'un centime, même quand le flottant donne x,4999…", () => {
    expect(montants.centimesAuSuperieur(13.5)).toBe(14);
    expect(montants.usdVersEur(15, 0.9)).toEqual(eur(14));
    // 5 cents de dollar à 0,7 = 3,4999999999999996 en flottant : l'arrondi au plus proche donnait 3 (un demi-centime perdu).
    expect(montants.usdVersEur(5, 0.7)).toEqual(eur(4));
  });

  it("une fraction de centime n'est jamais perdue : x,1 compte aussi pour un centime de plus", () => {
    expect(montants.centimesAuSuperieur(12.1)).toBe(13);
    expect(montants.usdVersEur(100, 0.923)).toEqual(eur(93));
  });
});

/* --- 2. aucun flottant dans les sommes ----------------------------------------------------------------------------- */

describe("2. aucun flottant dans les sommes du budget du mois", () => {
  it("une dépense ancienne écrite avec une fraction de centime : dépensé, engagé et restant restent entiers, au centime supérieur", async () => {
    await depots().depenses.enregistrer({ id: "dep-frac", travailId: "trv-frac", lignes: [ligneReelle(10.5), ligneReelle(0.2)], total: eur(10.7), date: new Date().toISOString(), creeLe: "", modifieLe: "" });
    await couts.engagerBudget("trv-eng", eur(7.25));
    const b = await couts.resumeBudget();
    for (const m of [b.depense, b.engage, b.restant, ...b.parMois.map((x) => x.total), ...b.parPoste.map((x) => x.total)]) expect(Number.isSafeInteger(m.centimes)).toBe(true);
    // 10,5 → 11 et 0,2 → 1 : 12 centimes dépensés ; 7,25 → 8 engagés.
    expect(b.depense.centimes).toBe(12);
    expect(b.engage.centimes).toBe(8);
    expect(b.restant.centimes).toBe(15_000 - 12 - 8);
  });

  it("la limite Claude du mois compte la dépense au centime de dollar supérieur (jamais arrondie vers le bas)", async () => {
    // 1 centime d'euro réel à 0,9 = 1,11… centime de dollar : compté 2, pas 1.
    await depots().depenses.enregistrer({ id: "dep-claude", lignes: [ligneReelle(1, "anthropic")], total: eur(1), date: new Date().toISOString(), creeLe: "", modifieLe: "" });
    const e = await gc.engageClaudeDuMoisCentimes();
    expect(Number.isSafeInteger(e.depense)).toBe(true);
    expect(e.depense).toBe(2);
  });
});

/* --- 3. alerte « budget à 80 % » : marque après l'envoi ------------------------------------------------------------ */

describe("3. alerte « budget à 80 % » : la marque du mois n'est posée qu'après un envoi réussi", () => {
  const marque = () => lireParametre<boolean>(`budget.alerte.${couts.moisParis()}`, false);
  const depasser80 = async () => {
    await ecrireParametre("budget.mensuel", eur(100));
    await depots().depenses.enregistrer({ id: "dep-80", lignes: [], total: eur(90), date: new Date().toISOString(), creeLe: "", modifieLe: "" });
  };
  const enPanne = async () => {
    throw new Error("envoi en panne");
  };

  it("lire l'alerte à envoyer ne pose aucune marque (avant : marque posée AVANT l'envoi, alerte perdue si l'envoi tombait)", async () => {
    await depasser80();
    expect((await couts.alerteBudget())?.type).toBe("budget");
    expect(await marque()).toBe(false);
    expect((await couts.alerteBudget())?.type).toBe("budget");
  });

  it("l'envoi échoue : la marque n'est PAS posée et l'alerte repart au passage suivant ; envoi réussi : marque posée, une seule fois", async () => {
    await depasser80();
    await expect(couts.envoyerAlerteBudget(enPanne)).rejects.toThrow("envoi en panne");
    expect(await marque()).toBe(false);
    const envoyees: string[] = [];
    const envoyer = async (n: { titre: string }) => void envoyees.push(n.titre);
    expect(await couts.envoyerAlerteBudget(envoyer)).toBe(true);
    expect(await marque()).toBe(true);
    expect(await couts.envoyerAlerteBudget(envoyer)).toBe(false);
    expect(envoyees).toEqual(["Budget du mois utilisé à 90 %"]);
  });

  it("deux passages simultanés : une seule alerte envoyée", async () => {
    await depasser80();
    const envoyees: string[] = [];
    const envoyer = async (n: { titre: string }) => {
      await new Promise((r) => setTimeout(r, 20));
      envoyees.push(n.titre);
    };
    await Promise.all([couts.envoyerAlerteBudget(envoyer), couts.envoyerAlerteBudget(envoyer)]);
    expect(envoyees).toHaveLength(1);
  });

  it("sous 80 % : rien n'est envoyé ni marqué", async () => {
    const envoyer = vi.fn(async () => undefined);
    expect(await couts.envoyerAlerteBudget(envoyer)).toBe(false);
    expect(envoyer).not.toHaveBeenCalled();
    expect(await marque()).toBe(false);
  });
});

/* --- 4. origine figée dans la commande ----------------------------------------------------------------------------- */

describe("4. l'origine d'une fabrication est figée dans sa commande", () => {
  it("lancement commandé par l'Usine sans budget reçu : BUDGET_USINE_ABSENT, aucun travail, rien réservé ni engagé", async () => {
    await expect(fabrication.lancerFabrication("v-04", { confirme: true, origine: "usine" })).rejects.toMatchObject({ code: "BUDGET_USINE_ABSENT" });
    expect(await depots().travaux.lister((t) => t.cibleId === "v-04" && t.statut !== "termine")).toEqual([]);
    expect(await depots().reservations.lister((r) => r.statut === "active")).toEqual([]);
    expect((await couts.resumeBudget()).engage.centimes).toBe(0);
  });

  it("avec le budget reçu : la version garde `origine: usine` (retouche, format et relance la relisent)", async () => {
    await budget.reglerBudgetUsine({ budget_mensuel_cents: 10_000, mois: couts.moisParis() });
    const { versionId } = await fabrication.lancerFabrication("v-04", { confirme: true, origine: "usine" });
    expect((await depots().versions.obtenir(versionId))!.commande.origine).toBe("usine");
  });

  it("défaut inchangé : un lancement de Will part sans budget de l'Usine et sa commande ne porte aucune origine", async () => {
    const { versionId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    expect((await depots().versions.obtenir(versionId))!.commande.origine).toBeUndefined();
  });
});

/* --- 5. audit L3-01 : plafond d'une écriture contrôlé en centimes entiers (generation-claude.ts) ------------------- */

describe("5. plafond d'une écriture Claude : contrôle en centimes de dollar entiers (aucun flottant)", () => {
  let n = 0;
  async function generation(plafondUsd: number, enVolUsd?: number) {
    const le = new Date().toISOString();
    const id = `gen-l301-${++n}`;
    // Une étape « lancée » sans réponse : son pire cas compte dans la dépense du sujet.
    const etapes = enVolUsd === undefined ? [] : [{ numero: 1, appelId: `appel-${id}`, estimationPireCasUsd: enVolUsd, lanceLe: le, modeleDemande: "claude-sonnet-4-5" }];
    await depots().generations.enregistrer({ id, scriptMaitreId: `suj-${id}`, hachageContexte: "h", plafondUsd, portee: "sujet", etapes, statut: "en-cours", creeLe: le, modifieLe: le } as never);
    return id;
  }

  it("réservation d'un appel, borne x,0 : 0,10 $ réservé + 0,20 $ demandé tient dans un plafond de 0,30 $ (le flottant donnait 0,30000000000000004 > 0,3)", async () => {
    const id = await generation(0.3);
    expect(await gc.reserverDansPlafondSujet(id, "a1", 0.1)).toEqual({ ok: true });
    expect(await gc.reserverDansPlafondSujet(id, "a2", 0.2)).toEqual({ ok: true });
    expect(await gc.reserverDansPlafondSujet(id, "a3", 0.001)).toMatchObject({ ok: false, plafondUsd: 0.3 });
  });

  it("réservation d'un appel, borne x,5 : 29,5 c$ + 0,5 c$ comptent 30 + 1 = 31 c$ > 30 c$ (refus ; le flottant donnait 0,3 ≤ 0,3)", async () => {
    const id = await generation(0.3);
    expect(await gc.reserverDansPlafondSujet(id, "a1", 0.295)).toEqual({ ok: true });
    expect(await gc.reserverDansPlafondSujet(id, "a2", 0.005)).toMatchObject({ ok: false, plafondUsd: 0.3 });
  });

  it("pire cas de la chaîne, borne x,0 : 0,10 $ en vol + 0,20 $ restants = 30 c$, accepté au plafond de 0,30 $ (sans tolérance 1e-9)", async () => {
    const id = await generation(0.3, 0.1);
    expect(await gc.reserverPireCasChaine(id, { pireCasRestantUsd: 0.2 })).toEqual({ ok: true });
  });

  it("pire cas de la chaîne, borne x,5 : 29,5 c$ en vol + 0,5 c$ restants = 31 c$ > 30 c$ : refusé, plafond inchangé", async () => {
    const id = await generation(0.3, 0.295);
    expect(await gc.reserverPireCasChaine(id, { pireCasRestantUsd: 0.005 })).toMatchObject({ ok: false });
    expect((await depots().generations.obtenir(id))!.plafondUsd).toBe(0.3);
  });
});
