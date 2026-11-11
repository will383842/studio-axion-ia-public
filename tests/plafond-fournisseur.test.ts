/**
 * L2-13 — garde-fou par fournisseur en QUANTITÉS, jamais en montant.
 *  - origine « usine » : quota (par jour ou par semaine, réseau, type) atteint = appel refusé, zéro fetch ; sous le quota, il passe ;
 *  - origine « studio » (le fondateur) : jamais bloquée, même au-delà du quota ou du plafond technique ;
 *  - FAL_PLAFOND_USD : constante technique serveur ; au-delà, un appel du fondateur passe avec une alerte, seul l'appel de l'usine est refusé ;
 *  - `controlerBudgetDuMois` ne refuse plus pour un montant : il alerte (cloche) et journalise ;
 *  - aucun montant dans les messages. Faux fetch, dépôts en mémoire, aucune clé, aucun réseau.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const pf = await import("@/services/plafond-fournisseur");
const { illustrationsReelles } = await import("@/fournisseurs/illustration/inscription");
const budget = await import("@/services/budget-mensuel");
const { centimes } = await import("@/lib/montants");
import type { FournisseurIllustrationEtendu } from "@/fournisseurs/illustration/types";

let posts = 0;
const fetchFactice = async () => (posts++, Response.json({ request_id: "r", status_url: "s", response_url: "r" }));
let n = 0;
const image = () => ({ genre: "image" as const, requete: "a contract", ratio: "9:16" as const, cleIdempotence: `k-${++n}` });
const fabrication = (env: Record<string, string> = {}) => (illustrationsReelles({ FAL_KEY: "cle-factice", ...env }).reel as FournisseurIllustrationEtendu).fabrication!;
const AUCUN_MONTANT = /[€$]|\beuros?\b|\bdollars?\b|\d\s?(usd|eur)\b/i;

beforeEach(() => {
  reinitialiserDepots();
  posts = 0;
  vi.stubGlobal("fetch", fetchFactice);
});
afterEach(() => vi.unstubAllGlobals());

describe("L2-13 · valeur locale V1 au format de l'usine", () => {
  it("par défaut : des quotas (période jour/semaine, réseau, type, limite entière) sans aucun montant", async () => {
    const q = await pf.lireQuotasUsine();
    expect(q.length).toBeGreaterThan(0);
    for (const x of q) {
      expect(["jour", "semaine"]).toContain(x.periode);
      expect(x.reseau).toBeTruthy();
      expect(x.type).toBeTruthy();
      expect(Number.isSafeInteger(x.limite) && x.limite > 0).toBe(true);
    }
    expect(q.some((x) => x.reseau === "fal" && x.type === "image")).toBe(true);
  });

  it("une valeur enregistrée au même format remplace le défaut ; illisible : retour au défaut", async () => {
    await ecrireParametre(pf.CLE_QUOTAS_USINE, [{ periode: "semaine", reseau: "fal", type: "image", limite: 2 }]);
    expect(await pf.lireQuotasUsine()).toEqual([{ periode: "semaine", reseau: "fal", type: "image", limite: 2 }]);
    await ecrireParametre(pf.CLE_QUOTAS_USINE, "n'importe quoi");
    expect(await pf.lireQuotasUsine()).toEqual(pf.QUOTAS_PAR_DEFAUT);
  });
});

describe("L2-13 · quota de quantité (usine)", () => {
  beforeEach(() => ecrireParametre(pf.CLE_QUOTAS_USINE, [{ periode: "jour", reseau: "fal", type: "image", limite: 2 }]));

  it("sous le quota l'appel passe ; quota atteint : refusé, zéro fetch, message sans montant", async () => {
    const f = fabrication();
    await pf.avecOrigineFournisseur("usine", async () => {
      await f.soumettre(image());
      await f.soumettre(image());
      expect(posts).toBe(2);
      const err = await f.soumettre(image()).catch((e) => e);
      expect(err).toMatchObject({ erreur: { code: "quota", reessayable: false } });
      expect(String(err.message)).not.toMatch(AUCUN_MONTANT);
      expect(posts).toBe(2);
    });
  });

  it("quota atteint : un message apparaît dans le cockpit (réglage + cloche), sans montant", async () => {
    const f = fabrication();
    await pf.avecOrigineFournisseur("usine", async () => {
      await f.soumettre(image());
      await f.soumettre(image());
      await f.soumettre(image()).catch(() => undefined);
    });
    const msg = await lireParametre<{ message?: string } | null>(pf.CLE_MESSAGE_COCKPIT, null);
    expect(msg?.message).toBeTruthy();
    expect(msg?.message).not.toMatch(AUCUN_MONTANT);
    const cloches = await depots().notifications.lister();
    expect(cloches.length).toBe(1);
    expect(JSON.stringify(cloches)).not.toMatch(AUCUN_MONTANT);
  });

  it("le fondateur (origine studio, ou origine non précisée) n'est jamais bloqué", async () => {
    const f = fabrication();
    for (let i = 0; i < 5; i++) await f.soumettre(image());
    for (let i = 0; i < 3; i++) await pf.avecOrigineFournisseur("studio", () => f.soumettre(image()));
    expect(posts).toBe(8);
  });

  it("les appels du fondateur ne consomment pas le quota de l'usine", async () => {
    const f = fabrication();
    for (let i = 0; i < 4; i++) await f.soumettre(image());
    await pf.avecOrigineFournisseur("usine", async () => {
      await f.soumettre(image());
      await f.soumettre(image());
    });
    expect(posts).toBe(6);
  });

  it("un autre type (clip) a son propre quota ; sans quota connu pour un réseau/type, l'appel de l'usine passe", async () => {
    const f = fabrication();
    await pf.avecOrigineFournisseur("usine", async () => {
      await f.soumettre({ genre: "clip", imageUrl: "https://exemple.fr/i.jpg", requete: "move", dureeSec: 5, ratio: "9:16", cleIdempotence: "clip-1" });
    });
    expect(posts).toBe(1);
  });

  it("quota par semaine : le compteur est celui de la semaine", async () => {
    await ecrireParametre(pf.CLE_QUOTAS_USINE, [{ periode: "semaine", reseau: "fal", type: "image", limite: 1 }]);
    const f = fabrication();
    await pf.avecOrigineFournisseur("usine", async () => {
      await f.soumettre(image());
      expect(await f.soumettre(image()).catch((e) => e)).toMatchObject({ erreur: { code: "quota" } });
    });
    expect(posts).toBe(1);
  });

  it("un rejeu (même clé d'idempotence) ne consomme pas une seconde unité", async () => {
    const f = fabrication();
    const d = image();
    await pf.avecOrigineFournisseur("usine", async () => {
      await f.soumettre(d);
      await f.soumettre(image());
    });
    expect(posts).toBe(2);
  });
});

describe("L2-13 · FAL_PLAFOND_USD : constante technique, jamais un écran", () => {
  async function depenseDejaAuDelaDuPlafond() {
    await depots().depenses.enregistrer({ id: "dep-fal", lignes: [{ etape: "Illustrations fabriquées", fournisseur: "fal.ai", unite: "image", quantite: 1, prixUnitaire: centimes(200), total: centimes(200), nature: "reel" }], total: centimes(200), date: new Date().toISOString(), creeLe: new Date().toISOString(), modifieLe: new Date().toISOString() });
  }

  it("au-delà du plafond technique : l'appel de l'usine est refusé (zéro fetch), message sans montant", async () => {
    await depenseDejaAuDelaDuPlafond();
    const f = fabrication({ FAL_PLAFOND_USD: "1" });
    const err = await pf.avecOrigineFournisseur("usine", () => f.soumettre(image()).catch((e) => e));
    expect(err).toMatchObject({ erreur: { code: "refuse" } });
    expect(String(err.message)).not.toMatch(AUCUN_MONTANT);
    expect(posts).toBe(0);
  });

  it("au-delà du plafond technique : l'appel du fondateur passe, avec une alerte (cloche)", async () => {
    await depenseDejaAuDelaDuPlafond();
    const f = fabrication({ FAL_PLAFOND_USD: "1" });
    await f.soumettre(image());
    expect(posts).toBe(1);
    const cloches = await depots().notifications.lister();
    expect(cloches.length).toBe(1);
    expect(JSON.stringify(cloches)).not.toMatch(AUCUN_MONTANT);
  });

  it("aucun module d'écran ne lit FAL_PLAFOND_USD", async () => {
    const { execFileSync } = await import("node:child_process");
    const sortie = execFileSync("grep", ["-rl", "FAL_PLAFOND_USD", "src/app", "src/composants", "src/components"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).toString().trim().length;
    expect(sortie).toBe(0);
  });
});

describe("L2-13 · controlerBudgetDuMois n'est plus un refus de montant", () => {
  beforeEach(async () => {
    await ecrireParametre("budget.mensuel", centimes(100));
  });

  it("plafond du mois dépassé : alerte (cloche) + journal, aucune erreur, même pour l'usine", async () => {
    await expect(budget.controlerBudgetDuMois(50_000, { origine: "usine" })).resolves.toBeUndefined();
    await expect(budget.controlerBudgetDuMois(50_000, { origine: "studio" })).resolves.toBeUndefined();
    expect((await depots().notifications.lister()).length).toBeGreaterThan(0);
    expect((await depots().journal.lister()).some((j) => /budget/i.test(JSON.stringify(j)))).toBe(true);
  });

  it("budget de l'usine absent ou atteint : alerte seulement, plus de refus d'argent", async () => {
    await ecrireParametre("budget.mensuel", centimes(1_000_000));
    await expect(budget.controlerBudgetDuMois(10, { origine: "usine" })).resolves.toBeUndefined();
    await budget.reglerBudgetUsine({ budget_mensuel_cents: 5, mois: (await import("@/services/couts")).moisParis() });
    await expect(budget.controlerBudgetDuMois(1_000, { origine: "usine" })).resolves.toBeUndefined();
  });

  it("une estimation illisible reste refusée (ce n'est pas un montant)", async () => {
    await expect(budget.controlerBudgetDuMois(Number.NaN, { origine: "studio" })).rejects.toMatchObject({ code: "BUDGET_ILLISIBLE" });
  });
});
