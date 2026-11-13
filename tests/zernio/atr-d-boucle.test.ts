/** ATR-D · boucle : étape a_traiter_manuel du passage. Données fictives, aucun envoi réel, aucun port. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EvenementFournisseur } from "@/domaine/types";

const port = vi.hoisted(() => ({ appels: 0 }));
vi.mock("@/fournisseurs/zernio-inbox", () => {
  port.appels++;
  return { creerPortInboxZernio: () => { port.appels++; throw new Error("port interdit"); } };
});
const manuel = vi.hoisted(() => ({ appels: [] as unknown[] }));
vi.mock("@/services/a-traiter-manuel", async (orig) => {
  const o = await orig<typeof import("@/services/a-traiter-manuel")>();
  return { ...o, traiterCommentairesManuels: vi.fn(async (a: unknown) => { manuel.appels.push(a); return { actif: true, traites: 0, reportes: 0 }; }) };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const Com = await import("@/services/_commun");
const B = await import("@/services/branchements-zernio");
const { PARAM_RESEAUX_MANUELS } = await import("@/services/a-traiter-manuel");

const T0 = 1_760_781_600_000;
beforeEach(() => {
  reinitialiserDepots();
  manuel.appels.length = 0;
  for (const m of ["log", "error", "warn"] as const) vi.spyOn(console, m).mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("étape a_traiter_manuel", () => {
  it("À TRAITER éteint : l'étape n'appelle pas le traitement", async () => {
    await B.passageParcoursZernio({ env: {}, maintenantMs: T0 });
    expect(manuel.appels).toHaveLength(0);
  });
  it("À TRAITER allumé : le traitement est appelé, même parcours Facebook éteint", async () => {
    await B.passageParcoursZernio({ env: { A_TRAITER_ENABLED: "1" }, maintenantMs: T0 });
    expect(manuel.appels).toHaveLength(1);
  });
  it("le port n'est jamais atteint", async () => {
    await B.passageParcoursZernio({ env: { A_TRAITER_ENABLED: "1" }, maintenantMs: T0 });
    await B.passageParcoursZernio({ env: { A_TRAITER_ENABLED: "1" }, maintenantMs: T0 + 60_000 });
    expect(port.appels).toBe(0);
  });
  it("une panne du traitement ne fait pas échouer le passage", async () => {
    const m = await import("@/services/a-traiter-manuel");
    vi.mocked(m.traiterCommentairesManuels).mockRejectedValueOnce(new Error("panne"));
    await expect(B.passageParcoursZernio({ env: { A_TRAITER_ENABLED: "1" }, maintenantMs: T0 })).resolves.toBeUndefined();
  });
});

describe("dépôt persistant injecté, idempotent", () => {
  it("après un passage allumé, une carte déposée par le service par défaut survit (paramètre a_traiter.cartes)", async () => {
    const A = await import("@/services/a-traiter");
    await B.passageParcoursZernio({ env: { A_TRAITER_ENABLED: "1" }, maintenantMs: T0 });
    await B.passageParcoursZernio({ env: { A_TRAITER_ENABLED: "1" }, maintenantMs: T0 + 60_000 });
    const r = await A.enregistrerATraiter(
      { idEvenement: "evt_1", reseau: "tiktok", post: "p1", lienPost: null, mot: "DEMO", motif: "mot_manuel", commentaire: "DEMO", reponse: null, idContact: "c1", message: null } as never,
      { env: { A_TRAITER_ENABLED: "1" } },
    );
    expect(r.issue).not.toBe("simule");
    const { PARAM_CARTES_A_TRAITER } = await import("@/services/a-traiter-depot");
    const cartes = await Com.lireParametre<unknown[]>(PARAM_CARTES_A_TRAITER, []);
    expect(cartes.length).toBe(1);
  });
  it("éteint : aucune écriture ni lecture du réglage", async () => {
    const lire = vi.spyOn(depots().parametres, "obtenir");
    await B.passageParcoursZernio({ env: {}, maintenantMs: T0 + 3 * 60_000 });
    expect(lire.mock.calls.some((a) => String(a[0]) === PARAM_RESEAUX_MANUELS)).toBe(false);
  });
});

describe("aucun événement n'est touché par l'étape simulée", () => {
  it("un événement manuel reste intact quand le traitement est simulé", async () => {
    const ev = { id: "evf_1", fournisseur: "zernio", idEvenement: "e1", type: "zernio.commentaire_manuel", recuLe: "x", traite: false, charge: { etat: "a_faire" }, creeLe: "x", modifieLe: "x" } as EvenementFournisseur;
    await depots().evenementsFournisseurs.enregistrer(ev);
    await B.passageParcoursZernio({ env: { A_TRAITER_ENABLED: "1" }, maintenantMs: T0 });
    expect((await depots().evenementsFournisseurs.lister(() => true))[0].traite).toBe(false);
  });
});

describe("ATR-D R2 : limite de 15 s propre à l'étape", () => {
  const ENV = { A_TRAITER_ENABLED: "1" };
  it("deux passages à 5 s d'écart : un seul traitement ; à 15 s : un second", async () => {
    await B.passageParcoursZernio({ env: ENV, maintenantMs: T0 + 10 * 60_000 });
    await B.passageParcoursZernio({ env: ENV, maintenantMs: T0 + 10 * 60_000 + 5_000 });
    await B.passageParcoursZernio({ env: ENV, maintenantMs: T0 + 10 * 60_000 + 10_000 });
    expect(manuel.appels).toHaveLength(1);
    await B.passageParcoursZernio({ env: ENV, maintenantMs: T0 + 10 * 60_000 + 15_000 });
    expect(manuel.appels).toHaveLength(2);
  });
});

describe("ATR-D R3 : éteint, aucun import ni dépôt", () => {
  it("éteint : le module a-traiter n'est pas importé et aucun dépôt n'est injecté", async () => {
    vi.resetModules();
    const charges: string[] = [];
    vi.doMock("@/services/a-traiter", async (orig) => { charges.push("a-traiter"); return orig(); });
    vi.doMock("@/services/a-traiter-depot", async (orig) => { charges.push("a-traiter-depot"); return orig(); });
    const B2 = await import("@/services/branchements-zernio");
    await B2.passageParcoursZernio({ env: {}, maintenantMs: T0 + 20 * 60_000 });
    expect(charges).toEqual([]);
    vi.doUnmock("@/services/a-traiter");
    vi.doUnmock("@/services/a-traiter-depot");
  });
});

describe("ATR-D R3 : nom de la variable", () => {
  it("la copie de la boucle = la variable d'a-traiter", async () => {
    const A = await import("@/services/a-traiter");
    expect(B.VARIABLE_A_TRAITER_BOUCLE).toBe(A.VARIABLE_INTERRUPTEUR_A_TRAITER);
  });
});
