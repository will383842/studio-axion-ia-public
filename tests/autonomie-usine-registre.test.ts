/**
 * AUT-A — registre et réglage de l'autonomie de l'Usine sous plafond mensuel (plan USINE-AUTONOMIE-SOUS-PLAFOND, § 2 et 3).
 * Ce lot ne branche RIEN dans la garde : on teste le registre seul. Dépôts en mémoire, aucun réseau, 0 €.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const A = await import("@/services/autonomie-usine");
const { moisParis } = await import("@/services/couts");
const { maintenant } = await import("@/services/_commun");

const MDP = "aut-a-registre";
const eur = (c: number) => ({ centimes: c, devise: "EUR" as const });
const MOIS = () => moisParis(maintenant());

beforeAll(async () => {
  process.env.SESSION_SECRET = "k".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

afterEach(() => {
  vi.useRealTimers();
});

/** Allume l'autonomie directement dans les réglages (sans passer par le réglage, pour isoler la brique testée). */
async function allumer(plafondCents: number) {
  await ecrireParametre("usine.autonomie", { actif: true, plafondCents, le: new Date().toISOString(), version: 1 });
}
const sousVerrou = <T>(f: () => Promise<T>) => A.dansVerrouCredits(f);
const maintenantIso = () => new Date().toISOString();

async function engagement(cle: string, e: { centimes: number; statut: "active" | "liberee" | "consommee"; le?: string }) {
  await ecrireParametre(`budget.engage.${cle}`, { le: maintenantIso(), ...e });
}
async function accord(cle: string, centimes: number, o: { mois?: string; le?: string } = {}) {
  await ecrireParametre(`usine.autonomie.accord.${cle}`, { cle, mois: o.mois ?? MOIS(), centimes, quoi: "x", le: o.le ?? maintenantIso(), n: 1 });
  const mois = o.mois ?? MOIS();
  const index = await lireParametre<string[]>(`usine.autonomie.index.${mois}`, []);
  await ecrireParametre(`usine.autonomie.index.${mois}`, [...index, cle]);
}
async function depense(travailId: string, centimes: number, extra: Record<string, unknown> = {}) {
  const m = maintenantIso();
  await depots().depenses.enregistrer({ id: `dep-${travailId}-${Math.random()}`, travailId, date: m, lignes: [], total: eur(centimes), creeLe: m, modifieLe: m, ...extra } as never);
}

describe("réglage", () => {
  it("éteint par défaut (aucun défaut chiffré)", async () => {
    expect(await A.lireAutonomieUsine()).toEqual({ etat: "confirmation", raison: "absent" });
  });

  it("allumé avec 0 → CHAMP_INVALIDE, rien n'est écrit", async () => {
    await expect(A.reglerAutonomieUsine({ actif: true, plafondCents: 0 })).rejects.toMatchObject({ code: "CHAMP_INVALIDE" });
    expect(await depots().parametres.obtenir("usine.autonomie")).toBeFalsy();
  });

  it("valeurs hors borne ou non entières → CHAMP_INVALIDE", async () => {
    for (const p of [-1, 1.5, 10_000_001, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(A.reglerAutonomieUsine({ actif: false, plafondCents: p })).rejects.toMatchObject({ code: "CHAMP_INVALIDE" });
    }
  });

  it("allumé avec un plafond : lu actif ; éteint : retour au mode confirmation ; journalisé", async () => {
    await A.reglerAutonomieUsine({ actif: true, plafondCents: 5000 });
    expect(await A.lireAutonomieUsine()).toEqual({ etat: "active", plafondCents: 5000 });
    await A.reglerAutonomieUsine({ actif: false, plafondCents: 5000 });
    expect(await A.lireAutonomieUsine()).toEqual({ etat: "confirmation", raison: "eteint" });
    const j = (await depots().evenements.lister()).map((e) => e.message);
    expect(j.some((m) => /allumée, plafond/.test(m))).toBe(true);
    expect(j.some((m) => /éteinte \(retour au mode confirmation\)/.test(m))).toBe(true);
  });

  it("rejeu identique : rien n'est réécrit ni journalisé", async () => {
    await A.reglerAutonomieUsine({ actif: true, plafondCents: 5000 });
    const avant = await depots().parametres.obtenir("usine.autonomie");
    const nbJournal = (await depots().evenements.lister()).length;
    await A.reglerAutonomieUsine({ actif: true, plafondCents: 5000 });
    expect(await depots().parametres.obtenir("usine.autonomie")).toEqual(avant);
    expect((await depots().evenements.lister()).length).toBe(nbJournal);
  });

  it("plafond à 0 mais éteint : accepté, lu « eteint »", async () => {
    await A.reglerAutonomieUsine({ actif: false, plafondCents: 0 });
    expect(await A.lireAutonomieUsine()).toEqual({ etat: "confirmation", raison: "eteint" });
  });

  it("allumé avec plafond 0 dans la base : raison « zero »", async () => {
    await ecrireParametre("usine.autonomie", { actif: true, plafondCents: 0, version: 1 });
    expect(await A.lireAutonomieUsine()).toEqual({ etat: "confirmation", raison: "zero" });
  });

  it("illisible (texte, -1, 1.5, actif « oui ») → confirmation, jamais « sans limite »", async () => {
    for (const valeur of ["texte", 12, [], { actif: true, plafondCents: "5000" }, { actif: true, plafondCents: -1 }, { actif: true, plafondCents: 1.5 }, { actif: "oui", plafondCents: 5000 }, { actif: true, plafondCents: 10_000_001 }]) {
      await ecrireParametre("usine.autonomie", valeur);
      expect(await A.lireAutonomieUsine()).toEqual({ etat: "confirmation", raison: "illisible" });
    }
  });

  it("sans session → refus, rien n'est écrit", async () => {
    reinitialiserRequete();
    await expect(A.reglerAutonomieUsine({ actif: true, plafondCents: 5000 })).rejects.toThrow();
    expect(await depots().parametres.obtenir("usine.autonomie")).toBeFalsy();
  });
});

describe("origine", () => {
  it("undefined et « studio » → studio", () => {
    expect(A.normaliserOrigine(undefined)).toBe("studio");
    expect(A.normaliserOrigine("studio")).toBe("studio");
  });
  it("null, « », « Usine », objet, nombre, « usine » → usine", () => {
    for (const v of [null, "", "Usine", {}, 0, 1, "usine", "STUDIO", " studio"]) expect(A.normaliserOrigine(v)).toBe("usine");
  });
});

describe("accord sans clic : origine non transmise", () => {
  async function videoOrigine(id: string, origine: "usine" | "studio") {
    const d = new Date().toISOString();
    await depots().versions.enregistrer({ id: `ver-${id}`, videoId: id, numero: 1, commande: { origine, entrees: {} }, creeLe: d, modifieLe: d } as never);
  }
  it("vidéo d'origine Usine, origine non transmise, autonomie éteinte → false", async () => {
    await videoOrigine("v-o1", "usine");
    expect(await A.accordSansClicPour(undefined, "v-o1")).toBe(false);
  });
  it("vidéo d'origine Usine, origine non transmise, autonomie allumée → true", async () => {
    await videoOrigine("v-o2", "usine");
    await allumer(1000);
    expect(await A.accordSansClicPour(undefined, "v-o2")).toBe(true);
  });
  it("origine transmise « studio » l'emporte sur la vidéo ; vidéo Studio non transmise suit le budget indicatif", async () => {
    await videoOrigine("v-o3", "usine");
    await videoOrigine("v-o4", "studio");
    const { budgetIndicatifPourVideo } = await import("@/services/mode-budget");
    expect(await A.accordSansClicPour(undefined, "v-o4")).toBe(await budgetIndicatifPourVideo("v-o4", undefined));
  });
});

describe("usage d'une clé (tableau § 2.3)", () => {
  it("sans accord : 0", async () => {
    expect(await A.usageDeLaCle("trv-rien")).toBe(0);
  });
  it("active : max(accord, payé)", async () => {
    await accord("trv-a1", 500);
    await engagement("trv-a1", { centimes: 500, statut: "active" });
    expect(await A.usageDeLaCle("trv-a1")).toBe(500);
    await depense("trv-a1", 700);
    expect(await A.usageDeLaCle("trv-a1")).toBe(700);
  });
  it("consommée avec dépense : le payé", async () => {
    await accord("trv-c1", 500);
    await engagement("trv-c1", { centimes: 500, statut: "consommee" });
    await depense("trv-c1", 320);
    expect(await A.usageDeLaCle("trv-c1")).toBe(320);
  });
  it("consommée sans dépense rattachée : le montant accordé (prudence)", async () => {
    await accord("appel-c2", 500);
    await engagement("appel-c2", { centimes: 500, statut: "consommee" });
    expect(await A.usageDeLaCle("appel-c2")).toBe(500);
  });
  it("libérée : le payé (0 si rien n'a été payé)", async () => {
    await accord("trv-l1", 500);
    await engagement("trv-l1", { centimes: 500, statut: "liberee" });
    expect(await A.usageDeLaCle("trv-l1")).toBe(0);
    await depense("trv-l1", 120);
    expect(await A.usageDeLaCle("trv-l1")).toBe(120);
  });
  it("engagement absent depuis moins de 15 min : le montant accordé (lancement en vol)", async () => {
    await accord("trv-v1", 500);
    expect(await A.usageDeLaCle("trv-v1")).toBe(500);
  });
  it("engagement absent depuis plus de 15 min : le payé", async () => {
    await accord("trv-v2", 500, { le: new Date(Date.now() - 16 * 60_000).toISOString() });
    expect(await A.usageDeLaCle("trv-v2")).toBe(0);
    await depense("trv-v2", 90);
    expect(await A.usageDeLaCle("trv-v2")).toBe(90);
  });
  it("lot actif : le reste de l'engagement du lot", async () => {
    await accord("lot:L1", 900);
    await engagement("lot:L1", { centimes: 400, statut: "active" });
    expect(await A.usageDeLaCle("lot:L1")).toBe(400);
  });
  it("lot consommé ou libéré : 0 (chaque vidéo a sa clé)", async () => {
    await accord("lot:L2", 900);
    await engagement("lot:L2", { centimes: 400, statut: "consommee" });
    expect(await A.usageDeLaCle("lot:L2")).toBe(0);
    await engagement("lot:L2", { centimes: 400, statut: "liberee" });
    expect(await A.usageDeLaCle("lot:L2")).toBe(0);
  });
  it("dépense d'exemple sans travail ou simulée : jamais comptée", async () => {
    await accord("trv-s1", 100);
    await engagement("trv-s1", { centimes: 100, statut: "liberee" });
    await depense("trv-s1", 999, { estDemo: true, travailId: undefined });
    await depense("trv-s1", 50, { lignes: [{ etape: "x", fournisseur: "simulation", unite: "f", quantite: 1, prixUnitaire: eur(50), total: eur(50), nature: "estime" }] });
    expect(await A.usageDeLaCle("trv-s1")).toBe(0);
  });
  it("usage du mois : somme des clés de l'index du mois, une clé d'un autre mois n'y compte pas", async () => {
    await accord("trv-m1", 300);
    await engagement("trv-m1", { centimes: 300, statut: "active" });
    await accord("trv-m2", 200);
    await engagement("trv-m2", { centimes: 200, statut: "active" });
    // ré-accordée un autre mois : ne compte plus ici
    await ecrireParametre("usine.autonomie.accord.trv-m2", { cle: "trv-m2", mois: "2020-01", centimes: 200, quoi: "x", le: maintenantIso(), n: 2 });
    expect(await A.usageDuMoisUsine(MOIS())).toBe(300);
  });
});

describe("jugement sous plafond", () => {
  it("égalité au plafond acceptée", async () => {
    await allumer(1000);
    const j = await A.jugerSousPlafondUsine({ besoin: 1000 });
    expect(j).toMatchObject({ ok: true, apres: 1000, plafond: 1000 });
  });
  it("+1 centime refusé", async () => {
    await allumer(1000);
    expect((await A.jugerSousPlafondUsine({ besoin: 1001 })).ok).toBe(false);
  });
  it("utilisé + besoin : 600 utilisés, 400 acceptés, 401 refusés", async () => {
    await allumer(1000);
    await accord("trv-j1", 600);
    await engagement("trv-j1", { centimes: 600, statut: "active" });
    expect((await A.jugerSousPlafondUsine({ besoin: 400 })).ok).toBe(true);
    expect((await A.jugerSousPlafondUsine({ besoin: 401 })).ok).toBe(false);
  });
  it("ré-accord de la même clé : non additionné", async () => {
    await allumer(1000);
    await accord("trv-j2", 600);
    await engagement("trv-j2", { centimes: 600, statut: "active" });
    const j = await A.jugerSousPlafondUsine({ cle: "trv-j2", besoin: 600 });
    expect(j).toMatchObject({ ok: true, apres: 600 });
    // sans la clé, le même besoin dépasserait
    expect((await A.jugerSousPlafondUsine({ besoin: 600 })).ok).toBe(false);
  });
  it("reprise : ce qui est déjà payé est recompté avec le reste, sans double compte", async () => {
    await allumer(1000);
    await accord("trv-j3", 500);
    await engagement("trv-j3", { centimes: 300, statut: "active" });
    await depense("trv-j3", 200);
    const j = await A.jugerSousPlafondUsine({ cle: "trv-j3", besoin: 100 });
    // max(100, 300 engagés) + 200 payés = 500
    expect(j.apres).toBe(500);
  });
  it("autonomie éteinte ou illisible : jamais ok (échec fermé)", async () => {
    expect((await A.jugerSousPlafondUsine({ besoin: 1 })).ok).toBe(false);
    await ecrireParametre("usine.autonomie", "texte");
    expect((await A.jugerSousPlafondUsine({ besoin: 1 })).ok).toBe(false);
  });
  it("besoin illisible (NaN, négatif) : refusé", async () => {
    await allumer(1000);
    expect((await A.jugerSousPlafondUsine({ besoin: Number.NaN })).ok).toBe(false);
    expect((await A.jugerSousPlafondUsine({ besoin: -5 })).ok).toBe(false);
  });
  it("changement de mois à Paris : 23 h 30 UTC le 30/11 = décembre", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-30T23:30:00Z"));
    await allumer(1000);
    const j = await A.jugerSousPlafondUsine({ besoin: 10 });
    expect(j.mois).toBe("2026-12");
    await sousVerrou(() => A.inscrireAccordUsine({ cle: "trv-d1", besoin: 10, quoi: "essai" }));
    const a = await lireParametre<{ mois: string }>("usine.autonomie.accord.trv-d1", null as never);
    expect(a.mois).toBe("2026-12");
    expect(await lireParametre<string[]>("usine.autonomie.index.2026-12", [])).toEqual(["trv-d1"]);
    expect(await lireParametre<string[]>("usine.autonomie.index.2026-11", [])).toEqual([]);
  });
  it("l'utilisé repart de zéro au mois suivant", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T10:00:00Z"));
    await allumer(1000);
    await sousVerrou(() => A.inscrireAccordUsine({ cle: "trv-n1", besoin: 1000, quoi: "essai" }));
    expect((await A.jugerSousPlafondUsine({ besoin: 1 })).ok).toBe(false);
    vi.setSystemTime(new Date("2026-12-02T10:00:00Z"));
    expect((await A.jugerSousPlafondUsine({ besoin: 1000 })).ok).toBe(true);
  });
});

describe("inscrireAccordUsine", () => {
  it("hors dansVerrouCredits → VERROU_REQUIS, rien n'est écrit", async () => {
    await allumer(1000);
    expect(A.estDansVerrouCredits()).toBe(false);
    await expect(A.inscrireAccordUsine({ cle: "trv-v", besoin: 10, quoi: "essai" })).rejects.toMatchObject({ code: "VERROU_REQUIS" });
    expect(await depots().parametres.obtenir("usine.autonomie.accord.trv-v")).toBeFalsy();
    expect(await lireParametre<string[]>(`usine.autonomie.index.${MOIS()}`, [])).toEqual([]);
  });
  it("sous le verrou : marqueur visible, accord et index écrits, idempotents", async () => {
    await allumer(1000);
    await sousVerrou(async () => {
      expect(A.estDansVerrouCredits()).toBe(true);
      await A.inscrireAccordUsine({ cle: "trv-i1", besoin: 400, quoi: "vidéo", videoId: "v1" });
      await A.inscrireAccordUsine({ cle: "trv-i1", besoin: 400, quoi: "vidéo", videoId: "v1" });
    });
    expect(A.estDansVerrouCredits()).toBe(false);
    const a = await lireParametre<{ centimes: number; n: number; videoId: string }>("usine.autonomie.accord.trv-i1", null as never);
    expect(a).toMatchObject({ centimes: 400, n: 2, videoId: "v1" });
    expect(await lireParametre<string[]>(`usine.autonomie.index.${MOIS()}`, [])).toEqual(["trv-i1"]);
  });
  it("dépassement : USINE_PLAFOND_ATTEINT, rien d'écrit, refus journalisé", async () => {
    await allumer(1000);
    await expect(sousVerrou(() => A.inscrireAccordUsine({ cle: "trv-i2", besoin: 1001, quoi: "vidéo" }))).rejects.toMatchObject({ code: "USINE_PLAFOND_ATTEINT" });
    expect(await depots().parametres.obtenir("usine.autonomie.accord.trv-i2")).toBeFalsy();
    expect((await depots().evenements.lister()).some((e) => /refus|atteint/i.test(e.message) && e.type === "budget")).toBe(true);
  });
  it("autonomie éteinte : refus, rien d'écrit", async () => {
    await expect(sousVerrou(() => A.inscrireAccordUsine({ cle: "trv-i3", besoin: 1, quoi: "vidéo" }))).rejects.toBeTruthy();
    expect(await depots().parametres.obtenir("usine.autonomie.accord.trv-i3")).toBeFalsy();
  });
  it("deux accords SÉQUENTIELS : le second est refusé au plafond (ne prouve aucune simultanéité ; la vraie course relève de autonomie-usine-course.test.ts, lot C)", async () => {
    await allumer(1000);
    const un = () => sousVerrou(() => A.inscrireAccordUsine({ cle: "trv-p1", besoin: 600, quoi: "a" }));
    await un();
    await expect(sousVerrou(() => A.inscrireAccordUsine({ cle: "trv-p2", besoin: 600, quoi: "b" }))).rejects.toMatchObject({ code: "USINE_PLAFOND_ATTEINT" });
  });
});

describe("journal, cloche 80 % et cloche plafond", () => {
  const cloches = async () => (await depots().notifications.lister()).filter((n) => n.type === "budget" && /Usine/.test(n.titre));

  it("chaque accord est journalisé avec quoi, montant, utilisé, plafond et reste", async () => {
    await allumer(1000);
    await sousVerrou(() => A.inscrireAccordUsine({ cle: "trv-g1", besoin: 250, quoi: "Vidéo « Essai »", videoId: "v-g1" }));
    const ev = (await depots().evenements.lister()).find((e) => /Accord automatique de l'Usine/.test(e.message));
    expect(ev?.message).toContain("Vidéo « Essai »");
    expect(ev?.message).toMatch(/2,50/);
    expect(ev?.message).toMatch(/plafond/);
    expect(ev?.message).toMatch(/reste 7,50/);
    expect(ev?.entite).toBe("video");
    expect(ev?.entiteId).toBe("v-g1");
  });
  it("sans vidéo : l'entité est le travail", async () => {
    await allumer(1000);
    await sousVerrou(() => A.inscrireAccordUsine({ cle: "trv-g2", besoin: 10, quoi: "Retouche" }));
    const ev = (await depots().evenements.lister()).find((e) => /Accord automatique de l'Usine/.test(e.message));
    expect(ev).toMatchObject({ entite: "travail", entiteId: "trv-g2" });
  });
  it("sous 80 % : aucune cloche", async () => {
    await allumer(1000);
    await sousVerrou(() => A.inscrireAccordUsine({ cle: "trv-h0", besoin: 799, quoi: "a" }));
    expect(await cloches()).toHaveLength(0);
  });
  it("80 % : une seule cloche par mois, sans montant", async () => {
    await allumer(1000);
    await sousVerrou(() => A.inscrireAccordUsine({ cle: "trv-h1", besoin: 800, quoi: "a" }));
    await sousVerrou(() => A.inscrireAccordUsine({ cle: "trv-h2", besoin: 100, quoi: "b" }));
    const c = (await cloches()).filter((n) => /80 %/.test(n.titre));
    expect(c).toHaveLength(1);
    expect(c[0].titre).toBe("Usine : 80 % du plafond du mois utilisé");
    expect(c[0].lien).toBe("/");
    expect(`${c[0].titre} ${c[0].message}`).not.toMatch(/€|\d+[,.]\d{2}|euro/i);
    // le mois suivant : une nouvelle cloche est permise
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 40 * 24 * 3600_000));
    await sousVerrou(() => A.inscrireAccordUsine({ cle: "trv-h3", besoin: 900, quoi: "c" }));
    expect((await cloches()).filter((n) => /80 %/.test(n.titre))).toHaveLength(2);
  });
  it("plafond : une cloche par jour, sans montant", async () => {
    await allumer(1000);
    for (let i = 0; i < 3; i++) await expect(sousVerrou(() => A.inscrireAccordUsine({ cle: `trv-k${i}`, besoin: 5000, quoi: "a" }))).rejects.toMatchObject({ code: "USINE_PLAFOND_ATTEINT" });
    const c = (await cloches()).filter((n) => /plafond du mois atteint/.test(n.titre));
    expect(c).toHaveLength(1);
    expect(c[0].titre).toBe("Usine arrêtée : plafond du mois atteint");
    expect(c[0].message).toBe("Rien n'est parti. Le plafond se règle dans l'Usine.");
    expect(`${c[0].titre} ${c[0].message}`).not.toMatch(/€|\d/);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 2 * 24 * 3600_000));
    await expect(sousVerrou(() => A.inscrireAccordUsine({ cle: "trv-k9", besoin: 5000, quoi: "a" }))).rejects.toMatchObject({ code: "USINE_PLAFOND_ATTEINT" });
    expect((await cloches()).filter((n) => /plafond du mois atteint/.test(n.titre))).toHaveLength(2);
  });
  it("la marque 80 % n'est posée qu'APRÈS l'envoi : une panne laisse l'alerte repartir", async () => {
    await allumer(1000);
    const notifs = depots().notifications;
    const original = notifs.enregistrer.bind(notifs);
    const espion = vi.spyOn(notifs, "enregistrer").mockRejectedValueOnce(new Error("panne"));
    await sousVerrou(() => A.inscrireAccordUsine({ cle: "trv-m80", besoin: 850, quoi: "a" }));
    expect(await lireParametre(`usine.autonomie.alerte80.${MOIS()}`, false)).toBe(false);
    espion.mockImplementation(original);
    await sousVerrou(() => A.inscrireAccordUsine({ cle: "trv-m81", besoin: 10, quoi: "b" }));
    expect(await lireParametre(`usine.autonomie.alerte80.${MOIS()}`, false)).toBe(true);
    expect((await cloches()).filter((n) => /80 %/.test(n.titre))).toHaveLength(1);
  });
  it("panne de notification : la décision est inchangée (accord inscrit, refus levé)", async () => {
    await allumer(1000);
    vi.spyOn(depots().notifications, "enregistrer").mockRejectedValue(new Error("panne"));
    await expect(sousVerrou(() => A.inscrireAccordUsine({ cle: "trv-n80", besoin: 900, quoi: "a" }))).resolves.toBeDefined();
    expect(await depots().parametres.obtenir("usine.autonomie.accord.trv-n80")).toBeDefined();
    await expect(sousVerrou(() => A.inscrireAccordUsine({ cle: "trv-n81", besoin: 900, quoi: "b" }))).rejects.toMatchObject({ code: "USINE_PLAFOND_ATTEINT" });
    expect(await depots().parametres.obtenir("usine.autonomie.accord.trv-n81")).toBeFalsy();
  });
});

describe("vue et accord sans clic", () => {
  it("vue : éteinte par défaut, puis état, plafond, utilisé, pourcentage et mois", async () => {
    expect(await A.vueAutonomieUsine()).toMatchObject({ actif: false, plafondCents: 0, utiliseCents: 0, pourcentage: 0 });
    await allumer(2000);
    await sousVerrou(() => A.inscrireAccordUsine({ cle: "trv-w1", besoin: 500, quoi: "a" }));
    const v = await A.vueAutonomieUsine();
    expect(v).toMatchObject({ etat: "active", actif: true, plafondCents: 2000, utiliseCents: 500, pourcentage: 25 });
    expect(v.mois).toMatch(/^\d{4}-\d{2}$/);
  });
  it("accordSansClicPour : Usine seulement si l'autonomie est allumée ; jamais « studio » par erreur", async () => {
    // Usine, éteinte : pas d'accord sans clic
    expect(await A.accordSansClicPour("usine")).toBe(false);
    expect(await A.accordSansClicPour(null)).toBe(false);
    await allumer(1000);
    expect(await A.accordSansClicPour("usine")).toBe(true);
    expect(await A.accordSansClicPour(null)).toBe(true);
    expect(await A.accordSansClicPour("usine", "v-inconnue")).toBe(true);
    await ecrireParametre("usine.autonomie", "texte");
    expect(await A.accordSansClicPour("usine")).toBe(false);
  });
  it("accordSansClicPour : le Studio garde son accord indicatif", async () => {
    expect(await A.accordSansClicPour("studio")).toBe(true);
    expect(await A.accordSansClicPour(undefined)).toBe(true);
  });
});
