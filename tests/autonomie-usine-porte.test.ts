/**
 * S1 (plan « le plafond de l'Usine se règle dans l'Usine », 15/11) — la porte `PUT /api/usine/reglages/budget` reçoit le plafond
 * de l'Usine en automatique (paire `automatique` + `plafond_automatique_cents`) ; clé `usine.autonomie.porte`, bascule à sens unique.
 * Dépôts en mémoire, lecteurs de solde injectés (fournisseur `simulation`), aucune clé réelle, aucun réseau, 0 €.
 */
import { hash } from "@node-rs/argon2";
import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { LigneCout } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const A = await import("@/services/autonomie-usine");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { moisParis } = await import("@/services/couts");
const { reinitialiserGardePourEssai } = await import("@/usine/garde-porte");
const { PUT } = await import("@/app/api/usine/reglages/budget/route");

const MDP = "s1-porte-plafond";
const SECRET = "s".repeat(24) + "SECRET-ESSAI-porte-1234567";
const URL_BUDGET = "http://studio.test/api/usine/reglages/budget";
const CLE_ANCIENNE = "usine.autonomie";
const CLE_PORTE = "usine.autonomie.porte";
const eur = (c: number) => ({ centimes: c, devise: "EUR" as const });
const ligne = (c: number): LigneCout => ({ etape: "Voix", fournisseur: "simulation", unite: "forfait", quantite: 1, prixUnitaire: eur(c), total: eur(c), nature: "estime" });
const estimation = (c: number) => ({ lignes: [ligne(c)], total: eur(c) });

function appel(corps: unknown, secret: string | null = SECRET): NextRequest {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) h.authorization = `Bearer ${secret}`;
  return new NextRequest(URL_BUDGET, { method: "PUT", headers: h, body: JSON.stringify(corps) });
}
const paire = (automatique: unknown, plafond: unknown, extra: Record<string, unknown> = {}) => ({ contrat: 2, automatique, plafond_automatique_cents: plafond, ...extra });
const brut = (cle: string) => lireParametre<unknown>(cle, null).then((v) => JSON.stringify(v));
const journal = async () => (await depots().evenements.lister()).map((e) => e.message);
const clochesPlafond = async () => (await depots().notifications.lister()).filter((n) => n.titre === "L'Usine a changé son plafond du mois");
const index = () => lireParametre<string[]>(`usine.autonomie.index.${moisParis()}`, []);

beforeAll(async () => {
  process.env.SESSION_SECRET = "k".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = btoa(e);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  reinitialiserGardePourEssai();
  credits.injecterLecteursPourEssai([], []);
  vi.stubEnv("STUDIO_PORTE_SECRET", SECRET);
  vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT", "");
  vi.stubEnv("USINE_PORTE_SECRET", "");
  vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT_JUSQU_A", "");
  await auth.seConnecter(MDP, false);
  await ecrireParametre("budget.mensuel", eur(1_000_000));
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  vi.unstubAllEnvs();
});

describe("1 · lecture : sans clé de la porte, l'ancienne clé comme avant", () => {
  it("actif à 1 234 → active 1 234 ; absent → absent", async () => {
    expect(await A.lireAutonomieUsine()).toEqual({ etat: "confirmation", raison: "absent" });
    await ecrireParametre(CLE_ANCIENNE, { actif: true, plafondCents: 1234, le: new Date().toISOString(), version: 1 });
    expect(await A.lireAutonomieUsine()).toEqual({ etat: "active", plafondCents: 1234 });
  });
});

describe("2 et 3 · la porte écrit la clé nouvelle ; la bascule est à sens unique", () => {
  it("200 ; lireAutonomieUsine → active 2000 ; l'ancienne clé identique octet pour octet ; ses changements n'ont plus d'effet", async () => {
    await ecrireParametre(CLE_ANCIENNE, { actif: true, plafondCents: 1234, le: "2026-11-01T00:00:00.000Z", version: 1 });
    const avant = await brut(CLE_ANCIENNE);
    const r = await PUT(appel(paire(true, 2000)));
    expect(r.status).toBe(200);
    expect(await A.lireAutonomieUsine()).toEqual({ etat: "active", plafondCents: 2000 });
    expect(await brut(CLE_ANCIENNE)).toBe(avant);
    expect(JSON.parse((await brut(CLE_PORTE)) as string)).toMatchObject({ actif: true, plafondCents: 2000, version: 1 });
    // l'ancienne clé ne compte plus
    await ecrireParametre(CLE_ANCIENNE, { actif: true, plafondCents: 9, le: "x", version: 1 });
    expect(await A.lireAutonomieUsine()).toEqual({ etat: "active", plafondCents: 2000 });
    await ecrireParametre(CLE_ANCIENNE, null);
    expect(await A.lireAutonomieUsine()).toEqual({ etat: "active", plafondCents: 2000 });
  });

  it("la clé de la porte, même illisible, reste la seule source : mode confirmation, jamais l'ancienne clé ni « sans limite »", async () => {
    await ecrireParametre(CLE_ANCIENNE, { actif: true, plafondCents: 5000, le: "x", version: 1 });
    for (const illisible of ["texte", 12, [1], { actif: "oui", plafondCents: 5 }, { actif: true, plafondCents: -1 }, { actif: true, plafondCents: 1.5 }, { actif: true, plafondCents: 20_000_000 }]) {
      await ecrireParametre(CLE_PORTE, illisible);
      expect(await A.lireAutonomieUsine(), JSON.stringify(illisible)).toEqual({ etat: "confirmation", raison: "illisible" });
    }
    await ecrireParametre(CLE_PORTE, { actif: false, plafondCents: 5000, le: "x", version: 1 });
    expect(await A.lireAutonomieUsine()).toEqual({ etat: "confirmation", raison: "eteint" });
    await ecrireParametre(CLE_PORTE, { actif: true, plafondCents: 0, le: "x", version: 1 });
    expect(await A.lireAutonomieUsine()).toEqual({ etat: "confirmation", raison: "zero" });
  });

  it("aucun corps n'efface la clé de la porte : éteindre l'écrit éteinte, la lecture reste « éteint »", async () => {
    await PUT(appel(paire(true, 2000)));
    expect((await PUT(appel(paire(false, 0)))).status).toBe(200);
    expect(await A.lireAutonomieUsine()).toEqual({ etat: "confirmation", raison: "eteint" });
    expect(JSON.parse((await brut(CLE_PORTE)) as string)).toMatchObject({ actif: false, plafondCents: 0 });
  });
});

describe("4 · validations : 400 champ_invalide, rien d'écrit", () => {
  const rienEcrit = async () => {
    expect(await brut(CLE_PORTE)).toBe("null");
    expect(await clochesPlafond()).toHaveLength(0);
    expect((await journal()).filter((m) => /plafond reçu de l'Usine/.test(m))).toHaveLength(0);
  };
  it("un seul des deux champs", async () => {
    for (const corps of [{ contrat: 2, automatique: true }, { contrat: 2, plafond_automatique_cents: 2000 }, { contrat: 2, automatique: false }]) {
      const r = await PUT(appel(corps));
      expect(r.status).toBe(400);
      expect((await r.json()).code).toBe("champ_invalide");
    }
    await rienEcrit();
  });
  it("allumer avec 0 ; flottant, texte, négatif, nul, > 10 000 000 ; interrupteur non booléen", async () => {
    for (const [a, p] of [[true, 0], [true, 1.5], [true, "2000"], [true, -1], [true, null], [true, 10_000_001], [false, 10_000_001], [false, -1], [false, 0.5], [false, "0"], ["oui", 100], [1, 100], [null, 100]] as const) {
      const r = await PUT(appel(paire(a, p)));
      expect(r.status, JSON.stringify([a, p])).toBe(400);
      expect((await r.json()).code).toBe("champ_invalide");
    }
    await rienEcrit();
  });
  it("bornes permises : 10 000 000 allumé accepté ; éteindre avec 0 accepté", async () => {
    expect((await PUT(appel(paire(true, 10_000_000)))).status).toBe(200);
    expect((await PUT(appel(paire(false, 0)))).status).toBe(200);
  });
  it("aucun refus lié au plafond global du Studio : plafond global bas, absent ou illisible, la paire passe", async () => {
    await ecrireParametre("budget.mensuel", eur(100));
    expect((await PUT(appel(paire(true, 2000)))).status).toBe(200);
    await ecrireParametre("budget.mensuel", { centimes: "illisible" });
    const r = await PUT(appel(paire(true, 3000)));
    expect(r.status).toBe(200);
    expect(await A.lireAutonomieUsine()).toEqual({ etat: "active", plafondCents: 3000 });
    expect(await r.json()).toMatchObject({ automatique: true, plafond_automatique_cents: 3000, plafond_cents: null });
    expect((await PUT(appel(paire(false, 0)))).status).toBe(200);
  });
});

describe("5 · rejeu identique", () => {
  it("deja: true, aucune ligne de journal ni cloche de plus", async () => {
    expect(await (await PUT(appel(paire(true, 2000)))).json()).toMatchObject({ deja: false });
    const j = (await journal()).length;
    const c = (await clochesPlafond()).length;
    const r = await PUT(appel(paire(true, 2000)));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ deja: true, automatique: true, plafond_automatique_cents: 2000 });
    expect((await journal()).length - 1).toBe(j); // seule la ligne d'audit de la porte s'ajoute
    expect(await clochesPlafond()).toHaveLength(c);
    expect((await journal()).filter((m) => /plafond reçu de l'Usine/.test(m))).toHaveLength(1);
  });
});

describe("6 · garde de la porte", () => {
  it("jeton faux ou absent → 401, rien d'écrit", async () => {
    for (const s of ["x".repeat(40), null]) expect((await PUT(appel(paire(true, 2000), s))).status).toBe(401);
    expect(await brut(CLE_PORTE)).toBe("null");
    expect(await clochesPlafond()).toHaveLength(0);
  });
});

describe("7 · cloche", () => {
  it("de type budget, sans chiffre ni « € », sans { cloche: true } (envoi prévu), à l'allumage, au changement et à l'extinction", async () => {
    await PUT(appel(paire(true, 2000)));
    await PUT(appel(paire(true, 4000)));
    await PUT(appel(paire(false, 0)));
    const c = await clochesPlafond();
    expect(c).toHaveLength(3);
    for (const n of c) {
      expect(n.type).toBe("budget");
      expect(`${n.titre} ${n.message}`).not.toMatch(/€|\d|euro/i);
      expect(n.lien).toBe("/");
      expect(n.envoi).toMatchObject({ statut: "a-envoyer" });
    }
    expect(new Set(c.map((n) => n.message)).size).toBe(3);
    // le journal peut porter le montant ; la cloche jamais
    expect((await journal()).some((m) => /plafond reçu de l'Usine, allumée/.test(m))).toBe(true);
  });
  it("les phrases des cloches d'alerte disent où régler le plafond, sans lien vers Réglages", async () => {
    await PUT(appel(paire(true, 1000)));
    await expect(A.dansVerrouCredits(() => A.inscrireAccordUsine({ cle: "trv-s1", besoin: 5000, quoi: "a" }))).rejects.toMatchObject({ code: "USINE_PLAFOND_ATTEINT", message: expect.stringContaining("Le plafond se règle dans l'Usine.") });
    const alerte = (await depots().notifications.lister()).find((n) => /plafond du mois atteint/.test(n.titre));
    expect(alerte).toMatchObject({ message: "Rien n'est parti. Le plafond se règle dans l'Usine.", lien: "/" });
  });
});

describe("8 et 9 · règle du 25/10 et jugement de l'Usine", () => {
  it("plafond reçu à 1 centime : une commande du fondateur de 50 € (origine absente ou « studio ») ne lève rien", async () => {
    await PUT(appel(paire(true, 1)));
    expect(await A.lireAutonomieUsine()).toEqual({ etat: "active", plafondCents: 1 });
    for (const origine of [undefined, "studio" as const]) {
      await expect(credits.verifierBudgetEtCredits(estimation(5_000), undefined, "Cette vidéo", origine === undefined ? {} : { origine })).resolves.toBeUndefined();
    }
    expect(await index()).toEqual([]);
  });
  it("commande « usine » de 30 € sous un plafond reçu de 20 € → USINE_PLAFOND_ATTEINT, rien d'inscrit au registre", async () => {
    await PUT(appel(paire(true, 2000)));
    await expect(credits.verifierBudgetEtCredits(estimation(3_000), undefined, "Cette vidéo", { origine: "usine" })).rejects.toMatchObject({ code: "USINE_PLAFOND_ATTEINT" });
    expect(await index()).toEqual([]);
    await expect(credits.verifierBudgetEtCredits(estimation(2_000), undefined, "Cette vidéo", { origine: "usine" })).resolves.toBeUndefined();
  });
});

describe("10 · aucun appel réseau", () => {
  it("fetch jamais appelé", async () => {
    const f = vi.spyOn(globalThis, "fetch");
    await PUT(appel(paire(true, 2000)));
    await credits.verifierBudgetEtCredits(estimation(3_000), undefined, "Cette vidéo", { origine: "usine" }).catch(() => undefined);
    expect(f).not.toHaveBeenCalled();
    f.mockRestore();
  });
});

describe("12 · réponse inchangée sans la paire", () => {
  it("sans la paire : exactement mois, budget, plafond, deja (aucune clé de plus) ; avec la paire : deux champs de plus", async () => {
    const sans = await (await PUT(appel({ contrat: 2, budget_mensuel_cents: 4000 }))).json();
    expect(Object.keys(sans)).toEqual(["mois", "budget_mensuel_cents", "plafond_cents", "deja"]);
    expect(sans).toEqual({ mois: moisParis(), budget_mensuel_cents: 4000, plafond_cents: 1_000_000, deja: false });
    const vide = await (await PUT(appel({ contrat: 2 }))).json();
    expect(Object.keys(vide)).toEqual(["mois", "budget_mensuel_cents", "plafond_cents", "deja"]);
    expect(await brut(CLE_PORTE)).toBe("null");
    const avec = await (await PUT(appel({ contrat: 2, budget_mensuel_cents: 4000, automatique: true, plafond_automatique_cents: 2000 }))).json();
    expect(avec).toEqual({ mois: moisParis(), budget_mensuel_cents: 4000, plafond_cents: 1_000_000, deja: false, automatique: true, plafond_automatique_cents: 2000 });
  });
});

describe("13 · la paire avant le retour anticipé ; validations avant toute écriture", () => {
  it("la paire seule → 200, deja: false, la clé est écrite ; le budget de l'Usine n'est pas touché", async () => {
    const r = await PUT(appel(paire(true, 2000)));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ deja: false, automatique: true, plafond_automatique_cents: 2000 });
    expect(JSON.parse((await brut(CLE_PORTE)) as string)).toMatchObject({ actif: true, plafondCents: 2000 });
    expect(await brut(`budget.usine.${moisParis()}`)).toBe("null");
  });
  it("quotas valides + paire invalide → 400, les quotas et le budget ne sont pas écrits", async () => {
    const quotas = [{ periode: "jour", reseau: "instagram", type: "reel", limite: 2 }];
    for (const [a, p] of [[true, -1], [true, 0], [true, 10_000_001]] as const) {
      const r = await PUT(appel({ contrat: 2, quotas, budget_mensuel_cents: 4000, automatique: a, plafond_automatique_cents: p }));
      expect(r.status).toBe(400);
    }
    const r2 = await PUT(appel({ contrat: 2, quotas, automatique: true }));
    expect(r2.status).toBe(400);
    expect(await brut("plafond.quotas-usine")).toBe("null");
    expect(await depots().parametres.obtenir(`budget.usine.${moisParis()}`)).toBeFalsy();
    expect(await brut(CLE_PORTE)).toBe("null");
    expect((await journal()).filter((m) => /Budget de l'Usine|plafond reçu/.test(m))).toHaveLength(0);
  });
  it("quotas + paire valides : tout est écrit ; rejeu complet → deja: true ; budget rejoué mais paire nouvelle → deja: false", async () => {
    const quotas = [{ periode: "jour", reseau: "instagram", type: "reel", limite: 2 }];
    const corps = { contrat: 2, quotas, automatique: true, plafond_automatique_cents: 2000 };
    expect(await (await PUT(appel(corps))).json()).toMatchObject({ deja: false });
    expect(await (await PUT(appel(corps))).json()).toMatchObject({ deja: true });
    expect(await (await PUT(appel({ ...corps, plafond_automatique_cents: 2500 }))).json()).toMatchObject({ deja: false });
  });
});
