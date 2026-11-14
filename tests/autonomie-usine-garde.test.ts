/**
 * AUT-C — garde centrale de l'Usine sous plafond (plan USINE-AUTONOMIE-SOUS-PLAFOND, § 2.4 et 3).
 * `verifierBudgetEtCredits` : Usine + autonomie allumée = jugement contre le plafond, accord automatique, inscription au
 * registre EN DERNIER sous le verrou des crédits. Interrupteur éteint ou Studio : code actuel inchangé.
 * Dépôts en mémoire, lecteurs de solde injectés, aucune clé, aucun réseau, 0 €.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { LigneCout } from "@/domaine/types";
import type { LecteurCredit } from "@/fournisseurs/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const A = await import("@/services/autonomie-usine");
const { controlerBudgetDuMois, reglerBudgetUsine } = await import("@/services/budget-mensuel");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { moisParis } = await import("@/services/couts");

const MDP = "aut-c-garde";
const eur = (c: number) => ({ centimes: c, devise: "EUR" as const });
const ligne = (c: number, fournisseur = "simulation"): LigneCout => ({ etape: "Voix", fournisseur, unite: "forfait", quantite: 1, prixUnitaire: eur(c), total: eur(c), nature: "estime" });
const estimation = (c: number) => ({ lignes: [ligne(c)], total: eur(c) });
let n = 0;
const demande = () => ({ videoId: `v-ac-${++n}`, travailId: `trv-ac-${n}` });
const MOIS = () => moisParis();
const allumer = (plafondCents: number) => ecrireParametre("usine.autonomie", { actif: true, plafondCents, le: new Date().toISOString(), version: 1 });
const index = () => lireParametre<string[]>(`usine.autonomie.index.${MOIS()}`, []);
const accordDe = (cle: string) => lireParametre<{ centimes: number; n: number } | null>(`usine.autonomie.accord.${cle}`, null);
const registreVide = async () => expect(await index()).toEqual([]);
const journal = async () => JSON.stringify(await depots().evenements.lister());

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
  await ecrireParametre("budget.mensuel", eur(1_000_000));
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
});

describe("seuil de confirmation et interrupteur", () => {
  it("allumé, sous plafond : un achat au-dessus du seuil (20 €) passe SANS accord ; accord inscrit, engagé, journalisé", async () => {
    await allumer(10_000);
    const d = demande();
    await expect(credits.reserverPourUsine(estimation(3_000), undefined, "Cette vidéo", d)).resolves.toBeUndefined();
    expect(await index()).toEqual([d.travailId]);
    expect((await accordDe(d.travailId))?.centimes).toBe(3_000);
    expect(await lireParametre(`budget.engage.${d.travailId}`, null)).toMatchObject({ centimes: 3_000, statut: "active" });
    expect(await journal()).toMatch(/Accord automatique de l'Usine/);
  });

  it("ÉTEINT : le même achat reste CONFIRMATION_REQUISE et rien n'est écrit (code actuel inchangé)", async () => {
    await reglerBudgetUsine({ budget_mensuel_cents: 100_000 });
    const d = demande();
    await expect(credits.reserverPourUsine(estimation(3_000), undefined, "Cette vidéo", d)).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    await registreVide();
    expect(await lireParametre(`budget.engage.${d.travailId}`, null)).toBeNull();
  });

  it("ÉTEINT sans budget de l'Usine : BUDGET_USINE_ABSENT inchangé ; réglage illisible ou à 0 : idem", async () => {
    for (const reglage of [null, { actif: true, plafondCents: 0 }, { actif: "oui", plafondCents: 5_000 }, { actif: true, plafondCents: -5 }]) {
      if (reglage) await ecrireParametre("usine.autonomie", reglage);
      await expect(credits.reserverPourUsine(estimation(100), true, "Cette vidéo", demande())).rejects.toMatchObject({ code: "BUDGET_USINE_ABSENT" });
    }
    await registreVide();
  });

  it("au plafond exact : accepté ; +1 centime : USINE_PLAFOND_ATTEINT, rien n'est réservé ni engagé", async () => {
    await allumer(3_000);
    await expect(credits.reserverPourUsine(estimation(3_000), undefined, "Cette vidéo", demande())).resolves.toBeUndefined();
    const d = demande();
    const avant = await depots().reservations.compter();
    await expect(credits.reserverPourUsine(estimation(1), undefined, "Cette vidéo", d)).rejects.toMatchObject({ code: "USINE_PLAFOND_ATTEINT" });
    expect(await depots().reservations.compter()).toBe(avant);
    expect(await lireParametre(`budget.engage.${d.travailId}`, null)).toBeNull();
    expect(await accordDe(d.travailId)).toBeNull();
    expect(await journal()).toMatch(/Refus de l'Usine \(plafond du mois\)/);
  });
});

describe("Studio : jamais touché", () => {
  it("Studio (sans origine ou « studio ») : plafond de l'Usine à 1 centime sans effet, registre jamais lu ni écrit", async () => {
    await allumer(1);
    for (const origine of [undefined, "studio" as const]) {
      const d = demande();
      await expect(credits.verifierEtReserver(estimation(5_000), undefined, "Cette vidéo", d, { origine })).resolves.toBeUndefined();
      expect(await accordDe(d.travailId)).toBeNull();
    }
    await registreVide();
    expect(await journal()).not.toMatch(/Accord automatique de l'Usine|Refus de l'Usine/);
  });
});

describe("pré-vol, crédit, budgets", () => {
  it("pré-vol sans clé : la décision est prise, RIEN n'est écrit ; au-dessus du plafond il refuse", async () => {
    await allumer(10_000);
    await expect(credits.verifierBudgetEtCredits(estimation(3_000), undefined, "Cette vidéo", { origine: "usine" })).resolves.toBeUndefined();
    await registreVide();
    await expect(credits.verifierBudgetEtCredits(estimation(10_001), undefined, "Cette vidéo", { origine: "usine" })).rejects.toMatchObject({ code: "USINE_PLAFOND_ATTEINT" });
    await registreVide();
  });

  it("CREDIT_INSUFFISANT (solde réel HeyGen) après le jugement : registre vide, accord non écrit", async () => {
    await allumer(100_000);
    const heygen: LecteurCredit = {
      fournisseur: "heygen", nom: "HeyGen", mode: "reel", urlRecharge: "https://app.heygen.com/settings/api", variableCle: "HEYGEN_API_KEY",
      async lireSolde() { return { fournisseur: "heygen", centimes: 10, devise: "USD", luLe: new Date().toISOString() }; },
      async testerConnexion() { return { ok: true, finCle: "…0000", message: "Clé acceptée", testeLe: new Date().toISOString() }; },
    };
    credits.injecterLecteursPourEssai([heygen], ["heygen"]);
    const voix: LigneCout = { etape: "Voix", fournisseur: "heygen", unite: "caractere", quantite: 10_000, prixUnitaire: eur(0.02), total: eur(200), nature: "estime" };
    const d = demande();
    await expect(credits.verifierEtReserver({ lignes: [voix], total: eur(200) }, undefined, "Cette vidéo", d, { origine: "usine" })).rejects.toMatchObject({ code: "CREDIT_INSUFFISANT" });
    await registreVide();
    expect(await accordDe(d.travailId)).toBeNull();
    expect(await lireParametre(`budget.engage.${d.travailId}`, null)).toBeNull();
  });

  it("le plafond du Studio (budget.mensuel) reste opposé : BUDGET_DEPASSE, registre vide", async () => {
    await allumer(100_000);
    await ecrireParametre("budget.mensuel", eur(1_000));
    await expect(credits.reserverPourUsine(estimation(1_500), undefined, "Cette vidéo", demande())).rejects.toMatchObject({ code: "BUDGET_DEPASSE" });
    await registreVide();
  });

  it("un budget de l'Usine plus bas que le plafond reste opposé : BUDGET_MENSUEL_ATTEINT", async () => {
    await allumer(100_000);
    await reglerBudgetUsine({ budget_mensuel_cents: 500 });
    await expect(credits.reserverPourUsine(estimation(800), undefined, "Cette vidéo", demande())).rejects.toMatchObject({ code: "BUDGET_MENSUEL_ATTEINT" });
    await registreVide();
  });

  it("budget de l'Usine ABSENT + plafond allumé : passe (le plafond du fondateur est la borne)", async () => {
    await allumer(10_000);
    await expect(credits.reserverPourUsine(estimation(800), undefined, "Cette vidéo", demande())).resolves.toBeUndefined();
    expect(await index()).toHaveLength(1);
  });

  it("quota de l'Usine atteint : QUOTA_USINE_ATTEINT toujours opposé sous plafond (sousPlafondUsine)", async () => {
    await reglerBudgetUsine({ quotas: [{ periode: "jour", reseau: "tiktok", type: "video", limite: 1 }] });
    const o = (t: string) => ({ origine: "usine" as const, travailId: t, reseau: "tiktok", type: "video", sousPlafondUsine: true });
    await expect(controlerBudgetDuMois(100, o("q1"))).resolves.toBeUndefined();
    await expect(controlerBudgetDuMois(100, o("q2"))).rejects.toMatchObject({ code: "QUOTA_USINE_ATTEINT" });
  });

  it("controlerBudgetDuMois : sans `sousPlafondUsine`, ABSENT et SANS_BORNE refusent comme avant", async () => {
    await ecrireParametre("budget.mensuel", null); // aucun plafond du Studio : seules les bornes de l'Usine comptent
    await expect(controlerBudgetDuMois(100, { origine: "usine", travailId: "z1" })).rejects.toMatchObject({ code: "BUDGET_USINE_ABSENT" });
    await expect(controlerBudgetDuMois(100, { origine: "usine", travailId: "z1", sousPlafondUsine: true })).resolves.toBeUndefined();
    await reglerBudgetUsine({ quotas: [{ periode: "jour", reseau: "linkedin", type: "image", limite: 5 }] });
    const couple = { origine: "usine" as const, travailId: "z2", reseau: "tiktok", type: "video" };
    await expect(controlerBudgetDuMois(100, couple)).rejects.toMatchObject({ code: "BUDGET_USINE_SANS_BORNE" });
    await expect(controlerBudgetDuMois(100, { ...couple, sousPlafondUsine: true })).resolves.toBeUndefined();
  });

  it("montant illisible (NaN) : BUDGET_ILLISIBLE, avant tout jugement", async () => {
    await allumer(10_000);
    await expect(credits.verifierEtReserver({ lignes: [ligne(10)], total: eur(Number.NaN) }, undefined, "Cette vidéo", demande(), { origine: "usine" })).rejects.toMatchObject({ code: "BUDGET_ILLISIBLE" });
    await registreVide();
  });
});

describe("origine", () => {
  it("origine null (ou « Usine », objet) : traitée comme l'Usine, jamais comme le Studio", async () => {
    await allumer(10_000);
    for (const origine of [null, "Usine", "", {}]) {
      const d = demande();
      await credits.verifierEtReserver(estimation(500), undefined, "Cette vidéo", d, { origine: origine as never });
      expect(await accordDe(d.travailId), JSON.stringify(origine)).not.toBeNull();
    }
    expect(await index()).toHaveLength(4);
  });

  it("origine null, interrupteur éteint : bloquante (BUDGET_USINE_ABSENT), pas de passage Studio", async () => {
    await expect(credits.verifierEtReserver(estimation(500), true, "Cette vidéo", demande(), { origine: null as never })).rejects.toMatchObject({ code: "BUDGET_USINE_ABSENT" });
  });
});

describe("reprise, lot, libération", () => {
  it("reprise (reactiverSelonOrigine) du même travail : pas de double compte", async () => {
    await allumer(4_000);
    const d = demande();
    await credits.reserverPourUsine(estimation(3_000), undefined, "Cette vidéo", d);
    const r = await credits.reactiverSelonOrigine("usine", d.travailId, estimation(3_000), undefined, "Cette vidéo", {}, async () => "ok");
    expect(r).toBe("ok");
    expect(await A.usageDuMoisUsine(MOIS())).toBe(3_000);
    expect((await accordDe(d.travailId))?.n).toBe(2);
    expect(await index()).toEqual([d.travailId]);
  });

  it("lot : reserverLot + transfererDuLot + lancement de la vidéo = 30 € comptés, jamais 40 €", async () => {
    await allumer(3_000);
    await credits.reserverLot("L1", [ligne(3_000)], eur(3_000), undefined as never, { origine: "usine" });
    expect((await accordDe("lot:L1"))?.centimes).toBe(3_000);
    expect(await A.usageDuMoisUsine(MOIS())).toBe(3_000);
    await credits.transfererDuLot("L1", "vid-1", [ligne(1_000)], eur(1_000));
    expect(await A.usageDuMoisUsine(MOIS())).toBe(2_000);
    const d = { videoId: "vid-1", travailId: "trv-vid-1" };
    await expect(credits.reserverPourUsine(estimation(1_000), undefined, "Cette vidéo", d)).resolves.toBeUndefined();
    expect(await A.usageDuMoisUsine(MOIS())).toBe(3_000);
    // Le plafond est plein : une quatrième dépense est refusée.
    await expect(credits.reserverPourUsine(estimation(1), undefined, "Cette vidéo", demande())).rejects.toMatchObject({ code: "USINE_PLAFOND_ATTEINT" });
  });

  it("échec puis libération : la place revient (sans écriture du registre)", async () => {
    await allumer(3_000);
    const d1 = demande();
    await credits.reserverPourUsine(estimation(3_000), undefined, "Cette vidéo", d1);
    await expect(credits.reserverPourUsine(estimation(1_000), undefined, "Cette vidéo", demande())).rejects.toMatchObject({ code: "USINE_PLAFOND_ATTEINT" });
    const avant = JSON.stringify(await accordDe(d1.travailId));
    await credits.libererReservation(d1.travailId, "liberee");
    expect(JSON.stringify(await accordDe(d1.travailId))).toBe(avant);
    await expect(credits.reserverPourUsine(estimation(1_000), undefined, "Cette vidéo", demande())).resolves.toBeUndefined();
  });
});

describe("alertes et attente de crédit", () => {
  it("USINE_PLAFOND_ATTEINT n'entre pas dans `lancementEnAttente` (arrêt net, pas une attente de crédit)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/services/credits.ts", "utf8");
    const debut = src.indexOf("lancementEnAttente");
    expect(debut).toBeGreaterThan(0);
    expect(src).not.toMatch(/USINE_PLAFOND_ATTEINT[^\n]*lancementEnAttente|lancementEnAttente[^\n]*USINE_PLAFOND_ATTEINT/);
    expect(src).toMatch(/BUDGET_DEPASSE.*CREDIT_INSUFFISANT|CREDIT_INSUFFISANT.*BUDGET_DEPASSE/);
    expect(src.match(/code === "USINE_PLAFOND_ATTEINT"/g) ?? []).toEqual([]);
  });

  it("le refus au plafond sonne une fois par jour, sans montant dans la cloche", async () => {
    await allumer(1_000);
    for (let i = 0; i < 3; i++) await expect(credits.reserverPourUsine(estimation(2_000), undefined, "Cette vidéo", demande())).rejects.toMatchObject({ code: "USINE_PLAFOND_ATTEINT" });
    const notes = (await depots().notifications.lister()).filter((x) => /plafond/i.test(x.titre));
    expect(notes).toHaveLength(1);
    expect(`${notes[0].titre} ${notes[0].message}`).not.toMatch(/\d\s*€|€/);
  });
});
