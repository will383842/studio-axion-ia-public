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
    const cloches = (await depots().notifications.lister()).filter((c) => c.type === "credit");
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
      await f.soumettre(d); // rejeu : même clé, déjà comptée
      await f.soumettre(image()); // deuxième unité du quota de 2 : passe
      expect(await f.soumettre(image()).catch((e) => e)).toMatchObject({ erreur: { code: "quota" } });
    });
    expect(posts).toBe(2);
  });

  it("limite exacte : la dernière unité passe, la suivante est refusée ; un envoi qui échoue rend son unité", async () => {
    await ecrireParametre(pf.CLE_QUOTAS_USINE, [{ periode: "jour", reseau: "fal", type: "image", limite: 1 }]);
    const f = fabrication();
    vi.stubGlobal("fetch", async () => new Response("non", { status: 422 }));
    await pf.avecOrigineFournisseur("usine", async () => {
      expect(await f.soumettre(image()).catch((e) => e)).toMatchObject({ erreur: { code: "refuse" } }); // refus net : rien n'est parti
      vi.stubGlobal("fetch", fetchFactice);
      await f.soumettre(image()); // l'unité a été rendue
      expect(await f.soumettre(image()).catch((e) => e)).toMatchObject({ erreur: { code: "quota" } });
    });
    expect(posts).toBe(1);
  });

  it("la trace « envoi » ne peut pas s'écrire (base indisponible) : l'unité du quota est rendue, rien n'est parti", async () => {
    await ecrireParametre(pf.CLE_QUOTAS_USINE, [{ periode: "jour", reseau: "fal", type: "image", limite: 1 }]);
    const f = fabrication();
    const enregistrer = depots().parametres.enregistrer.bind(depots().parametres);
    const panne = vi.spyOn(depots().parametres, "enregistrer").mockImplementation(async (p) => {
      if (p.id.startsWith("fal.demande.") && (p.valeur as { etat?: string })?.etat === "envoi") throw new Error("base indisponible");
      return enregistrer(p);
    });
    await pf.avecOrigineFournisseur("usine", async () => {
      await expect(f.soumettre(image())).rejects.toThrow("base indisponible");
      expect(posts).toBe(0);
      panne.mockRestore();
      await f.soumettre(image()); // l'unité a été rendue : elle passe
      expect(posts).toBe(1);
      expect(await f.soumettre(image()).catch((e) => e)).toMatchObject({ erreur: { code: "quota" } });
    });
  });

  it("quota illisible (limite 0, négative, texte) : retour au défaut, jamais « tout refusé » ni « sans quota »", async () => {
    for (const mauvais of [[{ periode: "jour", reseau: "fal", type: "image", limite: 0 }], [{ periode: "jour", reseau: "fal", type: "image", limite: -3 }], [{ periode: "an", reseau: "fal", type: "image", limite: 3 }], []]) {
      await ecrireParametre(pf.CLE_QUOTAS_USINE, mauvais);
      expect(await pf.lireQuotasUsine()).toEqual(pf.QUOTAS_PAR_DEFAUT);
    }
  });

  it("le compteur du jour repart à zéro le lendemain (heure de Paris)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-06-15T21:30:00Z")); // 23 h 30 à Paris, le 15
      const f = fabrication();
      await pf.avecOrigineFournisseur("usine", async () => {
        await f.soumettre(image());
        await f.soumettre(image());
        expect(await f.soumettre(image()).catch((e) => e)).toMatchObject({ erreur: { code: "quota" } });
        vi.setSystemTime(new Date("2026-06-15T22:30:00Z")); // 00 h 30 à Paris, le 16
        await f.soumettre(image());
      });
      expect(posts).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("L2-13 · FAL_PLAFOND_USD : constante technique, jamais un écran", () => {
  async function depenseDejaAuDelaDuPlafond() {
    await depots().depenses.enregistrer({ id: "dep-fal", lignes: [{ etape: "Illustrations fabriquées", fournisseur: "fal.ai", unite: "image", quantite: 1, prixUnitaire: centimes(200), total: centimes(200), nature: "reel" }], total: centimes(200), date: new Date().toISOString(), creeLe: new Date().toISOString(), modifieLe: new Date().toISOString() });
  }
  // Horloge figée au milieu d'un mois : la dépense et le plafond tombent toujours dans le même mois de Paris.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-15T10:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

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
    const cloches = (await depots().notifications.lister()).filter((c) => c.type === "credit");
    expect(cloches.length).toBe(1);
    expect(JSON.stringify(cloches)).not.toMatch(AUCUN_MONTANT);
  });

  it("aucun module d'écran ne lit FAL_PLAFOND_USD", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const fichiers = (dossier: string): string[] =>
      readdirSync(dossier).flatMap((nom) => {
        const chemin = join(dossier, nom);
        return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.(tsx?|jsx?)$/.test(nom) ? [chemin] : [];
      });
    const ecrans = fichiers("src/app");
    expect(ecrans.length).toBeGreaterThan(0); // le parcours a bien trouvé des fichiers
    expect(ecrans.filter((f) => readFileSync(f, "utf8").includes("FAL_PLAFOND_USD"))).toEqual([]);
  });

  it("points d'entrée connus de la fabrication fal.ai : un nouveau point d'entrée fait rougir ce test (poser l'origine « usine » d'abord)", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const fichiers = (dossier: string): string[] =>
      readdirSync(dossier).flatMap((nom) => {
        const chemin = join(dossier, nom);
        return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.tsx?$/.test(nom) && !/\.test\./.test(nom) ? [chemin] : [];
      });
    const appelants = fichiers("src")
      .filter((f) => !f.startsWith(join("src", "fournisseurs")) && /fabrication\.soumettre\(\{ genre:/.test(readFileSync(f, "utf8")))
      .sort();
    expect(appelants).toEqual([join("src", "moteurs", "montage-avocat", "fabrication-illustrations.ts"), join("src", "services", "decors.ts")]);
  });
});

describe("L2-13 · controlerBudgetDuMois n'est plus un refus de montant", () => {
  // Critère 5 (CORRECTIF du 12/11) : le montant n'est plus un motif de refus ; seul le quota et le plafond technique (fal) refusent l'usine.
  const evenementsBudget = async () => (await depots().evenements.lister()).filter((e) => e.type === "budget").map((e) => e.message);
  const cloches = async () => (await depots().notifications.lister()).map((n) => `${n.titre} ${n.message}`);
  it("plafond du mois dépassé (studio) : alerte (cloche) + ligne de journal, aucune erreur, sans montant", async () => {
    await ecrireParametre("budget.mensuel", centimes(100));
    await expect(budget.controlerBudgetDuMois(500, { origine: "studio" })).resolves.toBeUndefined();
    const lignes = await evenementsBudget();
    expect(lignes.some((l) => /dépassé \(mois\)/.test(l))).toBe(true);
    const c = await cloches();
    expect(c.length).toBeGreaterThan(0);
    for (const t of [...lignes, ...c]) expect(t).not.toMatch(AUCUN_MONTANT);
  });

  it("plafond du mois dépassé (usine) : refusée (BUDGET_DEPASSE), le refus de l'usine reste entier", async () => {
    await ecrireParametre("budget.mensuel", centimes(100));
    await expect(budget.controlerBudgetDuMois(500, { origine: "usine" })).rejects.toMatchObject({ code: "BUDGET_DEPASSE" });
  });

  it("budget de l'usine absent : l'usine est refusée (BUDGET_USINE_ABSENT), le studio passe sans refus", async () => {
    await expect(budget.controlerBudgetDuMois(10, { origine: "usine" })).rejects.toMatchObject({ code: "BUDGET_USINE_ABSENT" });
    await expect(budget.controlerBudgetDuMois(10, { origine: "studio" })).resolves.toBeUndefined();
  });

  it("budget de l'usine atteint : l'usine est refusée (BUDGET_MENSUEL_ATTEINT) ; un lancement du studio n'est pas concerné", async () => {
    const { moisParis } = await import("@/services/couts");
    await ecrireParametre(`budget.usine.${moisParis()}`, { budget_mensuel_cents: 50, mois: moisParis(), le: new Date().toISOString() });
    await expect(budget.controlerBudgetDuMois(100, { origine: "usine" })).rejects.toMatchObject({ code: "BUDGET_MENSUEL_ATTEINT" });
    await expect(budget.controlerBudgetDuMois(100, { origine: "studio" })).resolves.toBeUndefined();
  });

  it("le refus de l'usine reste entier au-delà du quota et du plafond technique, même budget d'argent ignoré", async () => {
    await ecrireParametre(pf.CLE_QUOTAS_USINE, [{ periode: "jour", reseau: "fal", type: "image", limite: 1 }]);
    const f = fabrication();
    await pf.avecOrigineFournisseur("usine", async () => {
      await f.soumettre(image());
      await expect(f.soumettre(image())).rejects.toMatchObject({ erreur: { code: "quota" } });
    });
    expect(posts).toBe(1);
  });

  it("une estimation illisible reste refusée (ce n'est pas un montant)", async () => {
    await expect(budget.controlerBudgetDuMois(Number.NaN, { origine: "studio" })).rejects.toMatchObject({ code: "BUDGET_ILLISIBLE" });
  });
});
